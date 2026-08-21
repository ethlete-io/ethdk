import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { rangePrefix, versionOfRange } from './semver';

export const ETHLETE_SCOPE = '@ethlete/';

export const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies'] as const;

export type DependencyField = (typeof DEPENDENCY_FIELDS)[number];

export type Manifest = Partial<Record<DependencyField, Record<string, string>>> & {
  packageManager?: string;
};

export type DeclaredPackage = {
  name: string;
  field: DependencyField;
  range: string;
  /** The version the range points at, or `undefined` for a range no single version can be read from. */
  declaredVersion?: string;
  /** The version in `node_modules`, which is what the migrations of an update run against. */
  installedVersion?: string;
};

const readJson = (path: string): unknown => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return undefined;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const manifestPath = (root: string) => join(root, 'package.json');

export const readManifest = (root: string): Manifest | undefined => {
  const parsed = readJson(manifestPath(root));

  return isRecord(parsed) ? (parsed as Manifest) : undefined;
};

/** The version of `packageName` in `node_modules`, which is the one the running code came from. */
export const installedVersion = (root: string, packageName: string) => {
  const path = join(root, 'node_modules', ...packageName.split('/'), 'package.json');

  if (!existsSync(path)) return undefined;

  const parsed = readJson(path);

  return isRecord(parsed) && typeof parsed['version'] === 'string' ? parsed['version'] : undefined;
};

/** Every `@ethlete/*` dependency the manifest declares, with the version behind its range. */
export const declaredEthletePackages = (options: { root: string; manifest: Manifest }): DeclaredPackage[] => {
  const { root, manifest } = options;
  const declared: DeclaredPackage[] = [];

  for (const field of DEPENDENCY_FIELDS) {
    for (const [name, range] of Object.entries(manifest[field] ?? {})) {
      if (!name.startsWith(ETHLETE_SCOPE)) continue;

      declared.push({
        name,
        field,
        range,
        declaredVersion: versionOfRange(range),
        installedVersion: installedVersion(root, name),
      });
    }
  }

  return declared;
};

const detectIndent = (source: string) => /\n([ \t]+)"/.exec(source)?.[1] ?? '  ';

export type RangeWrite = {
  name: string;
  field: DependencyField;
  range: string;
};

/**
 * Writes new ranges into the manifest, keeping its indentation. The whole file is re-serialised, so a
 * comment or a key order the parser cannot represent would not survive - `package.json` holds neither.
 */
export const writeRanges = (options: { root: string; writes: readonly RangeWrite[] }) => {
  const { root, writes } = options;
  const path = manifestPath(root);
  const source = readFileSync(path, 'utf8');
  const parsed: unknown = JSON.parse(source);

  if (!isRecord(parsed)) throw new Error(`${path} is not a JSON object.`);

  for (const write of writes) {
    const field = parsed[write.field];

    if (!isRecord(field)) continue;

    field[write.name] = write.range;
  }

  const indent = detectIndent(source);
  const trailingNewline = source.endsWith('\n') ? '\n' : '';

  writeFileSync(path, `${JSON.stringify(parsed, null, indent)}${trailingNewline}`, 'utf8');
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
