import { formatFiles, Tree, visitNotIgnoredFiles } from '@nx/devkit';
import { createMigrationScope, MigrationScopeOptions } from '../migrate-provider-shape/migration-scope.js';
import {
  collectTailwindThemeNames,
  emptyTailwindThemeNames,
  isGeneratedThemeFile,
  migrateThemeTokenNames,
} from './theme-token-names.js';

type MigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
};

const isStyleOrSource = (filePath: string) =>
  /\.(css|scss|sass|less|html|ts|tsx|js|mjs|cjs|jsx)$/.test(filePath) && !filePath.endsWith('.d.ts');

export default async function migrateThemeTokenNamesGenerator(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔄 Renaming the old theme token names...');

  const names = emptyTailwindThemeNames();

  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!filePath.endsWith('.css')) return;

    const content = tree.read(filePath, 'utf-8');

    if (content && isGeneratedThemeFile(content)) collectTailwindThemeNames(content, names);
  });

  for (const [kind, prefixes] of [
    ['Color', names.colorPrefixes],
    ['Surface', names.surfacePrefixes],
  ] as const) {
    for (const [prefix, themes] of prefixes) {
      console.log(`   ${kind} themes with Tailwind prefix "${prefix}": ${[...themes].join(', ')}`);
    }
  }

  const scope = createMigrationScope(tree, schema, { designFiles: true });

  console.log(`   Scope: ${scope.describe()}`);

  const review: string[] = [];
  let filesChanged = 0;

  scope.visit(tree, (filePath) => {
    if (!isStyleOrSource(filePath)) return;

    const before = tree.read(filePath, 'utf-8');

    if (!before) return;

    const result = migrateThemeTokenNames(before, names);

    for (const finding of result.findings) {
      review.push(`${filePath}:${finding.line}: ${finding.reason}\n      ${finding.text}`);
    }

    if (!result.changed) return;

    tree.write(filePath, result.content);
    filesChanged++;
    console.log(`   ✓ ${filePath}`);
  });

  console.log(
    filesChanged === 0
      ? '   Nothing to rename.\n'
      : `\n✅ Renamed theme tokens in ${filesChanged} file(s). Regenerate your theme CSS with \`nx g @ethlete/core:tailwind-4-color-theme\` and \`nx g @ethlete/core:tailwind-4-surface-theme\`.\n`,
  );

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  if (review.length === 0) return;

  return () => {
    throw new Error(
      [
        `${review.length} place(s) need a hand fix; the files above are written, these lines are left as they were:`,
        ...review.map((entry) => `   ✗ ${entry}`),
        'Fix them, regenerate the theme files, then run the migration again until it reports nothing.',
      ].join('\n'),
    );
  };
}
