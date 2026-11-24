import { existsSync, readFileSync } from 'fs';
import { basename, dirname, resolve } from 'path';
import { DesignConfig, DesignProduct } from '../design-config';
import { assetRoot } from '../package-root';
import { Problem } from './problem';

/** A product folder together with its entry in the `config.json` that declares it. */
export type ProductSource = { name: string; dir: string; config: DesignProduct; configFile: string };

const BUILT_IN_BASES: Record<string, { installed: string; fallback: string }> = {
  '@ethlete/components': {
    installed: 'node_modules/@ethlete/components/design/sdk',
    fallback: 'systems/ethlete-components',
  },
};

export const isBuiltInBase = (base: string) => base in BUILT_IN_BASES;

const installedAbove = (dir: string, installed: string): string | null => {
  const candidate = resolve(dir, installed);

  if (existsSync(candidate)) return candidate;

  const parent = dirname(dir);

  return parent === dir ? null : installedAbove(parent, installed);
};

/** The folder of `base`: for a built-in base the design system its installed package ships, else the CLI's own stand-in. */
export const baseDirOf = (options: { target: string; base: string }) => {
  const builtIn = BUILT_IN_BASES[options.base];

  if (!builtIn) return resolve(options.target, options.base);

  return installedAbove(resolve(options.target), builtIn.installed) ?? resolve(assetRoot(), builtIn.fallback);
};

const configFileAbove = (dir: string): string | null => {
  const file = resolve(dir, 'config.json');

  if (existsSync(file)) return file;

  const parent = dirname(dir);

  return parent === dir ? null : configFileAbove(parent);
};

/**
 * The base a product extends. Its settings come from the `config.json` of the workspace that
 * holds the base folder, under the folder's own name.
 */
export const loadBase = (options: { target: string; base: string; configFile: string }) => {
  const { target, base, configFile } = options;
  const dir = baseDirOf({ target, base });
  const problem = (message: string) => ({ base: null, problems: [{ rule: 'BASE', file: configFile, message }] });

  if (!existsSync(dir)) return problem(`base "${base}" is no folder (${dir})`);

  const baseConfigFile = configFileAbove(dirname(dir));

  if (!baseConfigFile) return problem(`base "${base}" lies in no folder with a config.json`);

  const name = basename(dir);
  const config = (JSON.parse(readFileSync(baseConfigFile, 'utf8')) as DesignConfig).products?.[name];

  if (!config) return problem(`base "${base}": ${baseConfigFile} declares no product "${name}"`);
  if (config.base) return problem(`base "${base}" extends "${config.base}", but a base has no base of its own`);

  const source: ProductSource = { name, dir, config, configFile: baseConfigFile };
  const problems: Problem[] = [];

  return { base: source, problems };
};
