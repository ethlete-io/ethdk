import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

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

export type DesignConfig = {
  port?: number;
  defaultCall?: string;
  render?: DesignRenderConfig;
  projects?: Record<string, DesignProject>;
};

export const DEFAULT_PORT = 4402;

/**
 * The package's own `design` folder, which carries the frame page and the authoring API. It sits
 * three levels above this file both in the source tree and in the build output.
 */
export const assetRoot = () => resolve(__dirname, '../../../design');

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
