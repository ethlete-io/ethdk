import { formatFiles, Tree } from '@nx/devkit';
import { createMigrationScope, MigrationScopeOptions } from '../migrate-query-error-labels/migration-scope.js';
import { BracketDefaultCardsTask, bracketUsageTask, scanBracketDefaultCardsInFile } from './bracket-default-cards.js';

export const BRACKET_DEFAULT_CARDS_REPORT_PATH = 'bracket-default-cards-migration-tasks.md';

const renderReport = (tasks: BracketDefaultCardsTask[]) =>
  [
    '# Bracket default cards migration tasks',
    '',
    'The shipped bracket cards are opt-in. A bracket whose match or round header card nothing names throws',
    '`ET3414`. The migration spread `BRACKET_DEFAULT_CARDS` into every literal `provideBracketConfig` call; the',
    'sites below need it by hand. Add once, app-wide or on the component that renders the bracket:',
    '',
    '```ts',
    "import { BRACKET_DEFAULT_CARDS, provideBracketConfig } from '@ethlete/components';",
    '',
    'provideBracketConfig({ ...BRACKET_DEFAULT_CARDS });',
    '```',
    '',
    'A bracket that binds cards of its own needs nothing. Delete this file when done.',
    '',
    ...tasks.map((task) =>
      [`## \`${task.id}\``, '', `- ${task.file}:${task.line}`, `- ${task.message}`, ''].join('\n'),
    ),
  ].join('\n');

type MigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
};

export default async function migrateBracketDefaultCards(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔎 Spreading BRACKET_DEFAULT_CARDS into provideBracketConfig...');

  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  const changed: string[] = [];
  const tasks: BracketDefaultCardsTask[] = [];
  const usages: BracketDefaultCardsTask[] = [];
  let hasConfig = false;

  scope.visit(tree, (filePath) => {
    if (!/\.(ts|html)$/.test(filePath) || filePath.endsWith('.d.ts')) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    const result = scanBracketDefaultCardsInFile(filePath, content);

    hasConfig ||= result.hasConfig;
    tasks.push(...result.tasks);

    if (result.usesBracket) usages.push(bracketUsageTask(filePath, content));

    if (result.next !== null) {
      tree.write(filePath, result.next);
      changed.push(filePath);
    }
  });

  const report = hasConfig ? tasks : [...tasks, ...usages];

  if (report.length > 0) {
    tree.write(BRACKET_DEFAULT_CARDS_REPORT_PATH, renderReport(report));
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  if (changed.length > 0) {
    console.log(`\n✅ Spread BRACKET_DEFAULT_CARDS in ${changed.length} file(s).`);
  }

  if (report.length > 0) {
    console.log(
      `\n⚠️  ${report.length} site(s) need the default cards by hand — see ${BRACKET_DEFAULT_CARDS_REPORT_PATH}.`,
    );
  } else if (changed.length === 0) {
    console.log('\n✅ Nothing to do.');
  }
}
