import { existsSync, readFileSync } from 'fs';
import { dirname, isAbsolute, join, resolve } from 'path';
import { isValidVersion } from './semver';

/** The `package.json` field a package points at its own migration manifest with. */
export const MIGRATIONS_MANIFEST_KEY = 'ethlete';

export const MIGRATION_KINDS = ['auto', 'manual', 'assisted'] as const;

export type MigrationKind = (typeof MIGRATION_KINDS)[number];

export type Migration = {
  /** Unique inside its package, and stable: it names the migration in every report. */
  name: string;
  /** The version the change landed in. The migration is pending for an update that crosses it. */
  version: string;
  kind: MigrationKind;
  description: string;
  /** `auto` only: the Nx generator that rewrites the code, as `@ethlete/core:migrate-x`. */
  generator?: string;
  /** `auto` only: flags handed to the generator, for example `{ skipFormat: true }`. */
  options?: Record<string, string | number | boolean>;
  /** Markdown next to the manifest: the recommendation for `manual`, the prompt for `assisted`. */
  instructions?: string;
  /** Path on the docs site, for example `/components/button`. */
  docs?: string;
};

export type PackageMigrations = {
  packageName: string;
  migrations: Migration[];
  /** Where the manifest was read from, so an instructions path can be resolved against it. */
  manifestPath?: string;
  problems: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readJson = (path: string): unknown => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return undefined;
  }
};

const readString = (record: Record<string, unknown>, key: string) => {
  const value = record[key];

  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
};

const readOptions = (value: unknown) => {
  if (!isRecord(value)) return undefined;

  const options: Record<string, string | number | boolean> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') options[key] = entry;
  }

  return options;
};

const parseEntry = (options: { value: unknown; origin: string; index: number }) => {
  const { value, origin, index } = options;
  const at = `${origin} entry ${index}`;

  if (!isRecord(value)) return { problem: `${at} is not an object.` };

  const name = readString(value, 'name');
  const version = readString(value, 'version');
  const kind = readString(value, 'kind');
  const description = readString(value, 'description');

  if (!name) return { problem: `${at} has no "name".` };
  if (!version) return { problem: `${origin} "${name}" has no "version".` };
  if (!isValidVersion(version)) return { problem: `${origin} "${name}" has an invalid version "${version}".` };
  if (!kind) return { problem: `${origin} "${name}" has no "kind".` };

  if (!MIGRATION_KINDS.includes(kind as MigrationKind)) {
    return { problem: `${origin} "${name}" has kind "${kind}" — use one of ${MIGRATION_KINDS.join(', ')}.` };
  }

  if (!description) return { problem: `${origin} "${name}" has no "description".` };

  const generator = readString(value, 'generator');
  const instructions = readString(value, 'instructions');

  if (kind === 'auto' && !generator) return { problem: `${origin} "${name}" is auto but names no "generator".` };

  if (kind === 'assisted' && !instructions) {
    return { problem: `${origin} "${name}" is assisted but names no "instructions" file.` };
  }

  return {
    migration: {
      name,
      version,
      kind: kind as MigrationKind,
      description,
      generator,
      options: readOptions(value['options']),
      instructions,
      docs: readString(value, 'docs'),
    } satisfies Migration,
  };
};

const parseManifest = (options: { source: unknown; origin: string; packageName: string }): PackageMigrations => {
  const { source, origin, packageName } = options;

  if (!isRecord(source)) return { packageName, migrations: [], problems: [`${origin} is not a JSON object.`] };

  const entries = source['migrations'];

  if (!Array.isArray(entries))
    return { packageName, migrations: [], problems: [`${origin} has no "migrations" array.`] };

  const migrations: Migration[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();

  entries.forEach((value, index) => {
    const parsed = parseEntry({ value, origin, index });

    if (parsed.problem !== undefined) {
      problems.push(parsed.problem);

      return;
    }

    const { migration } = parsed;

    if (seen.has(migration.name)) {
      problems.push(`${origin} declares "${migration.name}" twice.`);

      return;
    }

    seen.add(migration.name);
    migrations.push(migration);
  });

  return { packageName, migrations, problems };
};

/**
 * The migrations an installed package ships, read from the manifest its `package.json` points at.
 * A package that declares none is not a problem — most versions need no migration.
 */
export const readPackageMigrations = (options: { root: string; packageName: string }): PackageMigrations => {
  const { root, packageName } = options;
  const packageJsonPath = join(root, 'node_modules', ...packageName.split('/'), 'package.json');

  if (!existsSync(packageJsonPath)) {
    return { packageName, migrations: [], problems: [`${packageName} is not installed.`] };
  }

  const packageJson = readJson(packageJsonPath);
  const field = isRecord(packageJson) ? packageJson[MIGRATIONS_MANIFEST_KEY] : undefined;
  const declared = isRecord(field) ? field['migrations'] : undefined;

  if (typeof declared !== 'string') return { packageName, migrations: [], problems: [] };

  const manifestPath = resolve(dirname(packageJsonPath), declared);

  if (!existsSync(manifestPath)) {
    return {
      packageName,
      migrations: [],
      problems: [`${packageName} points "${MIGRATIONS_MANIFEST_KEY}.migrations" at ${manifestPath}, which is missing.`],
    };
  }

  return {
    ...parseManifest({ source: readJson(manifestPath), origin: `${packageName} migrations.json`, packageName }),
    manifestPath,
  };
};

/** The absolute path of a migration's instructions file, or `undefined` when it names none. */
export const instructionsPath = (options: { manifestPath?: string; migration: Migration }) => {
  const { manifestPath, migration } = options;

  if (!migration.instructions) return undefined;

  if (isAbsolute(migration.instructions)) return migration.instructions;

  return manifestPath ? resolve(dirname(manifestPath), migration.instructions) : undefined;
};
