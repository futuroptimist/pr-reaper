import { test } from 'node:test';
import assert from 'node:assert';
import { GhCli, GhError } from '../dist/gh.js';

test('isTransientCloseError returns true for GraphQL comment throttling errors', () => {
  const error = new GhError(
    'Command failed',
    1,
    'GraphQL: was submitted too quickly (addComment)'
  );

  assert.strictEqual(GhCli.isTransientCloseError(error), true);
});

test('isTransientCloseError returns false for non-throttling errors', () => {
  const error = new GhError('Command failed', 1, 'GraphQL: some other failure');

  assert.strictEqual(GhCli.isTransientCloseError(error), false);
});
