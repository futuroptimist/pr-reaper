import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import * as core from '@actions/core';
import { DefaultArtifactClient } from '@actions/artifact';
import { applyExclude } from './filter.js';
function toLogger(consoleLike) {
    return {
        info: (message) => consoleLike.log(message),
        warn: (message) => consoleLike.warn(message),
        error: (message) => consoleLike.error(message)
    };
}
function hasScope(scopes, name) {
    const target = name.toLowerCase();
    for (const scope of scopes) {
        if (scope.trim().toLowerCase() === target) {
            return true;
        }
    }
    return false;
}
function formatMarkdown(prs) {
    const lines = ['# pr-reaper dry run', ''];
    if (prs.length === 0) {
        lines.push('No pull requests matched the filters.');
    }
    else {
        lines.push(`Found **${prs.length}** pull request(s):`, '');
        for (const pr of prs) {
            lines.push(`- [${pr.title}](${pr.permalink || pr.url}) (${pr.repository.nameWithOwner}#${pr.number})`);
        }
    }
    return lines.join('\n') + '\n';
}
function escapeCsv(value) {
    if (/[",\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}
function formatCsv(prs) {
    const lines = ['repository,number,title,url'];
    for (const pr of prs) {
        lines.push([
            escapeCsv(pr.repository.nameWithOwner),
            escapeCsv(String(pr.number)),
            escapeCsv(pr.title),
            escapeCsv(pr.permalink || pr.url)
        ].join(','));
    }
    return lines.join('\n') + '\n';
}
async function uploadDryRunArtifacts(prs, workspace, artifact) {
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
function logSearchResults(logger, prs, skipped) {
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
async function writeSummary(prs, skipped) {
    core.summary.addHeading('pr-reaper summary', 2);
    if (prs.length === 0) {
        core.summary.addRaw('No open pull requests found after filtering.');
    }
    else {
        core.summary
            .addRaw(`Found **${prs.length}** open pull request(s):`)
            .addBreak()
            .addList(prs.map((pr) => `${pr.title} — [${pr.repository.nameWithOwner}#${pr.number}](${pr.permalink || pr.url})`));
    }
    if (skipped.length > 0) {
        core.summary
            .addBreak()
            .addDetails('Skipped pull requests', skipped
            .map((pr) => `${pr.repository.nameWithOwner}#${pr.number} — ${pr.title}`)
            .join('\n') || 'None');
    }
    await core.summary.write();
}
function progressLabel(index, total) {
    const pct = total === 0 ? 0 : (index / total) * 100;
    return `[${index}/${total} - ${pct.toFixed(1)}%]`;
}
export async function runReaper(options) {
    const workspace = options.workspace ?? process.cwd();
    const logger = toLogger(options.console ?? console);
    const { inputs, gh } = options;
    const artifactClient = options.artifactClient ?? new DefaultArtifactClient();
    const ghVersion = await gh.version().catch(() => null);
    if (ghVersion) {
        logger.info(`gh version: ${ghVersion}`);
    }
    const authStatus = await gh.authStatus().catch(() => null);
    if (authStatus) {
        logger.info('gh auth status:');
        logger.info(authStatus);
    }
    const login = await gh.getLogin();
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
        await uploadDryRunArtifacts(remaining, workspace, artifactClient);
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
//# sourceMappingURL=reap.js.map