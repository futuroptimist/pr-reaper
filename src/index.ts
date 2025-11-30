import * as core from '@actions/core';
import { GhCli } from './gh.js';
import { parseInputs, InputError } from './inputs.js';
import { runReaper } from './reap.js';
import { createGhEnvironment } from './env.js';

async function main(): Promise<void> {
  try {
    const { config, warnings } = parseInputs();
    for (const warning of warnings) {
      core.warning(warning);
    }

    const ghEnv = createGhEnvironment(config.token);
    const gh = new GhCli({ env: ghEnv });
    await runReaper({ inputs: config, gh, env: ghEnv });
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
