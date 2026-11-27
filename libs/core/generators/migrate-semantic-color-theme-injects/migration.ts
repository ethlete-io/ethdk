import { formatFiles, Tree } from '@nx/devkit';
import { createMigrationScope, MigrationScopeOptions } from '../migrate-provider-shape/migration-scope.js';
import { migrateSemanticColorThemeInjectsInFile } from './semantic-color-theme-injects.js';

type MigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
};

const isSource = (filePath: string) => /\.(ts|tsx|js|mjs|cjs|jsx)$/.test(filePath) && !filePath.endsWith('.d.ts');

export default async function migrateSemanticColorThemeInjects(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔄 Rewriting injectErrorTheme, injectWarningTheme and injectSuccessTheme...');

  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  const review: string[] = [];
  let filesChanged = 0;

  scope.visit(tree, (filePath) => {
    if (!isSource(filePath)) return;

    const before = tree.read(filePath, 'utf-8');

    if (!before || !/inject(Error|Warning|Success)Theme/.test(before)) return;

    const result = migrateSemanticColorThemeInjectsInFile(filePath, before);

    for (const finding of result.findings) {
      review.push(`${filePath}:${finding.line}: ${finding.reason}\n      ${finding.text}`);
    }

    if (!result.changed) return;

    tree.write(filePath, result.content);
    filesChanged++;
    console.log(`   ✓ ${filePath}`);
  });

  console.log(filesChanged === 0 ? '   Nothing to migrate.\n' : `\n✅ Migrated ${filesChanged} file(s).\n`);

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  if (review.length === 0) return;

  return () => {
    throw new Error(
      [
        `${review.length} place(s) need a hand fix; their files are left as they were:`,
        ...review.map((entry) => `   ✗ ${entry}`),
        'Fix them, then run the migration again until it reports nothing.',
      ].join('\n'),
    );
  };
}
