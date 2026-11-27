import { formatFiles, Tree } from '@nx/devkit';
import { createMigrationScope, MigrationScopeOptions } from '../migrate-query-error-labels/migration-scope.js';
import { isStateTokenCandidate, renameStateTokens } from './state-token-names.js';

type MigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
};

export default async function migrateStateTokenNames(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔎 Renaming the component state tokens...');

  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  const changed: string[] = [];

  scope.visit(tree, (filePath) => {
    if (!isStateTokenCandidate(filePath)) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    const next = renameStateTokens(content);
    if (next === null) return;

    tree.write(filePath, next);
    changed.push(filePath);
  });

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  if (changed.length > 0) {
    console.log(`\n✅ Renamed the state tokens in ${changed.length} file(s):`);
    for (const filePath of changed) console.log(`   ${filePath}`);
  } else {
    console.log('\n✅ Nothing to do.');
  }
}
