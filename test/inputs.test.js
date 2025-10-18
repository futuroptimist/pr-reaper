import { test } from 'node:test';
import assert from 'node:assert';
import { parseInputs, InputError } from '../dist/inputs.js';

const baseEnv = {
  GH_TOKEN: 'ghp_example',
  GITHUB_ACTOR: 'octocat'
};

const baseInputs = {
  dry_run: 'true',
  author: '',
  org: '',
  title_filter: '',
  delete_branch: 'true',
  limit: '1000',
  comment: 'Closing as superseded by a newer Codex run.',
  exclude_urls: ''
};

function readerFactory(map) {
  return (name) => map[name] ?? '';
}

test('parseInputs falls back to actor when author is blank', () => {
  const { config } = parseInputs(readerFactory(baseInputs), baseEnv);
  assert.strictEqual(config.author, 'octocat');
  assert.strictEqual(config.limit, 1000);
  assert.strictEqual(config.dryRun, true);
});

test('parseInputs respects explicit false booleans', () => {
  const inputs = {
    ...baseInputs,
    dry_run: 'false',
    delete_branch: 'false'
  };
  const { config } = parseInputs(readerFactory(inputs), baseEnv);
  assert.strictEqual(config.dryRun, false);
  assert.strictEqual(config.deleteBranch, false);
});

test('parseInputs throws when limit is out of range', () => {
  const inputs = { ...baseInputs, limit: '2000' };
  assert.throws(
    () => parseInputs(readerFactory(inputs), baseEnv),
    (error) => error instanceof InputError && /limit/i.test(error.message)
  );
});

test('parseInputs requires a token', () => {
  assert.throws(
    () => parseInputs(readerFactory(baseInputs), { ...baseEnv, GH_TOKEN: '', GITHUB_TOKEN: '' }),
    (error) => error instanceof InputError && /must be provided/i.test(error.message)
  );
});

test('parseInputs emits warning when falling back to GITHUB_TOKEN', () => {
  const env = { ...baseEnv, GH_TOKEN: '', GITHUB_TOKEN: 'ghs_example' };
  const { warnings, config } = parseInputs(readerFactory(baseInputs), env);
  assert.strictEqual(config.tokenSource, 'GITHUB_TOKEN');
  assert.ok(warnings.some((warning) => warning.includes('falling back to GITHUB_TOKEN')));
});
