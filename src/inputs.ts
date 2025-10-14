import { InputOptions, getInput } from '@actions/core';

export interface InputsConfig {
  dryRun: boolean;
  author: string;
  org: string | null;
  titleFilter: string | null;
  deleteBranch: boolean;
  limit: number;
  comment: string;
  exclude: string[];
  token: string;
  tokenSource: 'GH_TOKEN' | 'GITHUB_TOKEN';
  actor: string | null;
}

export interface ParsedInputs {
  config: InputsConfig;
  warnings: string[];
}

export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InputError';
  }
}

export type InputReader = (name: string, options?: InputOptions) => string;

const BOOLEAN_TRUE = new Set(['true', '1', 'yes']);
const BOOLEAN_FALSE = new Set(['false', '0', 'no']);

function coerceBoolean(value: string, fallback: boolean): boolean {
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

function coerceInteger(value: string, fallback: number, min: number, max: number): number {
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

function defaultInputReader(name: string, options?: InputOptions): string {
  return getInput(name, options);
}

export function parseInputs(
  readInput: InputReader = defaultInputReader,
  env: NodeJS.ProcessEnv = process.env
): ParsedInputs {
  const warnings: string[] = [];

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
  const fallbackToken = env.GITHUB_TOKEN?.trim();

  let resolvedToken = '';
  let tokenSource: InputsConfig['tokenSource'];

  if (token) {
    resolvedToken = token;
    tokenSource = 'GH_TOKEN';
  } else if (fallbackToken) {
    resolvedToken = fallbackToken;
    tokenSource = 'GITHUB_TOKEN';
    warnings.push(
      'GH_TOKEN is not set; falling back to GITHUB_TOKEN. Cross-repo searches may be limited.'
    );
  } else {
    throw new InputError('GH_TOKEN or GITHUB_TOKEN must be provided.');
  }

  if (tokenSource === 'GITHUB_TOKEN' && org) {
    warnings.push('read:org checks may fail when using GITHUB_TOKEN.');
  }

  const config: InputsConfig = {
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
