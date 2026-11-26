import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { MIGRATION_RECORD_FILE, migrationKey, readMigrationRecord, writeMigrationRun } from './migration-record';

const makeRoot = () => mkdtempSync(join(tmpdir(), 'cli-migration-record-'));

const writeRecord = (root: string, content: string) => {
  mkdirSync(join(root, '.ethlete'), { recursive: true });
  writeFileSync(join(root, MIGRATION_RECORD_FILE), content, 'utf8');
};

const run = { version: '5.42.0', ranAt: '2026-10-01T10:00:00.000Z' };

describe('the migration record', () => {
  it('is empty when the file is not there', () => {
    expect(readMigrationRecord(makeRoot())).toEqual({ record: {}, problems: [] });
  });

  it('reads back the runs it wrote, keyed by package and name', () => {
    const root = makeRoot();

    writeMigrationRun({ root, packageName: '@ethlete/query', name: 'to-query-v3', run });
    writeMigrationRun({ root, packageName: '@ethlete/cdk', name: 'from-cdk', run: { ...run, version: '5.0.0' } });

    expect(readMigrationRecord(root)).toEqual({
      record: {
        '@ethlete/cdk:from-cdk': { ...run, version: '5.0.0' },
        '@ethlete/query:to-query-v3': run,
      },
      problems: [],
    });
    expect(Object.keys(JSON.parse(readFileSync(join(root, MIGRATION_RECORD_FILE), 'utf8')).runs)).toEqual([
      '@ethlete/cdk:from-cdk',
      '@ethlete/query:to-query-v3',
    ]);
  });

  it('builds the key from package and name', () => {
    expect(migrationKey({ packageName: '@ethlete/query', name: 'to-query-v3' })).toBe('@ethlete/query:to-query-v3');
  });

  it('reports a file that is not JSON', () => {
    const root = makeRoot();

    writeRecord(root, '{ nope');

    expect(readMigrationRecord(root)).toEqual({
      record: {},
      problems: [`${MIGRATION_RECORD_FILE} is not valid JSON.`],
    });
  });

  it('reports a file without runs', () => {
    const root = makeRoot();

    writeRecord(root, JSON.stringify({ migrations: [] }));

    expect(readMigrationRecord(root).problems).toEqual([`${MIGRATION_RECORD_FILE} has no "runs" object.`]);
  });

  it('keeps the valid runs and reports the others', () => {
    const root = makeRoot();

    writeRecord(
      root,
      JSON.stringify({
        runs: { '@ethlete/query:to-query-v3': run, 'to-query-v3': run, '@ethlete/cdk:from-cdk': { version: 1 } },
      }),
    );

    const read = readMigrationRecord(root);

    expect(read.record).toEqual({ '@ethlete/query:to-query-v3': run });
    expect(read.problems).toEqual([
      `${MIGRATION_RECORD_FILE} has a run "to-query-v3" with no package.`,
      `${MIGRATION_RECORD_FILE} run "@ethlete/cdk:from-cdk" needs a "version" and a "ranAt".`,
    ]);
  });
});
