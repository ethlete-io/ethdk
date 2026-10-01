import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

export const MIGRATION_RECORD_FILE = join('.ethlete', 'migrations.json');

export type MigrationRun = {
  /** The installed version of the package when the migration ran. */
  version: string;
  ranAt: string;
};

/** The runs of the recommended and optional migrations, keyed by `<package>:<name>`. */
export type MigrationRecord = Record<string, MigrationRun>;

export type ReadMigrationRecord = {
  record: MigrationRecord;
  problems: string[];
};

export const migrationKey = (options: { packageName: string; name: string }) =>
  `${options.packageName}:${options.name}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isRun = (value: unknown): value is MigrationRun =>
  isRecord(value) && typeof value['version'] === 'string' && typeof value['ranAt'] === 'string';

export const readMigrationRecord = (root: string): ReadMigrationRecord => {
  const path = join(root, MIGRATION_RECORD_FILE);

  if (!existsSync(path)) return { record: {}, problems: [] };

  let parsed: unknown;

  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return { record: {}, problems: [`${MIGRATION_RECORD_FILE} is not valid JSON.`] };
  }

  if (!isRecord(parsed) || !isRecord(parsed['runs'])) {
    return { record: {}, problems: [`${MIGRATION_RECORD_FILE} has no "runs" object.`] };
  }

  const record: MigrationRecord = {};
  const problems: string[] = [];

  for (const [key, run] of Object.entries(parsed['runs'])) {
    if (!/^@[^/:]+\/[^/:]+:.+$/.test(key))
      problems.push(`${MIGRATION_RECORD_FILE} has a run "${key}" with no package.`);
    else if (!isRun(run)) problems.push(`${MIGRATION_RECORD_FILE} run "${key}" needs a "version" and a "ranAt".`);
    else record[key] = { version: run.version, ranAt: run.ranAt };
  }

  return { record, problems };
};

/** Adds one run to the record, keeping the runs that are there. */
export const writeMigrationRun = (options: { root: string; packageName: string; name: string; run: MigrationRun }) => {
  const { root, packageName, name, run } = options;
  const path = join(root, MIGRATION_RECORD_FILE);
  const runs = { ...readMigrationRecord(root).record, [migrationKey({ packageName, name })]: run };
  const sorted = Object.fromEntries(Object.entries(runs).sort(([left], [right]) => left.localeCompare(right)));

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ runs: sorted }, null, 2)}\n`, 'utf8');
};
