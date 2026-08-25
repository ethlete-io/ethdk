import { DeclaredPackage, DeclaredSite, RangeWrite, newestDeclaredVersion, rangeFor } from './packages';
import { Migration, PackageMigrations } from './migration-manifest';
import { RegistryPackage, tagForInstalled } from './registry';
import { compareVersions, isInUpdateRange, isNewer, isValidVersion } from './semver';

/**
 * The order two migrations of the same version run in, following the dependency layering: a rewrite in
 * `core` lands before the `components` one that builds on it.
 */
const PACKAGE_ORDER = [
  '@ethlete/types',
  '@ethlete/core',
  '@ethlete/query',
  '@ethlete/components',
  '@ethlete/contentful',
  '@ethlete/query-devtools',
  '@ethlete/cdk',
  '@ethlete/eslint-plugin',
  '@ethlete/agent-rules',
  '@ethlete/cli',
];

export type UpdatedPackage = {
  name: string;
  /** The installed version the migrations run from, or `undefined` when nothing is installed. */
  from?: string;
  to: string;
};

export type PackageUpdate = UpdatedPackage & {
  /** The dist tag the target came from, absent when the caller named a version. */
  tag?: string;
  /** Every range to rewrite, one per manifest and field that declares the package. */
  writes: RangeWrite[];
  /** The sites whose declared range no single version can be written into. */
  unwritable: DeclaredSite[];
};

export type TargetChoice = { update: PackageUpdate } | { problem: string } | { upToDate: true };

export type TargetRequest = {
  /** A version the caller named with `--to`. */
  version?: string;
  /** A dist tag the caller named with `--tag`. */
  tag?: string;
};

/** The version an update moves a package to, from the registry's dist tags or the caller's request. */
export const chooseTarget = (options: {
  declared: DeclaredPackage;
  registry: RegistryPackage;
  request?: TargetRequest;
}): TargetChoice => {
  const { declared, registry, request = {} } = options;
  const current = declared.installedVersion ?? newestDeclaredVersion(declared.sites);

  if (request.version !== undefined) {
    if (!isValidVersion(request.version)) return { problem: `"${request.version}" is not a version.` };

    if (!registry.versions.includes(request.version)) {
      return { problem: `${declared.name}@${request.version} is not on the registry.` };
    }
  }

  const tag =
    request.version === undefined
      ? (request.tag ?? tagForInstalled({ version: current, distTags: registry.distTags }))
      : undefined;
  const to = request.version ?? (tag === undefined ? undefined : registry.distTags[tag]);

  if (to === undefined) {
    return { problem: `${declared.name} has no "${tag}" version on the registry.` };
  }

  if (current !== undefined && compareVersions(to, current) === 0) return { upToDate: true };

  // A dist tag can point at an older version than the installed one - the release of a package that
  // never had a stable version leaves `next` behind. Following the tag this command picks by itself
  // would be a silent downgrade, so it takes `--to` or `--tag` to ask for one.
  const inferredTag = request.version === undefined && request.tag === undefined;

  if (inferredTag && current !== undefined && compareVersions(to, current) < 0) {
    return {
      problem:
        `${declared.name}: the "${tag}" tag points at ${to}, which is older than the ${current} this repo is on. ` +
        `The tag is stale. Pass \`--to ${to}\` to move back on purpose.`,
    };
  }

  const writes: RangeWrite[] = [];
  const unwritable: DeclaredSite[] = [];

  for (const site of declared.sites) {
    const range = rangeFor({ current: site.range, version: to });

    if (range === undefined) unwritable.push(site);
    else writes.push({ name: declared.name, manifestPath: site.manifestPath, field: site.field, range });
  }

  return {
    update: {
      name: declared.name,
      from: declared.installedVersion,
      to,
      tag,
      writes,
      unwritable,
    },
  };
};

export const isDowngrade = (update: PackageUpdate) => update.from !== undefined && !isNewer(update.to, update.from);

export type PendingMigration = {
  packageName: string;
  migration: Migration;
  /** Where the instructions of this migration live, when it names any. */
  manifestPath?: string;
};

/** The migrations of one package that an update from `from` to `to` crosses. */
export const pendingMigrations = (options: {
  packageMigrations: PackageMigrations;
  from: string;
  to: string;
}): PendingMigration[] => {
  const { packageMigrations, from, to } = options;

  return packageMigrations.migrations
    .filter((migration) => isInUpdateRange({ version: migration.version, after: from, upTo: to }))
    .map((migration) => ({
      packageName: packageMigrations.packageName,
      migration,
      manifestPath: packageMigrations.manifestPath,
    }));
};

const packageRank = (name: string) => {
  const index = PACKAGE_ORDER.indexOf(name);

  return index === -1 ? PACKAGE_ORDER.length : index;
};

/** Oldest version first, and inside one version the package that others build on first. */
export const orderMigrations = (pending: readonly PendingMigration[]) =>
  [...pending].sort((left, right) => {
    const byVersion = compareVersions(left.migration.version, right.migration.version);

    if (byVersion !== 0) return byVersion;

    return packageRank(left.packageName) - packageRank(right.packageName);
  });
