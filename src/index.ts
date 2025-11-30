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

    const tokenEnv =
      config.tokenSource === 'GH_TOKEN'
        ? { GH_TOKEN: config.token }
        : { GH_TOKEN: config.token, GITHUB_TOKEN: config.token };

    const ghEnv = { ...process.env, ...tokenEnv };
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
