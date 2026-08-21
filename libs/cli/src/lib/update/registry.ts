import { prereleaseTag } from './semver';

const TIMEOUT_MS = 15_000;

export const DEFAULT_REGISTRY = 'https://registry.npmjs.org';

export type RegistryPackage = {
  distTags: Record<string, string>;
  versions: string[];
};

export type RegistryLookup = { ok: true; package: RegistryPackage } | { ok: false; reason: string };

/** The registry npm would use, so a run inside a repo with its own registry reads the same one. */
export const registryUrl = (env: NodeJS.ProcessEnv = process.env) =>
  (env['npm_config_@ethlete:registry'] ?? env['npm_config_registry'] ?? DEFAULT_REGISTRY).replace(/\/+$/, '');

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
