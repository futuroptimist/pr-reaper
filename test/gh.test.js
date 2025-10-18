import { test } from 'node:test';
import assert from 'node:assert';
import { GhCli, GhError } from '../dist/gh.js';

function createSearchOptions() {
  return {
    author: 'octocat',
    limit: 1,
    org: null,
    titleFilter: null
  };
}

test('searchPullRequests falls back when permalink field is unavailable', async () => {
  const cli = new GhCli();
  const calls = [];
  let attempt = 0;

  cli.exec = async function exec(args) {
    calls.push(args);
    attempt += 1;

    if (attempt === 1) {
      throw new GhError(
        'Unknown JSON field: "permalink"',
        1,
        'Unknown JSON field: "permalink"'
      );
    }

    assert.deepStrictEqual(
      args.slice(-2),
      ['--json', 'number,repository,title,url'],
      'Expected fallback request without permalink field'
    );

    return {
      stdout: JSON.stringify([
        {
          number: 42,
          repository: { nameWithOwner: 'octo/repo' },
          title: 'Fix all the bugs',
          url: 'https://github.com/octo/repo/pull/42'
        }
      ]),
      stderr: ''
    };
  };

  const results = await cli.searchPullRequests(createSearchOptions());

  assert.strictEqual(attempt, 2, 'Expected fallback attempt after JSON field error');
  assert.deepStrictEqual(
    calls[0].slice(-2),
    ['--json', 'number,permalink,repository,title,url'],
    'Expected initial request to include permalink field'
  );
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].permalink, 'https://github.com/octo/repo/pull/42');
});
