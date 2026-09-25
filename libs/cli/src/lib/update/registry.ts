import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { PackageManagerName } from './package-manager';
import { prereleaseTag } from './semver';

const TIMEOUT_MS = 15_000;

export const DEFAULT_REGISTRY = 'https://registry.npmjs.org';

export type RegistryPackage = {
  distTags: Record<string, string>;
  versions: string[];
};

export type RegistryLookup = { ok: true; package: RegistryPackage } | { ok: false; reason: string };

const SCOPE = '@ethlete';

type RegistryConfig = { scoped?: string; registry?: string };

const unquote = (value: string) => value.trim().replace(/^(["'])(.*)\1$/, '$2');

const readText = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : undefined);

const configLines = (text: string) =>
  text.split(/\r?\n/).filter((line) => line.trim() !== '' && !/^\s*[#;]/.test(line));

const readNpmrc = (text: string): RegistryConfig => {
  const config: RegistryConfig = {};

  for (const line of configLines(text)) {
    const separator = line.indexOf('=');

    if (separator < 0) continue;

    const key = line.slice(0, separator).trim();
    const value = unquote(line.slice(separator + 1));

    if (key === `${SCOPE}:registry`) config.scoped = value;
    if (key === 'registry') config.registry = value;
  }

  return config;
};

const readYarnrc = (text: string): RegistryConfig => {
  const config: RegistryConfig = {};

  for (const line of configLines(text)) {
    const match = /^\s*("[^"]+"|\S+)\s+(.+)$/.exec(line);

    if (!match) continue;

    const key = unquote(match[1] as string);
    const value = unquote(match[2] as string);

    if (key === `${SCOPE}:registry`) config.scoped = value;
    if (key === 'registry') config.registry = value;
  }

  return config;
};

const readYarnrcYml = (text: string): RegistryConfig => {
  const config: RegistryConfig = {};
  const path: { indent: number; key: string }[] = [];

  for (const line of configLines(text)) {
    const match = /^(\s*)([^:\s]+)\s*:\s*(.*)$/.exec(line);

    if (!match) continue;

    const indent = (match[1] as string).length;
    const key = unquote(match[2] as string);
    const value = unquote(match[3] as string);

    while ((path[path.length - 1]?.indent ?? -1) >= indent) path.pop();

    const keys = [...path.map((entry) => entry.key), key].join('.');

    if (value === '') path.push({ indent, key });
    else if (keys === 'npmRegistryServer') config.registry = value;
    else if (keys === `npmScopes.${SCOPE.slice(1)}.npmRegistryServer`) config.scoped = value;
  }

  return config;
};

/** The registry settings of a repo's own config files, in the order its package manager reads them. */
const projectRegistryConfig = (root: string, manager: PackageManagerName): RegistryConfig => {
  const npmrc = readText(join(root, '.npmrc'));
  const sources: (RegistryConfig | undefined)[] = [];

  if (manager === 'yarn') {
    const berry = readText(join(root, '.yarnrc.yml'));

    if (berry !== undefined) return readYarnrcYml(berry);

    const classic = readText(join(root, '.yarnrc'));

    sources.push(classic === undefined ? undefined : readYarnrc(classic));
  }

  sources.push(npmrc === undefined ? undefined : readNpmrc(npmrc));

  return {
    scoped: sources.find((source) => source?.scoped)?.scoped,
    registry: sources.find((source) => source?.registry)?.registry,
  };
};

/**
 * The registry the repo's package manager installs `@ethlete/*` from: the repo's `.npmrc`, `.yarnrc` or
 * `.yarnrc.yml` first, since yarn 1 exports its default registry to scripts even when an `.npmrc` sets
 * another one, then the environment, then the public registry.
 */
export const registryUrl = (options: { root?: string; manager?: PackageManagerName; env?: NodeJS.ProcessEnv } = {}) => {
  const { root = process.cwd(), manager = 'npm', env = process.env } = options;
  const project = projectRegistryConfig(root, manager);

  return (
    project.scoped ??
    env[`npm_config_${SCOPE}:registry`] ??
    project.registry ??
    env['npm_config_registry'] ??
    DEFAULT_REGISTRY
  ).replace(/\/+$/, '');
};

export const packageUrl = (options: { registry: string; packageName: string }) =>
  `${options.registry}/${options.packageName.replace('/', '%2f')}`;

/** Asks the registry which versions of a package exist and what each dist tag points at. */
export const fetchRegistryPackage = async (options: {
  packageName: string;
  registry?: string;
}): Promise<RegistryLookup> => {
  const { packageName, registry = registryUrl() } = options;

  let response: Response;

  try {
    response = await fetch(packageUrl({ registry, packageName }), {
      // The abbreviated document holds the dist tags and the version list without every manifest.
      headers: { Accept: 'application/vnd.npm.install-v1+json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }

  if (response.status === 404) return { ok: false, reason: `${registry} has no ${packageName}.` };

  if (!response.ok) return { ok: false, reason: `${registry} answered ${response.status} for ${packageName}.` };

  const body: unknown = await response.json().catch(() => undefined);
  const record = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const tags = record['dist-tags'];
  const versions = record['versions'];

  return {
    ok: true,
    package: {
      distTags: typeof tags === 'object' && tags !== null ? (tags as Record<string, string>) : {},
      versions: typeof versions === 'object' && versions !== null ? Object.keys(versions) : [],
    },
  };
};

/**
 * Which dist tag an update follows when the caller names none: the one the installed prerelease belongs
 * to, so a repo on `-next.46` stays on `next` instead of being pulled back to the stable line.
 */
export const tagForInstalled = (options: { version?: string; distTags: Record<string, string> }) => {
  const { version, distTags } = options;
  const tag = version ? prereleaseTag(version) : undefined;

  return tag !== undefined && distTags[tag] !== undefined ? tag : 'latest';
};
