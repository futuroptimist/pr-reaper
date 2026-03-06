import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GhCli, GhError } from '../dist/gh.js';

class TestGhCli extends GhCli {
  constructor() {
    super();
    this.failuresBeforeSuccess = 0;
    this.execCalls = 0;
    this.sleepCalls = [];
    this.forcedError = null;
    this.nonRetryableError = null;
  }

  async exec() {
    this.execCalls += 1;
    if (this.forcedError) {
      throw this.forcedError;
    }

    if (this.nonRetryableError) {
      throw this.nonRetryableError;
    }

    if (this.execCalls <= this.failuresBeforeSuccess) {
      throw new GhError('too fast', 1, 'GraphQL: was submitted too quickly (addComment)');
    }

    return { stdout: '', stderr: '' };
  }

  async sleep(ms) {
    this.sleepCalls.push(ms);
  }
}

test('closePullRequest retries when addComment is submitted too quickly', async () => {
  const gh = new TestGhCli();
  gh.failuresBeforeSuccess = 2;

  await assert.doesNotReject(() =>
    gh.closePullRequest('democratizedspace/dspace', 3197, 'Closing as superseded.', true)
  );

  assert.equal(gh.execCalls, 3);
  assert.deepEqual(gh.sleepCalls, [1500, 3000]);
});

test('closePullRequest does not retry on non-retryable failures', async () => {
  const gh = new TestGhCli();
  gh.nonRetryableError = new GhError('boom', 1, 'GraphQL: Resource not accessible by integration');

  await assert.rejects(
    () => gh.closePullRequest('democratizedspace/dspace', 3197, 'Closing as superseded.', true),
    /boom/
  );

  assert.equal(gh.execCalls, 1);
  assert.deepEqual(gh.sleepCalls, []);
});

test('closePullRequest stops retrying at max attempts and rethrows the original retryable GhError', async () => {
  const gh = new TestGhCli();
  const retryableError = new GhError('too fast', 1, 'GraphQL: was submitted too quickly (addComment)');
  gh.forcedError = retryableError;

  await assert.rejects(
    () => gh.closePullRequest('democratizedspace/dspace', 3197, 'Closing as superseded.', true),
    (error) => {
      assert.equal(error, retryableError);
      return true;
    }
  );

  assert.equal(gh.execCalls, 3);
  assert.deepEqual(gh.sleepCalls, [1500, 3000]);
});
