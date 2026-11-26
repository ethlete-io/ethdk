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

const QUEUED_EXIT = 3;

/** The line and exit code of a run whose Studio registration ended with `status`: a queued run stays green, a run Studio refused fails. */
export const registrationOutcomeOf = (status) => {
  if (status === 0) return { line: 'client-run: registered in Studio', exitCode: 0 };

  if (status === QUEUED_EXIT) {
    return {
      line: 'client-run: Studio is not running - the run is queued and appears at the next Studio start',
      exitCode: 0,
    };
  }

  return {
    line: `client-run: Studio did not take the run (exit ${status}); open Studio, then run \`et design studio open <run>/tomflix\``,
    exitCode: 1,
  };
};
