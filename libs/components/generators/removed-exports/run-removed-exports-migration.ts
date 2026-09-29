import { formatFiles, Tree } from '@nx/devkit';
import { createMigrationScope, MigrationScopeOptions } from '../migrate-query-error-labels/migration-scope.js';
import { MIGRATION_TODO, migrateRemovedExportsInFile, RemovedExport, RemovedExportTask } from './removed-exports.js';

export type RemovedExportsMigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
};

export type RemovedExportsMigration = {
  title: string;
  removed: readonly RemovedExport[];
  reportPath: string;
  /** Rewrites one more file after the import rewrite, for example a template. Return `null` for no change. */
  rewrite?: (tree: Tree, filePath: string, content: string) => string | null;
};

const renderReport = (title: string, tasks: RemovedExportTask[]) =>
  [
    `# ${title}`,
    '',
    `Each site below carries a \`// ${MIGRATION_TODO}\` comment the migration could not resolve. Fix it by hand, delete the comment, then delete this file.`,
    '',
    ...tasks.map((task) => `- ${task.file}:${task.line} - \`${task.name}\`: ${task.message}`),
    '',
  ].join('\n');

export const runRemovedExportsMigration = async (
  tree: Tree,
  schema: RemovedExportsMigrationSchema,
  migration: RemovedExportsMigration,
) => {
  console.log(`\n🔎 ${migration.title}...`);

  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  const changed: string[] = [];
  const tasks: RemovedExportTask[] = [];

  scope.visit(tree, (filePath) => {
    if (!/\.(ts|html)$/.test(filePath) || filePath.endsWith('.d.ts')) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    const scan = filePath.endsWith('.ts')
      ? migrateRemovedExportsInFile(filePath, content, migration.removed)
      : { next: null, tasks: [] };
    const next = migration.rewrite?.(tree, filePath, scan.next ?? content) ?? scan.next;

    tasks.push(...scan.tasks);

    if (next !== null && next !== content) {
      tree.write(filePath, next);
      changed.push(filePath);
    }
  });

  if (tasks.length > 0) tree.write(migration.reportPath, renderReport(migration.title, tasks));

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  if (changed.length > 0) console.log(`\n✅ Rewrote ${changed.length} file(s).`);

  if (tasks.length > 0) {
    console.warn(
      `\n⚠️  ${tasks.length} site(s) need a hand fix - search for ${MIGRATION_TODO}, or see ${migration.reportPath}.`,
    );
  } else if (changed.length === 0) {
    console.log('\n✅ Nothing to do.');
  }

  return { changed, tasks };
};
