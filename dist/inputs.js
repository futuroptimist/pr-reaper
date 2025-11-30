import { getInput } from '@actions/core';
export class InputError extends Error {
    constructor(message) {
        super(message);
        this.name = 'InputError';
    }
}
const BOOLEAN_TRUE = new Set(['true', '1', 'yes']);
const BOOLEAN_FALSE = new Set(['false', '0', 'no']);
function coerceBoolean(value, fallback) {
    if (!value) {
        return fallback;
    }
    const lowered = value.trim().toLowerCase();
    if (BOOLEAN_TRUE.has(lowered)) {
        return true;
    }
    if (BOOLEAN_FALSE.has(lowered)) {
        return false;
    }
    throw new InputError(`Invalid boolean value "${value}".`);
}
function coerceInteger(value, fallback, min, max) {
    if (!value) {
        return fallback;
    }
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
        throw new InputError(`Limit must be an integer between ${min} and ${max}.`);
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isNaN(parsed) || parsed < min || parsed > max) {
        throw new InputError(`Limit must be an integer between ${min} and ${max}.`);
    }
    return parsed;
}
function defaultInputReader(name, options) {
    return getInput(name, options);
}
export function parseInputs(readInput = defaultInputReader, env = process.env) {
    const warnings = [];
    const actor = env.GITHUB_ACTOR?.trim() || null;
    const rawAuthor = readInput('author').trim();
    const author = rawAuthor || actor;
    if (!author) {
        throw new InputError('Author input is required when GITHUB_ACTOR is unavailable.');
    }
    const rawLimit = readInput('limit').trim();
    const limit = coerceInteger(rawLimit, 1000, 1, 1000);
    const dryRun = coerceBoolean(readInput('dry_run'), true);
    const deleteBranch = coerceBoolean(readInput('delete_branch'), true);
    const org = readInput('org').trim() || null;
    const titleFilter = readInput('title_filter').trim() || null;
    const comment = readInput('comment');
    const excludeRaw = readInput('exclude_urls');
    const exclude = excludeRaw
        .replace(/\r/g, '\n')
        .split(/[\s,;|]+/u)
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
    const token = env.GH_TOKEN?.trim();
    const fallbackPat = env.PR_REAPER_TOKEN?.trim();
    const fallbackToken = env.GITHUB_TOKEN?.trim();
    let resolvedToken = '';
    let tokenSource;
    if (token) {
        resolvedToken = token;
        tokenSource = 'GH_TOKEN';
    }
    else if (fallbackPat) {
        resolvedToken = fallbackPat;
        tokenSource = 'PR_REAPER_TOKEN';
        warnings.push('GH_TOKEN is not set; using PR_REAPER_TOKEN.');
    }
    else if (fallbackToken) {
        resolvedToken = fallbackToken;
        tokenSource = 'GITHUB_TOKEN';
        warnings.push('GH_TOKEN is not set; falling back to GITHUB_TOKEN. Cross-repo searches may be limited.');
    }
    else {
        throw new InputError('GH_TOKEN or GITHUB_TOKEN must be provided.');
    }
    if (tokenSource === 'GITHUB_TOKEN' && org) {
        warnings.push('read:org checks may fail when using GITHUB_TOKEN.');
    }
    const config = {
        dryRun,
        author,
        org,
        titleFilter,
        deleteBranch,
        limit,
        comment,
        exclude,
        token: resolvedToken,
        tokenSource,
        actor
    };
    return { config, warnings };
}
//# sourceMappingURL=inputs.js.map