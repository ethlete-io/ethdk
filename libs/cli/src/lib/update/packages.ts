import { Dirent, existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, relative, sep } from 'path';
import { compareVersions, rangePrefix, versionOfRange } from './semver';

export const ETHLETE_SCOPE = '@ethlete/';

export const ROOT_MANIFEST = 'package.json';

export const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies'] as const;

export type DependencyField = (typeof DEPENDENCY_FIELDS)[number];

export type Manifest = Partial<Record<DependencyField, Record<string, string>>> & {
  packageManager?: string;
};

/** One place a manifest declares a package: which file, which field, and the range written there. */
export type DeclaredSite = {
  /** Relative to the root, with `/` separators. `package.json` for the root manifest. */
  manifestPath: string;
  field: DependencyField;
  range: string;
  /** The version the range points at, or `undefined` for a range no single version can be read from. */
  declaredVersion?: string;
};

export type DeclaredPackage = {
  name: string;
  /** Every field of every manifest in the repo that declares this package. */
  sites: DeclaredSite[];
  /** The version in `node_modules`, which is what the migrations of an update run against. */
  installedVersion?: string;
};

const SKIPPED_DIRECTORIES = new Set(['coverage', 'dist', 'node_modules', 'tmp']);

const readJson = (path: string): unknown => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return undefined;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const manifestPath = (root: string) => join(root, ROOT_MANIFEST);

export const readManifest = (root: string, relativePath = ROOT_MANIFEST): Manifest | undefined => {
  const parsed = readJson(join(root, relativePath));

  return isRecord(parsed) ? (parsed as Manifest) : undefined;
};

/**
 * Every `package.json` in the repo, root first. An Nx repo keeps a manifest per buildable library, and
 * those pin `@ethlete/*` too, so an update that only rewrites the root leaves the rest behind.
 */
export const findManifests = (root: string): string[] => {
  const found: string[] = [];

  const walk = (directory: string) => {
    let entries: Dirent[];

    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || SKIPPED_DIRECTORIES.has(entry.name)) continue;

        walk(join(directory, entry.name));
        continue;
      }

      if (entry.name !== ROOT_MANIFEST) continue;

      found.push(relative(root, join(directory, entry.name)).split(sep).join('/'));
    }
  };

  walk(root);

  return found.sort((left, right) => {
    if (left === ROOT_MANIFEST) return -1;
    if (right === ROOT_MANIFEST) return 1;

    return left.localeCompare(right);
  });
};

/** The version of `packageName` in `node_modules`, which is the one the running code came from. */
export const installedVersion = (root: string, packageName: string) => {
  const path = join(root, 'node_modules', ...packageName.split('/'), ROOT_MANIFEST);

  if (!existsSync(path)) return undefined;

  const parsed = readJson(path);

  return isRecord(parsed) && typeof parsed['version'] === 'string' ? parsed['version'] : undefined;
};

/**
 * The version an update starts from when nothing is installed: the newest one any manifest declares, so
 * a library manifest that lags behind the root does not read as the current version.
 */
export const newestDeclaredVersion = (sites: readonly DeclaredSite[]) =>
  sites.reduce<string | undefined>((newest, site) => {
    if (site.declaredVersion === undefined) return newest;

    return newest === undefined || compareVersions(site.declaredVersion, newest) > 0 ? site.declaredVersion : newest;
  }, undefined);

/** Every `@ethlete/*` dependency the repo declares, gathered across all of its manifests. */
export const declaredEthletePackages = (options: {
  root: string;
  manifests?: readonly string[];
}): DeclaredPackage[] => {
  const { root, manifests = findManifests(root) } = options;
  const byName = new Map<string, DeclaredPackage>();

  for (const relativePath of manifests) {
    const manifest = readManifest(root, relativePath);

    if (!manifest) continue;

    for (const field of DEPENDENCY_FIELDS) {
      for (const [name, range] of Object.entries(manifest[field] ?? {})) {
        if (!name.startsWith(ETHLETE_SCOPE)) continue;

        const entry = byName.get(name) ?? {
          name,
          sites: [],
          installedVersion: installedVersion(root, name),
        };

        entry.sites.push({ manifestPath: relativePath, field, range, declaredVersion: versionOfRange(range) });
        byName.set(name, entry);
      }
    }
  }

  return [...byName.values()];
};

const detectIndent = (source: string) => /\n([ \t]+)"/.exec(source)?.[1] ?? '  ';

export type RangeWrite = {
  name: string;
  manifestPath: string;
  field: DependencyField;
  range: string;
};

/**
 * Writes new ranges into the manifests they came from, keeping each file's indentation. A whole file is
 * re-serialised, so a comment or a key order the parser cannot represent would not survive -
 * `package.json` holds neither.
 */
export const writeRanges = (options: { root: string; writes: readonly RangeWrite[] }) => {
  const { root, writes } = options;
  const written: string[] = [];

  for (const relativePath of new Set(writes.map((write) => write.manifestPath))) {
    const path = join(root, relativePath);
    const source = readFileSync(path, 'utf8');
    const parsed: unknown = JSON.parse(source);

    if (!isRecord(parsed)) throw new Error(`${path} is not a JSON object.`);

    for (const write of writes.filter((candidate) => candidate.manifestPath === relativePath)) {
      const field = parsed[write.field];

      if (!isRecord(field)) continue;

      field[write.name] = write.range;
    }

    const indent = detectIndent(source);
    const trailingNewline = source.endsWith('\n') ? '\n' : '';

    writeFileSync(path, `${JSON.stringify(parsed, null, indent)}${trailingNewline}`, 'utf8');
    written.push(relativePath);
  }

  return written;
};

/**
 * The range that carries `version` while keeping how the declared one was written, for example `^`.
 * `undefined` for a range this cannot rewrite safely, such as `workspace:*` or `>=5 <6`.
 */
export const rangeFor = (options: { current: string; version: string }) => {
  const { current, version } = options;
  const prefix = rangePrefix(current);

  return prefix === undefined ? undefined : `${prefix}${version}`;
};
