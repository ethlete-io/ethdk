import { existsSync, statSync } from 'fs';
import { join } from 'path';
import {
  LEGACY_LOCAL_CONFIG_FILE_NAME,
  LOCAL_CONFIG_FILE_NAME,
  LOCAL_CONFIG_KEYS,
  LocalConfig,
  readLocalConfigFile,
  resolveConfiguredPath,
} from './local-config';

/** Marks a directory as an `ethlete-sdk` checkout rather than some other folder. */
const SDK_CHECKOUT_MARKERS = ['libs/components', 'libs/core', 'libs/agent-rules'];

const quoted = (keys: string[]) => keys.map((key) => `"${key}"`).join(', ');

const describeSdkSourcePath = (options: { root: string; value: unknown; fileName: string }) => {
  const { root, value, fileName } = options;

  if (value === undefined) return [];

  if (typeof value !== 'string' || value.trim().length === 0) {
    return [`${fileName} has an invalid "sdkSourcePath" — use a path to an ethlete-sdk checkout.`];
  }

  const absolute = resolveConfiguredPath(root, value);

  if (!existsSync(absolute)) {
    return [`${fileName} points "sdkSourcePath" at ${absolute}, which does not exist.`];
  }

  if (SDK_CHECKOUT_MARKERS.some((marker) => !existsSync(join(absolute, marker)))) {
    return [`${fileName} points "sdkSourcePath" at ${absolute}, which is not an ethlete-sdk checkout.`];
  }

  return [];
};

const describeApiRepoPaths = (options: { root: string; value: unknown; fileName: string }) => {
  const { root, value, fileName } = options;

  if (value === undefined) return [];

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return [
      `${fileName} has an invalid "apiRepoPaths" value — use an object mapping an app name to its API repo path.`,
    ];
  }

  return Object.entries(value).flatMap(([app, path]) => {
    if (typeof path !== 'string' || path.trim().length === 0) {
      return [`${fileName} has an invalid "apiRepoPaths.${app}" value — use a path to the API repo.`];
    }

    const absolute = resolveConfiguredPath(root, path);

    if (!existsSync(absolute)) {
      return [`${fileName} points "apiRepoPaths.${app}" at ${absolute}, which does not exist.`];
    }

    if (!statSync(absolute).isDirectory()) {
      return [`${fileName} points "apiRepoPaths.${app}" at ${absolute}, which is not a directory.`];
    }

    return [];
  });
};

const describeApiRepoBranches = (options: { value: unknown; fileName: string }) => {
  const { value, fileName } = options;

  if (value === undefined) return [];

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return [
      `${fileName} has an invalid "apiRepoBranches" value — use an object mapping an app name to its expected API branch.`,
    ];
  }

  return Object.entries(value).flatMap(([app, branch]) =>
    typeof branch === 'string' && branch.trim().length > 0
      ? []
      : [`${fileName} has an invalid "apiRepoBranches.${app}" value — use a non-empty branch name.`],
  );
};

const describeValues = (options: { root: string; config: LocalConfig; fileName: string }) => {
  const { root, config, fileName } = options;

  return [
    ...describeSdkSourcePath({ root, value: config.sdkSourcePath, fileName }),
    ...describeApiRepoPaths({ root, value: config.apiRepoPaths, fileName }),
    ...describeApiRepoBranches({ value: config.apiRepoBranches, fileName }),
  ];
};

/**
 * Every problem with the repo topology config: a file that cannot be parsed, a key nothing reads, a
 * checkout that is not there, and values still sitting in the file they moved out of.
 */
export const diagnoseLocalConfig = ({ root }: { root: string }) => {
  const primary = readLocalConfigFile(join(root, LOCAL_CONFIG_FILE_NAME));

  if (primary.status === 'unreadable') return [`${LOCAL_CONFIG_FILE_NAME} is not valid JSON.`];

  if (primary.status === 'not-an-object') return [`${LOCAL_CONFIG_FILE_NAME} is not a JSON object.`];

  if (primary.status === 'ok') {
    const unknownKeys = Object.keys(primary.config).filter(
      (key) => !LOCAL_CONFIG_KEYS.includes(key as keyof LocalConfig),
    );

    return [
      ...(unknownKeys.length > 0
        ? [
            `${LOCAL_CONFIG_FILE_NAME} contains key(s) nothing reads: ${quoted(unknownKeys)} — it supports ${quoted(
              LOCAL_CONFIG_KEYS,
            )}.`,
          ]
        : []),
      ...describeValues({ root, config: primary.config, fileName: LOCAL_CONFIG_FILE_NAME }),
    ];
  }

  const legacy = readLocalConfigFile(join(root, LEGACY_LOCAL_CONFIG_FILE_NAME));

  if (legacy.status !== 'ok') return [];

  const held = LOCAL_CONFIG_KEYS.filter((key) => legacy.config[key] !== undefined);

  if (held.length === 0) return [];

  return [
    `${LEGACY_LOCAL_CONFIG_FILE_NAME} still holds ${quoted(held)} — move ${
      held.length === 1 ? 'it' : 'them'
    } to ${LOCAL_CONFIG_FILE_NAME}.`,
    ...describeValues({ root, config: legacy.config, fileName: LEGACY_LOCAL_CONFIG_FILE_NAME }),
  ];
};
