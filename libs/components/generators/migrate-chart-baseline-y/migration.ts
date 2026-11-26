import { formatFiles, joinPathFragments, Tree } from '@nx/devkit';
import { dirname } from 'node:path/posix';
import { createMigrationScope, MigrationScopeOptions } from '../migrate-query-error-labels/migration-scope.js';
import { importsEthleteComponents, renameBaselineY, TEMPLATE_URL } from './chart-baseline-y.js';

type MigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
};

export default async function migrateChartBaselineY(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔎 Renaming the removed chart-grid baselineY alias to baseline...');

  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  const changed: string[] = [];

  const write = (filePath: string, content: string) => {
    const next = renameBaselineY(content);
    if (next === null) return;

    tree.write(filePath, next);
    changed.push(filePath);
  };

  scope.visit(tree, (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.d.ts')) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content || !importsEthleteComponents(content)) return;

    for (const match of content.matchAll(TEMPLATE_URL)) {
      const templatePath = joinPathFragments(dirname(filePath), match[1] ?? '');
      const template = tree.read(templatePath, 'utf-8');

      if (template !== null) write(templatePath, template);
    }

    write(filePath, content);
  });

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  if (changed.length > 0) {
    console.log(`\n✅ Renamed baselineY in ${changed.length} file(s).`);
  } else {
    console.log('\n✅ Nothing to do.');
  }
}
