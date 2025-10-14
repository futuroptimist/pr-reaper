import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);
export class GhError extends Error {
    code;
    stderr;
    constructor(message, code, stderr) {
        super(message);
        this.code = code;
        this.stderr = stderr;
        this.name = 'GhError';
    }
}
export class GhCli {
    options;
    constructor(options = {}) {
        this.options = options;
    }
    async exec(args) {
        try {
            const { stdout, stderr } = await execFileAsync('gh', args, {
                env: this.options.env,
                cwd: this.options.cwd,
                encoding: 'utf8',
                maxBuffer: 1024 * 1024
            });
            return { stdout, stderr };
        }
        catch (error) {
            if (error && typeof error === 'object' && 'stdout' in error && 'stderr' in error) {
                const execError = error;
                throw new GhError(execError.message, execError.code ?? null, execError.stderr);
            }
            throw error;
        }
    }
    async version() {
        const { stdout } = await this.exec(['--version']);
        return stdout.trim();
    }
    async authStatus() {
        const { stdout } = await this.exec(['auth', 'status']);
        return stdout.trim();
    }
    async getLogin() {
        try {
            const { stdout } = await this.exec(['api', 'user', '--jq', '.login']);
            const trimmed = stdout.trim();
            return trimmed ? trimmed : null;
        }
        catch (error) {
            return null;
        }
    }
    async getTokenScopes() {
        const scopes = new Set();
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
        }
        catch (error) {
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
            }
            catch (error) {
                // ignore; unauthenticated runs may fail here.
            }
        }
        return scopes;
    }
    async searchPullRequests(options) {
        const args = [
            'search',
            'prs',
            '--author',
            options.author,
            '--state',
            'open',
            '--limit',
            String(options.limit),
            '--json',
            'number,permalink,repository,title,url'
        ];
        if (options.org) {
            args.push('--owner', options.org);
        }
        if (options.titleFilter) {
            args.push('--search', options.titleFilter, '--match', 'title');
        }
        const { stdout } = await this.exec(args);
        const results = JSON.parse(stdout);
        return results;
    }
    async closePullRequest(repository, number, comment, deleteBranch) {
        const args = ['pr', 'close', String(number), '--repo', repository, '--comment', comment];
        if (deleteBranch) {
            args.push('--delete-branch');
        }
        await this.exec(args);
    }
}
//# sourceMappingURL=gh.js.map