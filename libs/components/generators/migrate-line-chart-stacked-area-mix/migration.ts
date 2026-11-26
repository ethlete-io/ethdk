import { formatFiles, Tree } from '@nx/devkit';
import { createMigrationScope, MigrationScopeOptions } from '../migrate-query-error-labels/migration-scope.js';
import { migrateStackedAreaMix } from './line-chart-stacked-area-mix.js';

type MigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
};

const EXTENSIONS = ['.css', '.scss', '.html', '.ts'];

export default async function migrateLineChartStackedAreaMix(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔎 Renaming --et-line-chart-stacked-area-opacity to --et-line-chart-stacked-area-mix...');

  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  const changed: string[] = [];

  scope.visit(tree, (filePath) => {
    if (!EXTENSIONS.some((extension) => filePath.endsWith(extension)) || filePath.endsWith('.d.ts')) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    const result = migrateStackedAreaMix(content);
    if (result === null) return;

    tree.write(filePath, result.content);
    changed.push(filePath);

    for (const line of result.unmapped) {
      console.warn(
        `\n⚠️  ${filePath}:${line} now reads --et-line-chart-stacked-area-mix, but its value could not be mapped and was left as is. The token is a percentage (default 45%), the share of the series color in a mix with the surface: an opacity v becomes v * 100%. See the line chart guide: /components/line-chart.`,
      );
    }
  });

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  if (changed.length > 0) {
    console.log(`\n✅ Renamed the stacked area token in ${changed.length} file(s).`);
  } else {
    console.log('\n✅ Nothing to do.');
  }
}
