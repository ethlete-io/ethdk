import { formatFiles, Tree } from '@nx/devkit';
import { createMigrationScope, MigrationScopeOptions } from '../migrate-query-error-labels/migration-scope.js';
import { importsEthleteComponents, removeActiveUnderline } from './tabs-active-underline.js';

type MigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
};

export default async function migrateTabsActiveUnderline(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔎 Removing activeUnderline from provideTabsConfig...');

  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  const changed: string[] = [];

  scope.visit(tree, (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.d.ts')) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content || !importsEthleteComponents(content)) return;

    const next = removeActiveUnderline(content);
    if (next === null) return;

    tree.write(filePath, next);
    changed.push(filePath);
  });

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  if (changed.length > 0) {
    console.log(`\n✅ Removed activeUnderline from provideTabsConfig in ${changed.length} file(s).`);
  } else {
    console.log('\n✅ Nothing to do.');
  }
}
