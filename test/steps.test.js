import { test } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('summary step lists repo names correctly', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'pr-reaper-'));
  const file = join(tmp, 'prs.json');
  const data = [{
    number: 1,
    repository: { nameWithOwner: 'octo/repo' },
    title: 'Fix',
    url: 'https://github.com/octo/repo/pull/1'
  }];
  writeFileSync(file, JSON.stringify(data));
  const out = execSync(
    `jq -r '.[] | "- [\\(.title)](\\(.url))  (\\(.repository.nameWithOwner)#\\(.number))"' ${file}`
  )
    .toString()
    .trim();
  assert.strictEqual(out, '- [Fix](https://github.com/octo/repo/pull/1)  (octo/repo#1)');
});

test('close step outputs owner/repo pairs', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'pr-reaper-'));
  const file = join(tmp, 'prs.json');
  const data = [{
    number: 2,
    repository: { nameWithOwner: 'octo/repo' },
    title: 'Fix',
    url: 'https://github.com/octo/repo/pull/2'
  }];
  writeFileSync(file, JSON.stringify(data));
  const out = execSync(
    `jq -r '.[] | "\\(.number)\\t\\(.repository.nameWithOwner)"' ${file}`
  )
    .toString()
    .trim();
  assert.strictEqual(out, '2\tocto/repo');
});
