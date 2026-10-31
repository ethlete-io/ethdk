import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { basename, dirname, relative, resolve } from 'path';

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

export type DesignColorScheme = 'light' | 'dark';

/** A viewport a product's parts are drawn at. Without a height, the frame grows with its content. */
export type DesignPreset = { width: number; height?: number };

/** The Angular app that serves a product's design harness, and the part map `et design harness` writes into it; repo paths. */
export type DesignHarness = { app: string; map: string };

/**
 * One product's design system: the render settings of a project, the product folder it extends
 * (`base`, a path from the checkout root, or `@ethlete/components`), its viewport presets, and the
 * parts (`<layer>/<name>`) whose stylesheets every frame draws under, in order (`tokens`,
 * `['foundations/tokens']` when left out).
 */
export type DesignProduct = DesignProject & {
  base?: string;
  presets?: Record<string, DesignPreset>;
  /** The colour schemes the product draws, each a copy of every frame; both when left out. */
  schemes?: DesignColorScheme[];
  tokens?: string[];
  /** Inherited parts to omit; a product's own part with the same key remains visible. */
  hideBaseParts?: string[];
  generated?: DesignGeneratedStylesheets[];
  /** Files, relative to the product folder, that a generator owns; a part hash skips them. */
  generatedFiles?: string[];
  harness?: DesignHarness;
  /** Classes and `var()` references the product's parts must not use, each with the fix `et design check` prints. */
  deniedClasses?: DesignDeniedClass[];
};

/** A regular expression a class or a `var(--name)` reference is tested against, and the fix for a match. */
export type DesignDeniedClass = { pattern: string; fix: string };

/**
 * Stylesheets a command generates from one part's stylesheet. A frame of a sketch variant that changes `part`
 * runs `command` (checkout-relative, from the checkout root) with `--part <the variant's part stylesheet>
 * --out <folder>` and loads each of `stylesheets` from `<folder>/<its checkout path>` instead.
 */
export type DesignGeneratedStylesheets = {
  part: string;
  command: string[];
  stylesheets: string[];
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

/** A Vite cache folder of its own per checkout, so two servers sharing a symlinked `node_modules` never rewrite each other's deps. */
export const viteCacheOf = (target: string, name: string) =>
  resolve(workRootOf(target), `${name}-${createHash('sha1').update(resolve(target)).digest('hex').slice(0, 10)}`);

const holdsLock = (lock: string) => {
  try {
    writeFileSync(lock, String(process.pid), { flag: 'wx' });

    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }

  const holder = existsSync(lock) ? Number(readFileSync(lock, 'utf8')) : 0;

  if (holder && isRunning(holder)) return false;

  rmSync(lock, { force: true });

  return holdsLock(lock);
};

let claims = 0;
const claimed = new Set<() => void>();
let exitHooked = false;

/**
 * A Vite cache folder that no other running server writes to: the shared `name` folder while this
 * server holds its lock, else a folder of its own that `release` removes. Only one server at a time
 * keeps the optimized deps between runs, so two at once never rewrite each other's.
 */
export const claimViteCache = (target: string, name: string) => {
  const shared = viteCacheOf(target, name);
  const root = dirname(shared);
  const lock = `${shared}.lock`;
  const own = new RegExp(`^${basename(shared)}-(\\d+)-\\d+$`);

  mkdirSync(root, { recursive: true });

  for (const entry of readdirSync(root)) {
    const pid = Number(own.exec(entry)?.[1]);

    if (pid && !isRunning(pid)) rmSync(resolve(root, entry), { recursive: true, force: true });
  }

  const dir = holdsLock(lock) ? shared : `${shared}-${process.pid}-${(claims += 1)}`;
  const release = () => {
    if (!claimed.delete(release)) return;
    rmSync(dir === shared ? lock : dir, { recursive: true, force: true });
  };

  if (!exitHooked) {
    exitHooked = true;
    process.once('exit', () => [...claimed].forEach((held) => held()));
  }
  claimed.add(release);

  return { dir, release };
};

export const readConfig = (target: string): DesignConfig | null => {
  const path = configPathOf(target);

  if (!existsSync(path)) return null;

  return JSON.parse(readFileSync(path, 'utf8')) as DesignConfig;
};

export const portOf = (config: DesignConfig) => Number(process.env['DE_PORT']) || config.port || DEFAULT_PORT;
