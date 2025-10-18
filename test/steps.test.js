import { test } from 'node:test';
import assert from 'node:assert';
import { applyExclude } from '../dist/filter.js';

const prs = [
  {
    number: 1,
    repository: { nameWithOwner: 'octo/repo' },
    title: 'Keep me',
    url: 'https://api.github.com/repos/octo/repo/pulls/1',
    permalink: 'https://github.com/octo/repo/pull/1'
  },
  {
    number: 2,
    repository: { nameWithOwner: 'octo/repo' },
    title: 'Drop me',
    url: 'https://api.github.com/repos/octo/repo/pulls/2',
    permalink: 'https://github.com/octo/repo/pull/2'
  },
  {
    number: 3,
    repository: { nameWithOwner: 'octo/repo' },
    title: 'No permalink',
    url: 'https://github.com/octo/repo/pull/3'
  }
];

test('applyExclude filters HTML URLs', () => {
  const { remaining } = applyExclude(prs, ['https://github.com/octo/repo/pull/2']);
  assert.deepStrictEqual(remaining, [prs[0], prs[2]]);
});

test('applyExclude filters shorthand owner/repo#number references', () => {
  const { remaining } = applyExclude(prs, ['octo/repo#2']);
  assert.deepStrictEqual(remaining, [prs[0], prs[2]]);
});

test('applyExclude tolerates mixed separators', () => {
  const { remaining } = applyExclude(prs, ['octo/repo/pull/2', '']);
  assert.deepStrictEqual(remaining, [prs[0], prs[2]]);
});

test('applyExclude handles pull requests without permalink data', () => {
  const { remaining } = applyExclude(prs, ['octo/repo#3']);
  assert.deepStrictEqual(remaining, [prs[0], prs[1]]);
});
