import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

export type SetupRequest = {
  /** The API's own `setupCommand`, for example `make setup`. */
  setupCommand: string;
  /** Directory the command runs in, which is the API's compose directory. */
  composePath: string;
  /** The API's `envFile`, when it declares one. */
  envFile?: string;
};

/**
 * Runs the API's own setup command in its compose directory, on the host rather than in a container.
 * The command's output is kept back and only printed when it fails, so its own hints about the
 * checkout's Makefile do not compete with the CLI. A command that exits 0 without creating `envFile`
 * still fails here, so a caller that re-runs the original command afterwards cannot loop.
 */
export const runApiSetup = ({ setupCommand, composePath, envFile }: SetupRequest) => {
  const envPath = envFile === undefined ? undefined : join(composePath, envFile);
  const existedBefore = envPath !== undefined && existsSync(envPath);

  console.log(`Running "${setupCommand}" in ${composePath}.`);

  const result = spawnSync(setupCommand, { cwd: composePath, shell: true, encoding: 'utf8' });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
  const status = result.status ?? 1;

  const fail = (reason: string) => {
    if (output) console.error(output);

    console.error(reason);

    return status === 0 ? 1 : status;
  };

  if (result.error) return fail(result.error.message);

  if (status !== 0) return fail(`"${setupCommand}" failed with exit code ${status}.`);

  if (envPath !== undefined && !existsSync(envPath)) {
    return fail(`"${setupCommand}" ran, but ${envFile} still does not exist in ${composePath}.`);
  }

  if (envFile === undefined) console.log(`"${setupCommand}" finished.`);
  else console.log(existedBefore ? `${envFile} already existed.` : `Created ${envFile}.`);

  return 0;
};
