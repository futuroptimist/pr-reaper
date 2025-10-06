import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test('close-my-open-prs workflow supports manual dispatch', () => {
  const workflowPath = join(
    __dirname,
    '..',
    '.github',
    'workflows',
    'close-my-open-prs.yml'
  );
  const workflowContent = readFileSync(workflowPath, 'utf8');

  assert.match(
    workflowContent,
    /\bworkflow_dispatch\s*:/,
    'workflow_dispatch trigger is required'
  );

  const allowedTypes = new Set(['string', 'boolean', 'choice', 'environment']);
  const lines = workflowContent.split(/\r?\n/);

  let dispatchIndent = null;
  let inputsIndent = null;
  let currentInput = null;
  let currentInputIndent = null;
  let foundDispatch = false;
  let foundInputs = false;
  let sawInputsBlock = false;

  for (const line of lines) {
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    const trimmed = line.trim();

    if (!foundDispatch) {
      if (trimmed.startsWith('workflow_dispatch:')) {
        foundDispatch = true;
        dispatchIndent = indent;
      }
      continue;
    }

    if (trimmed === '' && foundDispatch) {
      continue;
    }

    if (dispatchIndent !== null && indent <= dispatchIndent && trimmed !== '') {
      break;
    }

    if (!foundInputs) {
      if (trimmed.startsWith('inputs:')) {
        foundInputs = true;
        sawInputsBlock = true;
        inputsIndent = indent;
      }
      continue;
    }

    if (inputsIndent !== null && indent <= inputsIndent && trimmed !== '') {
      foundInputs = false;
      currentInput = null;
      currentInputIndent = null;
      if (indent <= dispatchIndent) {
        break;
      }
      continue;
    }

    if (trimmed.endsWith(':')) {
      currentInput = trimmed.slice(0, -1);
      currentInputIndent = indent;
      continue;
    }

    if (currentInput && currentInputIndent !== null && indent > currentInputIndent) {
      if (trimmed.startsWith('type:')) {
        const typeValue = trimmed.slice('type:'.length).trim();
        assert.ok(
          allowedTypes.has(typeValue),
          `input "${currentInput}" has unsupported type "${typeValue}"`
        );
      }
    }
  }

  assert.ok(foundDispatch, 'workflow_dispatch section not found');
  assert.ok(sawInputsBlock, 'workflow_dispatch inputs block not found');

  const expectedInputs = [
    'dry_run',
    'author',
    'org',
    'title_filter',
    'delete_branch',
    'limit',
    'comment',
    'exclude_urls'
  ];

  for (const inputName of expectedInputs) {
    const pattern = new RegExp(`\\b${inputName}\\s*:`);
    assert.match(
      workflowContent,
      pattern,
      `workflow_dispatch input "${inputName}" is required`
    );
  }
});
