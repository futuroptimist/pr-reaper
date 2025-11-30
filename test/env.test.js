import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGhEnvironment } from '../dist/env.js';

test('GH_TOKEN source adds only GH_TOKEN to the environment', () => {
  const baseEnv = { EXISTING: 'value' };
  const env = createGhEnvironment('secret-token', 'GH_TOKEN', baseEnv);

  assert.strictEqual(env.GH_TOKEN, 'secret-token');
  assert.strictEqual(env.GITHUB_TOKEN, undefined);
  assert.strictEqual(env.EXISTING, 'value');
  assert.deepStrictEqual(baseEnv, { EXISTING: 'value' });
});

test('GITHUB_TOKEN source sets both GH_TOKEN and GITHUB_TOKEN', () => {
  const env = createGhEnvironment('shared-token', 'GITHUB_TOKEN', {});

  assert.strictEqual(env.GH_TOKEN, 'shared-token');
  assert.strictEqual(env.GITHUB_TOKEN, 'shared-token');
});

test('createGhEnvironment merges tokens with the provided base environment', () => {
  const baseEnv = { FOO: 'bar', PATH: '/usr/bin' };
  const env = createGhEnvironment('token', 'GH_TOKEN', baseEnv);

  assert.strictEqual(env.FOO, 'bar');
  assert.strictEqual(env.PATH, '/usr/bin');
  assert.strictEqual(env.GH_TOKEN, 'token');
});
