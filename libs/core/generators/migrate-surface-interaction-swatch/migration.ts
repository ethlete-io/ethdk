import { formatFiles, Tree } from '@nx/devkit';
import { createMigrationScope, MigrationScopeOptions } from '../migrate-provider-shape/migration-scope';
import { migrateInteractionSwatchInFile } from './interaction-swatch';

type MigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
};

export default async function migrateSurfaceInteractionSwatch(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔄 Migrating surface interactionColor to the swatch shape...');

  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  let filesChanged = 0;

  scope.visit(tree, (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.d.ts')) return;

    const before = tree.read(filePath, 'utf-8');

    if (!before) return;

    const result = migrateInteractionSwatchInFile(filePath, before);

    if (!result.changed) return;

    tree.write(filePath, result.content);
    filesChanged++;
    console.log(`   ✓ ${filePath}`);
  });

  console.log(
    filesChanged === 0
      ? '   Nothing to migrate.\n'
      : `\n✅ Migrated ${filesChanged} file(s). Regenerate your surface CSS with \`nx g @ethlete/core:tailwind-4-surface-theme\`.\n`,
  );

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }
}
