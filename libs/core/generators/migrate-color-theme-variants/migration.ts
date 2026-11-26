import { formatFiles, Tree, visitNotIgnoredFiles } from '@nx/devkit';
import { createMigrationScope, MigrationScopeOptions } from '../migrate-provider-shape/migration-scope.js';
import { collectColorThemesInFile, FoundColorTheme, migrateColorThemeVariantsInFile } from './color-theme-variants.js';

type MigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
};

const isSource = (filePath: string) => filePath.endsWith('.ts') && !filePath.endsWith('.d.ts');

export default async function migrateColorThemeVariants(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔄 Migrating surface colorTheme and semanticColorThemes to colorThemeVariants...');

  const themes: FoundColorTheme[] = [];

  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!isSource(filePath)) return;

    const content = tree.read(filePath, 'utf-8');

    if (content) themes.push(...collectColorThemesInFile(filePath, content));
  });

  const defaults = themes.filter((theme) => theme.isDefault).map((theme) => theme.name);

  console.log(`   Color themes found: ${themes.map((theme) => theme.name).join(', ') || 'none'}`);
  console.log(`   Default color theme: ${defaults.join(', ') || 'none'}`);

  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  let filesChanged = 0;
  let unresolvedCount = 0;

  scope.visit(tree, (filePath) => {
    if (!isSource(filePath)) return;

    const before = tree.read(filePath, 'utf-8');

    if (!before) return;

    const result = migrateColorThemeVariantsInFile(filePath, before, themes);

    for (const message of result.unresolved) {
      unresolvedCount++;
      console.warn(`   ⚠ ${filePath}: ${message}`);
    }

    if (!result.changed) return;

    tree.write(filePath, result.content);
    filesChanged++;
    console.log(`   ✓ ${filePath}`);
  });

  console.log(filesChanged === 0 ? '   Nothing to migrate.\n' : `\n✅ Migrated ${filesChanged} file(s).\n`);

  if (unresolvedCount > 0) {
    console.warn(
      `   Review ${unresolvedCount} unresolved value(s) manually. They keep working until the next major.\n`,
    );
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }
}
