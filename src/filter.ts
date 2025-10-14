import { URL } from 'node:url';
import type { PullRequest } from './gh.js';

export interface FilterResult {
  remaining: PullRequest[];
  skipped: PullRequest[];
}

interface OwnerRepoNumber {
  owner: string;
  repo: string;
  number: string;
}

function parseOwnerRepoNumber(value: string): OwnerRepoNumber | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const shorthand = trimmed.match(/([^/\s]+)\/([^#\s]+)#(\d+)/i);
  if (shorthand) {
    return {
      owner: shorthand[1].toLowerCase(),
      repo: shorthand[2].toLowerCase(),
      number: String(Number.parseInt(shorthand[3], 10))
    };
  }

  const pulls = trimmed.match(/([^/\s]+)\/([^/\s]+)\/pulls?\/(\d+)/i);
  if (pulls) {
    return {
      owner: pulls[1].toLowerCase(),
      repo: pulls[2].toLowerCase(),
      number: String(Number.parseInt(pulls[3], 10))
    };
  }

  try {
    if (trimmed.includes('://')) {
      const parsed = new URL(trimmed);
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (segments.length >= 4) {
        const marker = segments[segments.length - 2]?.toLowerCase();
        const number = segments[segments.length - 1];
        if (/^\d+$/.test(number)) {
          if (marker === 'pull' && segments.length >= 4) {
            return {
              owner: segments[segments.length - 4].toLowerCase(),
              repo: segments[segments.length - 3].toLowerCase(),
              number: String(Number.parseInt(number, 10))
            };
          }
          if (marker === 'pulls' && segments.length >= 5) {
            return {
              owner: segments[segments.length - 5].toLowerCase(),
              repo: segments[segments.length - 4].toLowerCase(),
              number: String(Number.parseInt(number, 10))
            };
          }
        }
      }
    }
  } catch (error) {
    return null;
  }

  return null;
}

function normalizeRepo(owner: string, repo: string, number: string, extraHosts?: Set<string>): Set<string> {
  const normalizedNumber = String(Number.parseInt(number, 10));
  const ownerLower = owner.toLowerCase();
  const repoLower = repo.toLowerCase();
  const ownerRepo = `${ownerLower}/${repoLower}`;

  const refs = new Set<string>([
    `${ownerRepo}#${normalizedNumber}`,
    `${ownerRepo}/pull/${normalizedNumber}`,
    `${ownerRepo}/pulls/${normalizedNumber}`,
    `https://github.com/${ownerRepo}/pull/${normalizedNumber}`,
    `https://github.com/${ownerRepo}/pulls/${normalizedNumber}`,
    `https://api.github.com/repos/${ownerRepo}/pulls/${normalizedNumber}`
  ]);

  if (extraHosts && extraHosts.size > 0) {
    for (const host of extraHosts) {
      const base = host.replace(/\/$/, '');
      refs.add(`${base}/repos/${ownerRepo}/pulls/${normalizedNumber}`);
    }
  }

  return refs;
}

function collectExtraHosts(pr: PullRequest): Set<string> {
  const hosts = new Set<string>();
  const fields: (keyof PullRequest)[] = ['url', 'permalink'];
  for (const field of fields) {
    const value = pr[field];
    if (typeof value === 'string' && value) {
      try {
        const parsed = new URL(value);
        hosts.add(`${parsed.protocol}//${parsed.host}`.toLowerCase());
      } catch (error) {
        // ignore
      }
    }
  }
  return hosts;
}

function prReferences(pr: PullRequest): Set<string> {
  const refs = new Set<string>();
  const extraHosts = collectExtraHosts(pr);
  const repo = pr.repository?.nameWithOwner;
  const number = pr.number;

  if (typeof pr.url === 'string' && pr.url) {
    refs.add(pr.url.toLowerCase());
  }
  if (typeof pr.permalink === 'string' && pr.permalink) {
    refs.add(pr.permalink.toLowerCase());
  }

  if (repo && typeof repo === 'string' && repo.includes('/')) {
    const [owner, repoName] = repo.split('/', 2);
    const normalized = normalizeRepo(owner, repoName, String(number), extraHosts);
    for (const value of normalized) {
      refs.add(value.toLowerCase());
    }
  }

  return refs;
}

export function buildExcludeSet(tokens: string[]): Set<string> {
  const exclude = new Set<string>();

  for (const token of tokens) {
    const lowered = token.toLowerCase();
    if (lowered) {
      exclude.add(lowered);
    }
    const parsed = parseOwnerRepoNumber(token);
    if (parsed) {
      const normalized = normalizeRepo(parsed.owner, parsed.repo, parsed.number);
      for (const value of normalized) {
        exclude.add(value.toLowerCase());
      }
    }
  }

  return exclude;
}

export function applyExclude(
  prs: PullRequest[],
  excludeTokens: string[]
): FilterResult {
  if (excludeTokens.length === 0) {
    return { remaining: prs, skipped: [] };
  }

  const excludeSet = buildExcludeSet(excludeTokens);
  const remaining: PullRequest[] = [];
  const skipped: PullRequest[] = [];

  for (const pr of prs) {
    const refs = prReferences(pr);
    let matched = false;
    for (const ref of refs) {
      if (excludeSet.has(ref)) {
        matched = true;
        break;
      }
    }
    if (matched) {
      skipped.push(pr);
    } else {
      remaining.push(pr);
    }
  }

  return { remaining, skipped };
}
