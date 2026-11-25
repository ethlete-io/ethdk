import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

/** Adds the checkout to the running Studio through `et design studio open`, the way "Projekt öffnen…" keeps it. Returns the exit status. */
export const registerInStudio = ({ target, spawn = spawnSync }) => {
  const result = spawn(
    'node',
    [join(target, 'node_modules/@ethlete/cli/src/index.js'), 'design', 'studio', 'open', target],
    {
      cwd: target,
      stdio: 'inherit',
      env: { ...process.env, CLEAN_SLATE_SANDBOX: '' },
    },
  );
  return result.status;
};

/** The line and exit code of a run whose Studio registration ended with `status`: a run Studio did not take fails. */
export const registrationOutcomeOf = (status) =>
  status === 0
    ? { line: 'client-run: registered in Studio', exitCode: 0 }
    : {
        line: `client-run: Studio did not take the run (exit ${status}); open Studio, then run \`et design studio open <run>/tomflix\``,
        exitCode: 1,
      };
