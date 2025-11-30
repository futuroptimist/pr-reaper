import * as core from '@actions/core';
import { GhCli } from './gh.js';
import { parseInputs, InputError } from './inputs.js';
import { runReaper } from './reap.js';

async function main(): Promise<void> {
  try {
    const { config, warnings } = parseInputs();
    for (const warning of warnings) {
      core.warning(warning);
    }

    const gh = new GhCli({ env: { ...process.env, GH_TOKEN: config.token } });
    await runReaper({ inputs: config, gh });
  } catch (error) {
    if (error instanceof InputError) {
      core.setFailed(error.message);
      return;
    }
    if (error instanceof Error) {
      core.setFailed(error.message);
      return;
    }
    core.setFailed('Unexpected error occurred.');
  }
}

void main();
