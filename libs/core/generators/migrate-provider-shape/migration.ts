import { formatFiles, Tree } from '@nx/devkit';
import { createMigrationScope, MigrationScopeOptions } from './migration-scope.js';
import { migrateProviderShapeInFile, ProviderShapeTask } from './provider-shape.js';

export const PROVIDER_SHAPE_REPORT_PATH = 'provider-shape-migration-tasks.md';

type MigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
};

const renderReport = (tasks: ProviderShapeTask[]) =>
  [
    '# Provider-shape migration tasks',
    '',
    'The codemod rewrote every destructured provider declaration into a definition plus one extractor per',
    'binding. The sites below are **not** plain module-scope declarations, so they were left alone - each',
    'needs a decision a codemod cannot make.',
    '',
    'Recipes:',
    '',
    '- A factory of your own that returned a `[provide, inject, token]` tuple: return the definition from',
    '  `define*Provider(…)` directly, and let its callers use the extractors.',
    '- A call inside a function: read `.provide` / `.inject` / `.token` off the definition.',
    '',
    ...tasks.map((task) =>
      [`## \`${task.id}\``, '', `- ${task.file}:${task.line}`, `- ${task.message}`, ''].join('\n'),
    ),
  ].join('\n');

export default async function migrateProviderShape(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔄 Migrating provider tuples to the definition shape...');

  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  const tasks: ProviderShapeTask[] = [];
  let filesChanged = 0;

  scope.visit(tree, (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.d.ts')) return;

    const before = tree.read(filePath, 'utf-8');
    if (!before) return;

    const result = migrateProviderShapeInFile(filePath, before);

    tasks.push(...result.tasks);

    if (result.changed) {
      tree.write(filePath, result.content);
      filesChanged++;
      console.log(`   ✓ ${filePath}`);
    }
  });

  if (tasks.length > 0) {
    tree.write(PROVIDER_SHAPE_REPORT_PATH, renderReport(tasks));
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  console.log(`\n✅ Rewrote ${filesChanged} file(s).`);

  if (tasks.length > 0) {
    console.log(`⚠️  ${tasks.length} site(s) need a manual decision - see ${PROVIDER_SHAPE_REPORT_PATH}.`);
  }
}
