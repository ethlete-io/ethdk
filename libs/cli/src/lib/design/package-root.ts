import { cpSync, existsSync, readdirSync, realpathSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'path';
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

const realOf = (path: string): string => {
  if (existsSync(path)) return realpathSync(path);

  const parent = dirname(path);

  return parent === path ? path : join(realOf(parent), basename(path));
};

const isInside = (path: string, dir: string) => {
  const inside = relative(realOf(dir), realOf(path));

  return inside === '' || (!inside.startsWith('..') && !isAbsolute(inside));
};

const checkoutPackageAssetRootOf = (target: string): string | null => {
  for (let dir = target; ; dir = dirname(dir)) {
    const root = resolve(dir, 'node_modules/@ethlete/cli/design');

    if (existsSync(resolve(root, 'define-part.ts'))) return realpathSync(root);
    if (dirname(dir) === dir) return null;
  }
};

/**
 * The `design` folder a gitignored editor tsconfig of `target` points at: the `@ethlete/cli` the checkout
 * installs, else this package unless it runs from a temporary build (under the checkout's `tmp/`, the OS temp
 * folder or the work root), whose folder may be gone by the time the editor reads the config. `null` if neither.
 */
export const editorAssetRootOf = (target: string, running = installedAssetRoot()) => {
  const installed = checkoutPackageAssetRootOf(target);

  if (installed) return installed;

  const transient = [resolve(target, 'tmp'), tmpdir(), workRootOf(target)].some((dir) => isInside(running, dir));

  return transient ? null : running;
};

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
