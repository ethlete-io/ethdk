import { formatFiles, Tree } from '@nx/devkit';
import { createMigrationScope, MigrationScopeOptions } from '../migrate-query-error-labels/migration-scope.js';
import { renameBracketEthleteExportsInFile } from './bracket-ethlete-renames.js';

type MigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
};

export default async function migrateBracketEthleteRenames(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔎 Renaming generateTournamentModeFormEthleteRounds to generateTournamentModeFromEthleteRounds...');

  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  const changed: string[] = [];

  scope.visit(tree, (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.d.ts')) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    const next = renameBracketEthleteExportsInFile(content);
    if (next === null) return;

    tree.write(filePath, next);
    changed.push(filePath);
  });

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  if (changed.length > 0) {
    console.log(`\n✅ Renamed the export in ${changed.length} file(s).`);
  } else {
    console.log('\n✅ Nothing to do.');
  }
}
