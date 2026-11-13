import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';

/** Where every repository keeps its design work. The layout is convention, not configuration. */
export const DESIGN_DIR = '.ethlete/design';

/** Where the design tools keep their gitignored per-product state, beside {@link DESIGN_DIR}. */
export const CACHE_DIR = '.ethlete/cache';

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

/**
 * The Angular app that serves a product's design harness, the part map `et design harness` writes into it, and the
 * app files the design shares with the app (`shared`, files or `<folder>/**`): a part may import them and a task may
 * change them. `live` is the JSON file that `et design compare --live` opens the app's real pages with. All repo paths
 * inside `app`.
 */
export type DesignHarness = {
  app: string;
  map: string;
  shared?: string[];
  live?: string;
  /** Accessible names (whitespace removed) of the app's shared host components, which the action check skips. */
  hosts?: string[];
  /** The vitest config of the app's specs; `APP-SPEC` runs the specs related to each part's app files with it. */
  specs?: string;
  /** The branch `check --visible-change` compares with at its merge base; the branch `origin/HEAD` names when left out. */
  baseBranch?: string;
};

/**
 * One product's design system: the render settings of a project, the product folder it extends
 * (`base`, a path from the checkout root, or `@ethlete/components`), its viewport presets, and the
 * parts (`<layer>/<name>`) whose stylesheets every frame draws under, in order (`tokens`,
 * `['foundations/tokens']` when left out).
 */
/** The language of a product's UI, and so of the notes its sketches carry. */
export type DesignNoteLanguage = 'de' | 'en';

export type DesignProduct = DesignProject & {
  /** The language sketch round and variant notes are written in; `sketch check` warns on a note in another one. */
  noteLanguage?: DesignNoteLanguage;
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
  /** `'deny'` makes `et design check` fail on a native `title` attribute in the design markup; off when left out. */
  nativeTitle?: 'deny';
  /** `'deny'` makes `et design check` fail on command text in a drawing or an app template; off when left out. */
  commandText?: 'deny';
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

export const readConfig = (target: string): DesignConfig | null => {
  const path = configPathOf(target);

  if (!existsSync(path)) return null;

  return JSON.parse(readFileSync(path, 'utf8')) as DesignConfig;
};

export const portOf = (config: DesignConfig) => Number(process.env['DE_PORT']) || config.port || DEFAULT_PORT;
