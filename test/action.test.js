import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const actionPath = new URL('../action.yml', import.meta.url);
const actionSource = readFileSync(actionPath, 'utf8');
const action = parse(actionSource);

function getRunStep() {
  const steps = action?.runs?.steps;
  if (!Array.isArray(steps)) {
    return null;
  }
  return steps.find((step) => step?.id === 'run') ?? null;
}

test('composite action forwards inputs as environment variables', () => {
  const runStep = getRunStep();
  assert.ok(runStep, 'Expected to find step with id "run".');
  const env = runStep.env;
  assert.ok(env, 'Expected run step to define env mappings.');

  const expectedEnv = new Map([
    ['INPUT_DRY_RUN', "${{ inputs.dry_run }}"],
    ['INPUT_AUTHOR', "${{ inputs.author }}"],
    ['INPUT_ORG', "${{ inputs.org }}"],
    ['INPUT_TITLE_FILTER', "${{ inputs.title_filter }}"],
    ['INPUT_DELETE_BRANCH', "${{ inputs.delete_branch }}"],
    ['INPUT_LIMIT', "${{ inputs.limit }}"],
    ['INPUT_COMMENT', "${{ inputs.comment }}"],
    ['INPUT_EXCLUDE_URLS', "${{ inputs.exclude_urls }}"]
  ]);

  for (const [key, value] of expectedEnv.entries()) {
    assert.strictEqual(env?.[key], value, `Expected env ${key} to equal ${value}`);
  }
});
