import { existsSync, readFileSync } from 'fs';
import { isAbsolute, join, resolve } from 'path';

export const LOCAL_CONFIG_FILE_NAME = 'ethlete.config.local.json';

/**
 * The file these keys lived in before they moved to `ethlete.config.local.json`. Still read as a
 * fallback so an existing checkout keeps working, and reported so the developer can move them.
 */
export const LEGACY_LOCAL_CONFIG_FILE_NAME = 'ethlete-agents.config.local.json';

/**
 * Machine-local repo topology: where the sibling checkouts this repo works with live. The file is
 * gitignored, so every value is per-machine and never changes what anyone else sees.
 */
export type LocalConfig = {
  /** Path to a local `ethlete-sdk` checkout, for reading its source or building it into this repo. */
  sdkSourcePath?: string;
  /** Path to the checkout of the API an app talks to, keyed by app name. `"*"` matches any app. */
  apiRepoPaths?: Record<string, string>;
  /** Branch that represents each API's deployed state, keyed by app name. `"*"` matches any app. */
  apiRepoBranches?: Record<string, string>;
};

export type LocalConfigSource = {
  config: LocalConfig;
  /** The file the values came from, or `undefined` when neither file exists. */
  fileName?: string;
  /** True when the values came from `LEGACY_LOCAL_CONFIG_FILE_NAME`. */
  isLegacy: boolean;
};

const readJsonObject = (path: string): LocalConfig | undefined => {
  if (!existsSync(path)) return undefined;

  let parsed: unknown;

  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return undefined;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined;

  return parsed as LocalConfig;
};

/** Reads the local config, falling back to the file the keys used to live in. */
export const readLocalConfig = (root: string): LocalConfigSource => {
  const current = readJsonObject(join(root, LOCAL_CONFIG_FILE_NAME));

  if (current) return { config: current, fileName: LOCAL_CONFIG_FILE_NAME, isLegacy: false };

  const legacy = readJsonObject(join(root, LEGACY_LOCAL_CONFIG_FILE_NAME));

  if (legacy) return { config: legacy, fileName: LEGACY_LOCAL_CONFIG_FILE_NAME, isLegacy: true };

  return { config: {}, isLegacy: false };
};

const entryFor = (record: Record<string, string> | undefined, key: string) => record?.[key] ?? record?.['*'];

export const configuredApiRepoPath = (config: LocalConfig, api: string) => entryFor(config.apiRepoPaths, api);

export const configuredApiRepoBranch = (config: LocalConfig, api: string) => entryFor(config.apiRepoBranches, api);

/** Resolves a configured path against the repo root, so a relative path in the file works. */
export const resolveConfiguredPath = (root: string, configured: string) =>
  isAbsolute(configured) ? configured : resolve(root, configured);
