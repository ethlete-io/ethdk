import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

/** Where every repository keeps its design work. The layout is convention, not configuration. */
export const DESIGN_DIR = '.ethlete/design';

/** One project's drawing environment: the stylesheets a frame loads, and the markup it puts in `<head>`. */
export type DesignProject = {
  styles?: string[];
  head?: string;
};

export type DesignConfig = {
  port?: number;
  defaultCall?: string;
  projects?: Record<string, DesignProject>;
};

export const DEFAULT_PORT = 4402;

/**
 * The package's own `design` folder, which carries the web pages and the authoring API. It sits
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
