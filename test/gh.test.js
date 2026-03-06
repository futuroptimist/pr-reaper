import { test } from 'node:test';
import assert from 'node:assert';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GhCli, GhError } from '../dist/gh.js';

function createFakeGhScript(scriptBody) {
  const dir = mkdtempSync(join(tmpdir(), 'pr-reaper-gh-'));
  const ghPath = join(dir, 'gh');
  writeFileSync(ghPath, `#!/usr/bin/env node\n${scriptBody}\n`, 'utf8');
  chmodSync(ghPath, 0o755);
  return dir;
}

test('closePullRequest retries when GitHub reports addComment submitted too quickly', async () => {
  const attemptsPath = join(mkdtempSync(join(tmpdir(), 'pr-reaper-attempts-')), 'attempts.txt');
  const fakeGhDir = createFakeGhScript(`
const fs = require('node:fs');
const path = process.env.ATTEMPTS_PATH;
const next = (Number(fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '0') + 1);
fs.writeFileSync(path, String(next));
if (next < 3) {
  console.error('GraphQL: was submitted too quickly (addComment)');
  process.exit(1);
}
process.stdout.write('closed');
`);

  const gh = new GhCli({
    env: {
      ...process.env,
      ATTEMPTS_PATH: attemptsPath,
      PATH: `${fakeGhDir}:${process.env.PATH}`
    }
  });

  await assert.doesNotReject(() =>
    gh.closePullRequest('democratizedspace/dspace', 3197, 'Closing old PR', true)
  );

  assert.strictEqual(readFileSync(attemptsPath, 'utf8'), '3');
});

test('closePullRequest throws when retriable error persists past retry budget', async () => {
  const fakeGhDir = createFakeGhScript(`
console.error('GraphQL: was submitted too quickly (addComment)');
process.exit(1);
`);

  const gh = new GhCli({
    env: {
      ...process.env,
      PATH: `${fakeGhDir}:${process.env.PATH}`
    }
  });

  await assert.rejects(
    () => gh.closePullRequest('democratizedspace/dspace', 3197, 'Closing old PR', false),
    (error) => error instanceof GhError && /submitted too quickly/i.test(error.stderr)
  );
});
