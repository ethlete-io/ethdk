import { cpSync, existsSync, readdirSync, rmSync } from 'fs';
import { relative, resolve } from 'path';
import { isRunning } from './is-running';
import { workRootOf } from './work-root';

const builtRoot = resolve(__dirname, '../../..');
let packageRoot = builtRoot;

/**
 * The package's own `design` folder, which carries the frame page and the authoring API. Inside a
 * running server, the copy `snapshotPackage` made.
 */
export const assetRoot = () => resolve(packageRoot, 'design');

/** The `design` folder where the package is installed, for configs that outlive this process. */
export const installedAssetRoot = () => resolve(builtRoot, 'design');

/** Where a file of this package is read from: its copy in the server's snapshot, once one is taken. */
export const packageFileOf = (file: string) => resolve(packageRoot, relative(builtRoot, file));

/**
 * Copies this package's code and frame assets into a folder owned by this process and reads them
 * from there until it exits, so a rebuild of the package cannot change what a running server
 * serves or what its render worker loads. Returns the folder.
 */
export const snapshotPackage = (target: string) => {
  const root = workRootOf(target);
  const dir = resolve(root, `server-${process.pid}`);

  for (const name of existsSync(root) ? readdirSync(root) : []) {
    const pid = Number(/^server-(\d+)$/.exec(name)?.[1]);

    if (pid && !isRunning(pid)) rmSync(resolve(root, name), { recursive: true, force: true });
  }

  rmSync(dir, { recursive: true, force: true });

  for (const entry of ['package.json', 'src', 'design']) {
    cpSync(resolve(builtRoot, entry), resolve(dir, entry), { recursive: true });
  }

  if (packageRoot === builtRoot) process.once('exit', () => rmSync(packageRoot, { recursive: true, force: true }));

  packageRoot = dir;

  return dir;
};
