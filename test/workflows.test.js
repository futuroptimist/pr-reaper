import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const workflows = [
  { path: '.github/workflows/ci.yml', name: 'CI' },
  { path: '.github/workflows/close-my-open-prs.yml', name: 'Close my open PRs' }
];

for (const { path, name } of workflows) {
  test(`${name} workflow exposes workflow_dispatch trigger`, () => {
    const contents = readFileSync(path, 'utf8');
    const hasDispatch = contents
      .split(/\r?\n/)
      .some(line => {
        const trimmed = line.trim();
        return trimmed.startsWith('workflow_dispatch:') && !trimmed.startsWith('#');
      });

    assert.ok(hasDispatch, `${name} workflow must support manual dispatch`);
  });
}
