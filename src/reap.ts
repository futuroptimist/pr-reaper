import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import * as core from '@actions/core';
import { DefaultArtifactClient } from '@actions/artifact';
type ArtifactClient = Pick<DefaultArtifactClient, 'uploadArtifact'>;
import type { InputsConfig } from './inputs.js';
import type { GhCli, PullRequest } from './gh.js';
import { applyExclude } from './filter.js';

interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

function toLogger(consoleLike: Console): Logger {
  return {
    info: (message: string) => consoleLike.log(message),
    warn: (message: string) => consoleLike.warn(message),
    error: (message: string) => consoleLike.error(message)
  };
}

function hasArtifactRuntimeEnv(env: NodeJS.ProcessEnv): boolean {
  const token = env.ACTIONS_RUNTIME_TOKEN?.trim();
  const url = env.ACTIONS_RUNTIME_URL?.trim();
  return Boolean(token && url);
}

function isMissingArtifactRuntimeError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return message.includes('actions_runtime_token') || message.includes('actions_runtime_url');
}

function hasScope(scopes: Set<string>, name: string): boolean {
  const target = name.toLowerCase();
  for (const scope of scopes) {
    if (scope.trim().toLowerCase() === target) {
      return true;
    }
  }
  return false;
}

function formatMarkdown(prs: PullRequest[]): string {
  const lines: string[] = ['# pr-reaper dry run', ''];
  if (prs.length === 0) {
    lines.push('No pull requests matched the filters.');
  } else {
    lines.push(`Found **${prs.length}** pull request(s):`, '');
    for (const pr of prs) {
      lines.push(`- [${pr.title}](${pr.permalink || pr.url}) (${pr.repository.nameWithOwner}#${pr.number})`);
    }
  }
  return lines.join('\n') + '\n';
}

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatCsv(prs: PullRequest[]): string {
  const lines = ['repository,number,title,url'];
  for (const pr of prs) {
    lines.push(
      [
        escapeCsv(pr.repository.nameWithOwner),
        escapeCsv(String(pr.number)),
        escapeCsv(pr.title),
        escapeCsv(pr.permalink || pr.url)
      ].join(',')
    );
  }
  return lines.join('\n') + '\n';
}

function parseLoginFromAuthStatus(authStatus: string): string | null {
  for (const rawLine of authStatus.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const match =
      line.match(/logged in to[^\n]*? as ([^\s(]+)/i) ||
      line.match(/logged in as ([^\s(]+)/i);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

async function uploadDryRunArtifacts(prs: PullRequest[], workspace: string, artifact: ArtifactClient): Promise<void> {
  const artifactDir = join(workspace, 'dry-run-artifacts');
  await fs.mkdir(artifactDir, { recursive: true });

  const jsonPath = join(artifactDir, 'prs.json');
  const markdownPath = join(artifactDir, 'summary.md');
  const csvPath = join(artifactDir, 'prs.csv');

  await fs.writeFile(jsonPath, JSON.stringify(prs, null, 2));
  await fs.writeFile(markdownPath, formatMarkdown(prs));
  await fs.writeFile(csvPath, formatCsv(prs));

  await artifact.uploadArtifact('dry-run-prs', [jsonPath, markdownPath, csvPath], artifactDir);
}

function logSearchResults(logger: Logger, prs: PullRequest[], skipped: PullRequest[]): void {
  logger.info(`Found ${prs.length + skipped.length} pull request(s).`);
  if (skipped.length > 0) {
    logger.info(`Skipped ${skipped.length} PR(s) that matched the exclusion list.`);
    for (const pr of skipped) {
      logger.info(`  - ${pr.repository.nameWithOwner}#${pr.number} — ${pr.title}`);
    }
  }

  if (prs.length === 0) {
    logger.info('No pull requests remain after filtering.');
    return;
  }

  logger.info('Matched pull requests:');
  for (const pr of prs) {
    logger.info(`  - ${pr.repository.nameWithOwner}#${pr.number} — ${pr.title}`);
  }
}

async function writeSummary(prs: PullRequest[], skipped: PullRequest[]): Promise<void> {
  core.summary.addHeading('pr-reaper summary', 2);
  if (prs.length === 0) {
    core.summary.addRaw('No open pull requests found after filtering.');
  } else {
    core.summary
      .addRaw(`Found **${prs.length}** open pull request(s):`)
      .addBreak()
      .addList(
        prs.map((pr) => `${pr.title} — [${pr.repository.nameWithOwner}#${pr.number}](${pr.permalink || pr.url})`)
      );
  }
  if (skipped.length > 0) {
    core.summary
      .addBreak()
      .addDetails(
        'Skipped pull requests',
        skipped
          .map((pr) => `${pr.repository.nameWithOwner}#${pr.number} — ${pr.title}`)
          .join('\n') || 'None'
      );
  }
  await core.summary.write();
}

function progressLabel(index: number, total: number): string {
  const pct = total === 0 ? 0 : (index / total) * 100;
  return `[${index}/${total} - ${pct.toFixed(1)}%]`;
}

export interface RunOptions {
  inputs: InputsConfig;
  gh: GhCli;
  workspace?: string;
  console?: Console;
  artifactClient?: ArtifactClient;
  env?: NodeJS.ProcessEnv;
}

export async function runReaper(options: RunOptions): Promise<void> {
  const workspace = options.workspace ?? process.cwd();
  const logger = toLogger(options.console ?? console);
  const { inputs, gh } = options;
  const artifactClient = options.artifactClient ?? new DefaultArtifactClient();
  const env = options.env ?? process.env;

  const ghVersion = await gh.version().catch(() => null);
  if (ghVersion) {
    logger.info(`gh version: ${ghVersion}`);
  }

  const authStatus = await gh.authStatus().catch(() => null);
  if (authStatus) {
    logger.info('gh auth status:');
    logger.info(authStatus);
  }

  let login = await gh.getLogin();
  if (!login && authStatus) {
    login = parseLoginFromAuthStatus(authStatus);
  }
  if (!login) {
    throw new Error('gh is unauthenticated; set PR_REAPER_TOKEN with repo scope.');
  }
  logger.info(`Authenticated as: ${login}`);

  const scopes = await gh.getTokenScopes();
  const hasRepoScope = hasScope(scopes, 'repo');
  if (!hasRepoScope) {
    throw new Error("GH_TOKEN lacks 'repo' scope; add PR_REAPER_TOKEN with repo scope.");
  }

  const hasReadOrg = hasScope(scopes, 'read:org');
  if (inputs.org && !hasReadOrg) {
    throw new Error("GH_TOKEN lacks 'read:org' scope required for org searches.");
  }
  if (!inputs.org && !hasReadOrg) {
    core.warning("Could not verify 'read:org'; org searches may be limited.");
  }

  const results = await gh.searchPullRequests({
    author: inputs.author,
    limit: inputs.limit,
    org: inputs.org,
    titleFilter: inputs.titleFilter
  });

  const { remaining, skipped } = applyExclude(results, inputs.exclude);
  await fs.writeFile(join(workspace, 'prs.json'), JSON.stringify(remaining, null, 2));

  logSearchResults(logger, remaining, skipped);

  await writeSummary(remaining, skipped);

  core.setOutput('count', String(remaining.length));

  if (inputs.dryRun) {
    if (!hasArtifactRuntimeEnv(env)) {
      logger.warn(
        'ACTIONS_RUNTIME_TOKEN/ACTIONS_RUNTIME_URL are unavailable; skipping dry-run artifact upload.'
      );
      return;
    }
    try {
      await uploadDryRunArtifacts(remaining, workspace, artifactClient);
    } catch (error) {
      if (isMissingArtifactRuntimeError(error)) {
        logger.warn('Artifact runtime credentials missing; skipping dry-run artifact upload.');
        return;
      }
      throw error;
    }
    return;
  }

  if (remaining.length === 0) {
    logger.info('No pull requests to close.');
    return;
  }

  let index = 1;
  const total = remaining.length;
  for (const pr of remaining) {
    const label = progressLabel(index, total);
    logger.info(`${label} Closing ${pr.repository.nameWithOwner}#${pr.number}`);
    await gh.closePullRequest(pr.repository.nameWithOwner, pr.number, inputs.comment, inputs.deleteBranch);
    index += 1;
  }
}


