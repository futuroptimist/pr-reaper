import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface GhExecOptions {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}

export class GhError extends Error {
  constructor(message: string, public readonly code: number | null, public readonly stderr: string) {
    super(message);
    this.name = 'GhError';
  }
}

export interface SearchOptions {
  author: string;
  limit: number;
  org: string | null;
  titleFilter: string | null;
}

export interface PullRequest {
  number: number;
  permalink: string;
  repository: { nameWithOwner: string };
  title: string;
  url: string;
}

type PullRequestLike = Omit<PullRequest, 'permalink'> & { permalink?: string | null | undefined };

function normalizePullRequests(results: PullRequestLike[]): PullRequest[] {
  return results.map((pr) => ({
    ...pr,
    permalink:
      typeof pr.permalink === 'string' && pr.permalink ? pr.permalink : pr.url
  }));
}

function isUnknownJsonFieldError(error: unknown, field: string): error is GhError {
  if (error instanceof GhError) {
    const haystack = `${error.message}\n${error.stderr}`.toLowerCase();
    return (
      haystack.includes('unknown json field') &&
      haystack.includes(`"${field.toLowerCase()}"`)
    );
  }
  return false;
}

export class GhCli {
  constructor(private readonly options: GhExecOptions = {}) {}

  private async exec(args: string[]): Promise<{ stdout: string; stderr: string }> {
    try {
      const { stdout, stderr } = await execFileAsync('gh', args, {
        env: this.options.env,
        cwd: this.options.cwd,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024
      });
      return { stdout, stderr };
    } catch (error) {
      if (error && typeof error === 'object' && 'stdout' in error && 'stderr' in error) {
        const execError = error as {
          stdout: string;
          stderr: string;
          code: number | null;
          message: string;
        };
        throw new GhError(execError.message, execError.code ?? null, execError.stderr);
      }
      throw error;
    }
  }

  async version(): Promise<string> {
    const { stdout } = await this.exec(['--version']);
    return stdout.trim();
  }

  async authStatus(): Promise<string> {
    const { stdout } = await this.exec(['auth', 'status']);
    return stdout.trim();
  }

  async getLogin(): Promise<string | null> {
    try {
      const { stdout } = await this.exec(['api', 'user', '--jq', '.login']);
      const trimmed = stdout.trim();
      return trimmed ? trimmed : null;
    } catch (error) {
      return null;
    }
  }

  async getTokenScopes(): Promise<Set<string>> {
    const scopes = new Set<string>();

    try {
      const { stdout } = await this.exec(['api', '-i', 'user']);
      for (const rawLine of stdout.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (line.toLowerCase().startsWith('x-oauth-scopes:')) {
          const value = line.slice(line.indexOf(':') + 1).trim();
          if (value) {
            for (const part of value.split(',')) {
              const scope = part.trim();
              if (scope) {
                scopes.add(scope);
              }
            }
          }
        }
      }
    } catch (error) {
      // ignore and fall back to auth status parsing
    }

    if (scopes.size === 0) {
      try {
        const { stdout } = await this.exec(['auth', 'status']);
        for (const rawLine of stdout.split(/\r?\n/)) {
          const match = rawLine.match(/Token scopes:\s*(.+)$/i);
          if (match) {
            for (const part of match[1].split(',')) {
              const scope = part.trim();
              if (scope) {
                scopes.add(scope);
              }
            }
          }
        }
      } catch (error) {
        // ignore; unauthenticated runs may fail here.
      }
    }

    return scopes;
  }

  async searchPullRequests(options: SearchOptions): Promise<PullRequest[]> {
    const baseArgs = [
      'search',
      'prs',
      '--author',
      options.author,
      '--state',
      'open',
      '--limit',
      String(options.limit)
    ];

    if (options.org) {
      baseArgs.push('--owner', options.org);
    }
    if (options.titleFilter) {
      baseArgs.push('--search', options.titleFilter, '--match', 'title');
    }

    const jsonArgs = [...baseArgs, '--json', 'number,permalink,repository,title,url'];

    try {
      const { stdout } = await this.exec(jsonArgs);
      const results = JSON.parse(stdout) as PullRequestLike[];
      return normalizePullRequests(results);
    } catch (error) {
      if (isUnknownJsonFieldError(error, 'permalink')) {
        const fallbackArgs = [...baseArgs, '--json', 'number,repository,title,url'];
        const { stdout } = await this.exec(fallbackArgs);
        const results = JSON.parse(stdout) as PullRequestLike[];
        return normalizePullRequests(results);
      }
      throw error;
    }
  }

  async closePullRequest(
    repository: string,
    number: number,
    comment: string,
    deleteBranch: boolean
  ): Promise<void> {
    const args = ['pr', 'close', String(number), '--repo', repository, '--comment', comment];
    if (deleteBranch) {
      args.push('--delete-branch');
    }
    await this.exec(args);
  }
}
