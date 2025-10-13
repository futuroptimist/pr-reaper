import { test } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

test('close step progress starts at 1 of N', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'pr-reaper-'));
  const file = join(tmp, 'prs.json');
  const data = [
    {
      number: 7,
      repository: { nameWithOwner: 'octo/repo' },
      title: 'Fix A',
      url: 'https://github.com/octo/repo/pull/7'
    },
    {
      number: 8,
      repository: { nameWithOwner: 'octo/repo' },
      title: 'Fix B',
      url: 'https://github.com/octo/repo/pull/8'
    }
  ];
  writeFileSync(file, JSON.stringify(data));
  const script = [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'TOTAL=2',
    'INDEX=1',
    "while IFS=$'\\t' read -r NUM REPO; do",
    "  PCT=$(awk -v i=\"$INDEX\" -v total=\"$TOTAL\" 'BEGIN { printf \"%.1f\", (i / total) * 100 }')",
    '  echo "[${INDEX}/${TOTAL} - ${PCT}%] Closing ${REPO}#${NUM}"',
    '  INDEX=$((INDEX + 1))',
    `done < <(jq -r '.[] | "\\(.number)\\t\\(.repository.nameWithOwner)"' ${file})`,
    ''
  ].join('\n');
  const scriptPath = join(tmp, 'close.sh');
  writeFileSync(scriptPath, script);
  const out = execSync(`bash ${scriptPath}`)
    .toString()
    .trim()
    .split('\n')[0];
  assert.ok(out.startsWith('[1/2 - '), `expected first progress to start with 1/2, got: ${out}`);
});

test('exclude list filtering mirrors workflow script', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'pr-reaper-'));
  const prsFile = join(tmp, 'prs.json');
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
    }
  ];
  writeFileSync(prsFile, JSON.stringify(prs));

  const workflowPath = join(__dirname, '..', '.github', 'workflows', 'close-my-open-prs.yml');
  const workflowContent = readFileSync(workflowPath, 'utf8');
  const match = workflowContent.match(/python3 - <<'PY'\n([\s\S]*?)\nPY/);
  assert.ok(match, 'exclude filtering python snippet not found');
  const pythonScript = match[1];

  const runScript = (input) => {
    writeFileSync(prsFile, JSON.stringify(prs));
    execSync(`python3 - <<'PY'\n${pythonScript}\nPY`, {
      cwd: tmp,
      env: { ...process.env, EXCLUDE_INPUT_DATA: input },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return JSON.parse(readFileSync(prsFile, 'utf8'));
  };

  const filteredHtml = runScript('https://github.com/octo/repo/pull/2');
  assert.deepStrictEqual(filteredHtml, [prs[0]], 'HTML URL should be excluded');

  const filteredApi = runScript('https://api.github.com/repos/octo/repo/pulls/2');
  assert.deepStrictEqual(filteredApi, [prs[0]], 'API URL should be excluded');
});
