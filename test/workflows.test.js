import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const workflowPath = new URL('../.github/workflows/close-my-open-prs.yml', import.meta.url);
const workflowSource = readFileSync(workflowPath, 'utf8');
const permissionsMarker = workflowSource.indexOf('\npermissions:');
const headerSource = permissionsMarker === -1
  ? workflowSource
  : workflowSource.slice(0, permissionsMarker);
const workflow = parse(headerSource);

test('close-my-open-prs workflow supports manual dispatch', () => {
  assert.ok(
    workflow?.on?.workflow_dispatch,
    'Expected close-my-open-prs workflow to define workflow_dispatch.'
  );
});

test('close-my-open-prs workflow uses supported input types', () => {
  const inputs = workflow?.on?.workflow_dispatch?.inputs ?? {};
  const allowedTypes = new Set(['boolean', 'choice', 'environment', 'string']);

  for (const [name, config] of Object.entries(inputs)) {
    if (Object.prototype.hasOwnProperty.call(config, 'type')) {
      assert.ok(
        allowedTypes.has(config.type),
        `Unsupported workflow_dispatch input type "${config.type}" for "${name}".`
      );
    }
  }
});
