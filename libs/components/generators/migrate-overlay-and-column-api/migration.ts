import { formatFiles, Tree } from '@nx/devkit';
import { createMigrationScope, MigrationScopeOptions } from '../migrate-query-error-labels/migration-scope.js';
import { isOverlayAndColumnCandidate, migrateOverlayAndColumnApiInFile } from './overlay-and-column-api.js';

type MigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
};

export default function migrateOverlayAndColumnApi(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔎 Moving overlay results from null to undefined and column choosers to availableColumns...');

  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  const review: string[] = [];
  let filesChanged = 0;

  scope.visit(tree, (filePath) => {
    if (!isOverlayAndColumnCandidate(filePath)) return;

    const before = tree.read(filePath, 'utf-8');
    if (!before) return;

    const result = migrateOverlayAndColumnApiInFile(before);

    for (const entry of result.findings) {
      review.push(`${filePath}:${entry.line}: ${entry.reason}\n      ${entry.text}`);
    }

    if (!result.changed) return;

    tree.write(filePath, result.content);
    filesChanged++;
    console.log(`   ✓ ${filePath}`);
  });

  console.log(filesChanged === 0 ? '   Nothing to migrate.\n' : `\n✅ Migrated ${filesChanged} file(s).\n`);

  return (schema.skipFormat ? Promise.resolve() : formatFiles(tree)).then(() => {
    if (review.length === 0) return undefined;

    return () => {
      throw new Error(
        [
          `${review.length} place(s) need a hand fix; the files above are written, these lines are left as they were:`,
          ...review.map((entry) => `   ✗ ${entry}`),
          'Fix them, then run the migration again until it reports nothing.',
        ].join('\n'),
      );
    };
  });
}
