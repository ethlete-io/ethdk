import { formatFiles, Tree } from '@nx/devkit';
import { createMigrationScope, MigrationScopeOptions } from '../migrate-provider-shape/migration-scope.js';
import { CreateDestroyTask, migrateCreateDestroyInFile } from './create-destroy.js';

export const CREATE_DESTROY_REPORT_PATH = 'create-destroy-migration-tasks.md';

type MigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
};

const renderReport = (tasks: CreateDestroyTask[]) =>
  [
    '# createDestroy migration tasks',
    '',
    'The codemod rewrote every `takeUntil(this.<destroy field>)` into `takeUntilDestroyed(…)`. The sites below',
    'use the field in another way (`.next()`, passed on, piped), so they were left alone and the field stays.',
    '',
    ...tasks.map((task) =>
      [`## \`${task.id}\``, '', `- ${task.file}:${task.line}`, `- ${task.message}`, ''].join('\n'),
    ),
  ].join('\n');

export default async function migrateCreateDestroy(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔄 Migrating createDestroy to takeUntilDestroyed...');

  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  const tasks: CreateDestroyTask[] = [];
  let filesChanged = 0;

  scope.visit(tree, (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.d.ts')) return;

    const before = tree.read(filePath, 'utf-8');
    if (!before) return;

    const result = migrateCreateDestroyInFile(filePath, before);

    tasks.push(...result.tasks);

    if (result.changed) {
      tree.write(filePath, result.content);
      filesChanged++;
      console.log(`   ✓ ${filePath}`);
    }
  });

  if (tasks.length > 0) {
    tree.write(CREATE_DESTROY_REPORT_PATH, renderReport(tasks));

    for (const task of tasks) {
      console.warn(`   ⚠️  ${task.file}:${task.line} ${task.message}`);
    }
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  console.log(`\n✅ Rewrote ${filesChanged} file(s).`);

  if (tasks.length > 0) {
    console.log(`⚠️  ${tasks.length} site(s) need a manual decision - see ${CREATE_DESTROY_REPORT_PATH}.`);
  }
}
