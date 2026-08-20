import { existsSync, statSync } from 'fs';
import { join } from 'path';
import {
  LEGACY_LOCAL_CONFIG_FILE_NAME,
  LOCAL_CONFIG_FILE_NAME,
  configuredApiRepoPath,
  readLocalConfig,
  resolveConfiguredPath,
} from '../config/local-config';
import { ApiDefinition } from './definition';

export type ApiCheckout = {
  repoPath: string;
  /** The directory the compose commands run in. */
  composePath: string;
};

/**
 * `legacyConfigWarning` is set on failure too. A wrong path is exactly when the developer needs to
 * know which file the value actually came from.
 */
export type ApiCheckoutResult = { legacyConfigWarning?: string } & (
  { ok: true; checkout: ApiCheckout } | { ok: false; problem: string }
);

const isDirectory = (path: string) => existsSync(path) && statSync(path).isDirectory();

const missingPathProblem = (options: { name: string; api: ApiDefinition; reason: string }) => {
  const { name, api, reason } = options;

  return (
    `${reason}\n\nAdd the path of your ${name} API checkout to ${LOCAL_CONFIG_FILE_NAME} in the repo ` +
    `root. The file is gitignored, so it changes nothing for anyone else:\n\n` +
    `  {\n    "apiRepoPaths": {\n      "${name}": "${api.examplePath ?? `../${name}-api`}"\n    }\n  }`
  );
};

/** Resolves where an API's containers live, with the one message that explains each way it can fail. */
export const resolveApiCheckout = (options: {
  root: string;
  name: string;
  api: ApiDefinition;
  /** The git commands run before `make setup`, so they must not demand its output. */
  requireEnvFile?: boolean;
}): ApiCheckoutResult => {
  const { root, name, api, requireEnvFile = true } = options;
  const { config, fileName, isLegacy } = readLocalConfig(root);
  const configured = configuredApiRepoPath(config, name);
  const legacyConfigWarning = isLegacy
    ? `${LEGACY_LOCAL_CONFIG_FILE_NAME} still holds "apiRepoPaths". Move it to ${LOCAL_CONFIG_FILE_NAME}.`
    : undefined;

  if (!configured) {
    return {
      ok: false,
      legacyConfigWarning,
      problem: missingPathProblem({
        name,
        api,
        reason: fileName
          ? `${fileName} has no apiRepoPaths entry for "${name}".`
          : `${LOCAL_CONFIG_FILE_NAME} does not exist.`,
      }),
    };
  }

  const repoPath = resolveConfiguredPath(root, configured);

  if (!isDirectory(repoPath)) {
    return {
      ok: false,
      legacyConfigWarning,
      problem: `apiRepoPaths.${name} points at ${repoPath}, which is not a directory that exists.`,
    };
  }

  const composePath = join(repoPath, api.composeDir);

  if (!isDirectory(composePath)) {
    return {
      ok: false,
      legacyConfigWarning,
      problem: `${repoPath} has no ${api.composeDir} directory. Is apiRepoPaths.${name} the right checkout?`,
    };
  }

  if (requireEnvFile && api.envFile && !existsSync(join(composePath, api.envFile))) {
    return {
      ok: false,
      legacyConfigWarning,
      problem: `Missing ${api.envFile} in ${composePath}.${
        api.setupCommand ? ` Run "${api.setupCommand}" there first.` : ''
      }`,
    };
  }

  return { ok: true, legacyConfigWarning, checkout: { repoPath, composePath } };
};
