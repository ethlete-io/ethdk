import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { PackageManagerName } from './package-manager';
import { compareVersions, prereleaseTag } from './semver';

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

const expandEnv = (value: string, env: NodeJS.ProcessEnv) =>
  value.replace(/\$\{([^}]+)\}/g, (_, name: string) => env[name] ?? '');

const npmrcEntries = (text: string, env: NodeJS.ProcessEnv) =>
  configLines(text).flatMap((line) => {
    const separator = line.indexOf('=');

    if (separator < 0) return [];

    return [{ key: line.slice(0, separator).trim(), value: expandEnv(unquote(line.slice(separator + 1)), env) }];
  });

const readNpmrc = (text: string, env: NodeJS.ProcessEnv): RegistryConfig => {
  const config: RegistryConfig = {};

  for (const { key, value } of npmrcEntries(text, env)) {
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

const userNpmrcPath = (home: string) => join(home, '.npmrc');

/** The registry settings of a repo's config files, then the user's `.npmrc`, in the order its package manager reads them. */
const projectRegistryConfig = (options: {
  root: string;
  manager: PackageManagerName;
  env: NodeJS.ProcessEnv;
  home: string;
}): RegistryConfig => {
  const { root, manager, env, home } = options;
  const npmrc = readText(join(root, '.npmrc'));
  const userNpmrc = readText(userNpmrcPath(home));
  const sources: (RegistryConfig | undefined)[] = [];

  if (manager === 'yarn') {
    const berry = readText(join(root, '.yarnrc.yml'));

    if (berry !== undefined) return readYarnrcYml(berry);

    const classic = readText(join(root, '.yarnrc'));

    sources.push(classic === undefined ? undefined : readYarnrc(classic));
  }

  sources.push(npmrc === undefined ? undefined : readNpmrc(npmrc, env));
  sources.push(userNpmrc === undefined ? undefined : readNpmrc(userNpmrc, env));

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
export const registryUrl = (
  options: { root?: string; manager?: PackageManagerName; env?: NodeJS.ProcessEnv; home?: string } = {},
) => {
  const { root = process.cwd(), manager = 'npm', env = process.env, home = homedir() } = options;
  const project = projectRegistryConfig({ root, manager, env, home });

  return (
    project.scoped ??
    env[`npm_config_${SCOPE}:registry`] ??
    project.registry ??
    env['npm_config_registry'] ??
    DEFAULT_REGISTRY
  ).replace(/\/+$/, '');
};

/**
 * The `Authorization` header npm would send to `registry`, from the `//host/path/:_authToken` or
 * `:_auth` entries of the repo's and the user's `.npmrc`, with `${VAR}` expanded. The longest matching
 * path wins.
 */
export const registryAuthorization = (options: RegistryAuthorizationOptions) => findAuthorization(options)?.header;

/** The `.npmrc` the token for a registry was read from, or `undefined` when neither holds one. */
export const registryAuthorizationSource = (options: RegistryAuthorizationOptions) =>
  findAuthorization(options)?.source;

type RegistryAuthorizationOptions = {
  registry: string;
  root?: string;
  env?: NodeJS.ProcessEnv;
  home?: string;
};

const findAuthorization = (options: RegistryAuthorizationOptions) => {
  const { registry, root = process.cwd(), env = process.env, home = homedir() } = options;
  const target = `${registry.replace(/^[a-z]+:/i, '').replace(/\/+$/, '')}/`;
  const entries = [join(root, '.npmrc'), userNpmrcPath(home)].flatMap((source) => {
    const text = readText(source);

    return text === undefined ? [] : npmrcEntries(text, env).map((entry) => ({ ...entry, source }));
  });

  let best: { length: number; header: string; source: string } | undefined;

  for (const { key, value, source } of entries) {
    const match = /^(\/\/.+?)\/?:(_authToken|_auth)$/.exec(key);
    const prefix = match?.[1] === undefined ? undefined : `${match[1]}/`;

    if (!match || !prefix || !value || !target.startsWith(prefix)) continue;
    if (best && best.length >= prefix.length) continue;

    best = {
      length: prefix.length,
      header: match[2] === '_authToken' ? `Bearer ${value}` : `Basic ${value}`,
      source,
    };
  }

  return best;
};

export const packageUrl = (options: { registry: string; packageName: string }) =>
  `${options.registry}/${options.packageName.replace('/', '%2f')}`;

/** Asks the registry which versions of a package exist and what each dist tag points at. */
export const fetchRegistryPackage = async (options: {
  packageName: string;
  registry?: string;
  authorization?: string;
  /** Where `authorization` was read from, named in the reason of a 401 or 403. */
  authorizationSource?: string;
}): Promise<RegistryLookup> => {
  const { packageName, registry = registryUrl(), authorization, authorizationSource } = options;

  let response: Response;

  try {
    response = await fetch(packageUrl({ registry, packageName }), {
      // The abbreviated document holds the dist tags and the version list without every manifest.
      headers: {
        Accept: 'application/vnd.npm.install-v1+json',
        ...(authorization ? { Authorization: authorization } : {}),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }

  if (response.status === 404) return { ok: false, reason: `${registry} has no ${packageName}.` };

  if (response.status === 401 || response.status === 403) {
    const hint = authorizationSource
      ? `The token in ${authorizationSource} was refused; it may be expired or lack read access.`
      : `No token for ${registry} was found in the repo's or your own .npmrc; add an _authToken entry for it.`;

    return { ok: false, reason: `${registry} answered ${response.status} for ${packageName}. ${hint}` };
  }

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
 * The dist tag an update follows: for a prerelease, the tag holding the newest version of the same prerelease
 * line, which is not always the tag named after it.
 */
export const tagForInstalled = (options: { version?: string; distTags: Record<string, string> }) => {
  const { version, distTags } = options;
  const tag = version ? prereleaseTag(version) : undefined;

  if (tag === undefined || distTags[tag] === undefined) return 'latest';

  // changesets publishes a package with only prereleases to `latest`, and leaves the `next` tag behind.
  return Object.entries(distTags)
    .filter(([, tagged]) => prereleaseTag(tagged) === tag)
    .reduce((newest, [name, tagged]) => (compareVersions(tagged, distTags[newest] ?? tagged) > 0 ? name : newest), tag);
};
