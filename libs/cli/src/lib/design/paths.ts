import { cpSync, existsSync, readdirSync, readFileSync, rmSync } from 'fs';
import { dirname, relative, resolve } from 'path';

/** Where every repository keeps its design work. The layout is convention, not configuration. */
export const DESIGN_DIR = '.ethlete/design';

/**
 * One project's drawing environment: the stylesheets a frame loads, the markup it puts in `<head>`,
 * the module whose default export is the Angular providers array `ng()` renders under, and the
 * surface and colour theme names a call can be drawn under. The first name of each list is the default.
 */
export type DesignProject = {
  styles?: string[];
  head?: string;
  providers?: string;
  themes?: DesignThemes;
};

export type DesignThemes = {
  surface?: string[];
  color?: string[];
};

/**
 * Where `ng()` takes its code from. `packages` maps a package pattern to a checkout path, for
 * example `{ "@ethlete/*": "dist/libs/*" }`; a drawing's subpath imports such as
 * `@ethlete/core/design/theme-css` load from the mapped folder too. `modules` names the packages an
 * import name is looked up in, `['@ethlete/components', '@ethlete/core']` when left out.
 */
export type DesignRenderConfig = {
  packages?: Record<string, string>;
  modules?: string[];
};

/** A viewport a product's parts are drawn at. Without a height, the frame grows with its content. */
export type DesignPreset = { width: number; height?: number };

/**
 * One product's design system: the render settings of a project, the product folder it extends
 * (`base`, a path from the checkout root, or `@ethlete/components`), and its viewport presets.
 */
export type DesignProduct = DesignProject & {
  base?: string;
  presets?: Record<string, DesignPreset>;
};

export type DesignConfig = {
  port?: number;
  defaultCall?: string;
  render?: DesignRenderConfig;
  projects?: Record<string, DesignProject>;
  products?: Record<string, DesignProduct>;
};

export const DEFAULT_PORT = 4402;

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

const isRunning = (pid: number) => {
  try {
    process.kill(pid, 0);

    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
};

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

/** The nearest folder at or above `start` that holds a design config, as git finds its repository. Falls back to `start`. */
export const findCheckoutRoot = (start: string) => {
  let dir = resolve(start);

  for (;;) {
    if (existsSync(resolve(dir, DESIGN_DIR, 'config.json'))) return dir;

    const parent = dirname(dir);

    if (parent === dir) return resolve(start);

    dir = parent;
  }
};

export const configPathOf = (target: string) => resolve(target, DESIGN_DIR, 'config.json');

export const callsRootOf = (target: string) => resolve(target, DESIGN_DIR, 'calls');

/** Everything the tool writes for a checkout, so nothing generated lands in tracked files. */
export const workRootOf = (target: string) => resolve(target, 'node_modules/.design-explore');

export const readConfig = (target: string): DesignConfig | null => {
  const path = configPathOf(target);

  if (!existsSync(path)) return null;

  return JSON.parse(readFileSync(path, 'utf8')) as DesignConfig;
};

export const portOf = (config: DesignConfig) => Number(process.env['DE_PORT']) || config.port || DEFAULT_PORT;
