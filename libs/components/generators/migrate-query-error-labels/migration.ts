import { formatFiles, Tree } from '@nx/devkit';
import { createMigrationScope, MigrationScopeOptions } from './migration-scope.js';
import { QueryErrorLabelsTask, scanQueryErrorLabelsInFile } from './query-error-labels.js';

export const QUERY_ERROR_LABELS_REPORT_PATH = 'query-error-labels-migration-tasks.md';

type MigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
};

const renderReport = (tasks: QueryErrorLabelsTask[]) =>
  [
    '# Query-error labels migration tasks',
    '',
    'Query-error titles and fallback messages no longer switch to German automatically when the locale is a',
    'German one — the default is English-only, so an English-only app stops bundling the German status table.',
    'Whether to bring German back is a product decision no codemod can make, so the sites below were found but',
    'not changed.',
    '',
    'If the app should keep the old locale-driven wording, add once, app-wide:',
    '',
    '```ts',
    "import { provideQueryErrorLabels, queryErrorLabelsForLocale } from '@ethlete/components';",
    '',
    'provideQueryErrorLabels(queryErrorLabelsForLocale);',
    '```',
    '',
    'For German unconditionally, pass `GERMAN_QUERY_ERROR_LABELS` instead. If the app is English-only (or already',
    'overrides the labels), there is nothing to do — delete this file.',
    '',
    ...tasks.map((task) =>
      [`## \`${task.id}\``, '', `- ${task.file}:${task.line}`, `- ${task.message}`, ''].join('\n'),
    ),
  ].join('\n');

export default async function migrateQueryErrorLabels(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔎 Scanning for query-error usage affected by the English-only label default...');

  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  const tasks: QueryErrorLabelsTask[] = [];
  let hasLabelProvider = false;

  scope.visit(tree, (filePath) => {
    if (!/\.(ts|html)$/.test(filePath) || filePath.endsWith('.d.ts')) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    const result = scanQueryErrorLabelsInFile(filePath, content);

    tasks.push(...result.usages);
    hasLabelProvider ||= result.hasLabelProvider;
  });

  if (hasLabelProvider) {
    console.log('   ✓ Found a provideQueryErrorLabels call — the app already controls its wording.');
  } else if (tasks.length > 0) {
    tree.write(QUERY_ERROR_LABELS_REPORT_PATH, renderReport(tasks));
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  if (!hasLabelProvider && tasks.length > 0) {
    console.log(
      `\n⚠️  ${tasks.length} site(s) use query-error without a label provider — see ${QUERY_ERROR_LABELS_REPORT_PATH}.`,
    );
  } else {
    console.log('\n✅ Nothing to do.');
  }
}
