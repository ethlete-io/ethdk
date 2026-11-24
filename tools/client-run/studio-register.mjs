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
