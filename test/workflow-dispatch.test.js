import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const workflowPath = join('.github', 'workflows', 'close-my-open-prs.yml');

test('close PR workflow exposes workflow_dispatch trigger', () => {
  const content = readFileSync(workflowPath, 'utf8');
  assert.match(
    content,
    /\bon:\s*\n\s*workflow_dispatch:/,
    'close-my-open-prs.yml must define workflow_dispatch for manual runs'
  );
});

test('close PR workflow uses inputs context instead of github.event.inputs', () => {
  const content = readFileSync(workflowPath, 'utf8');
  assert.ok(
    !content.includes('github.event.inputs'),
    'use the inputs context to remain compatible with manual dispatch'
  );
});
