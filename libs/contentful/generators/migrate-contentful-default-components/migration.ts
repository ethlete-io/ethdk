import { formatFiles, Tree } from '@nx/devkit';
import { createMigrationScope, MigrationScopeOptions } from '../migrate-to-contentful-v5/migration-scope.js';
import {
  ContentfulDefaultComponentsTask,
  scanContentfulDefaultComponentsInFile,
} from './contentful-default-components.js';

export const CONTENTFUL_DEFAULT_COMPONENTS_REPORT_PATH = 'contentful-default-components-migration-tasks.md';

const renderReport = (tasks: ContentfulDefaultComponentsTask[]) =>
  [
    '# Contentful default components migration tasks',
    '',
    'The shipped asset and link components are opt-in. Without them embedded assets are skipped and',
    'hyperlinks render as plain anchors. The migration spread `CONTENTFUL_DEFAULT_COMPONENTS` into every',
    'literal `provideContentfulConfig` call; the calls below need it by hand:',
    '',
    '```ts',
    "import { CONTENTFUL_DEFAULT_COMPONENTS, provideContentfulConfig } from '@ethlete/contentful';",
    '',
    'provideContentfulConfig({ ...CONTENTFUL_DEFAULT_COMPONENTS });',
    '```',
    '',
    'A config that names every asset and link component itself needs nothing. Delete this file when done.',
    '',
    ...tasks.map((task) =>
      [`## \`${task.id}\``, '', `- ${task.file}:${task.line}`, `- ${task.message}`, ''].join('\n'),
    ),
  ].join('\n');

type MigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
};

export default async function migrateContentfulDefaultComponents(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔎 Spreading CONTENTFUL_DEFAULT_COMPONENTS into provideContentfulConfig...');

  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  const changed: string[] = [];
  const tasks: ContentfulDefaultComponentsTask[] = [];

  scope.visit(tree, (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.d.ts')) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    const result = scanContentfulDefaultComponentsInFile(filePath, content);

    tasks.push(...result.tasks);

    if (result.next !== null) {
      tree.write(filePath, result.next);
      changed.push(filePath);
    }
  });

  if (tasks.length > 0) {
    tree.write(CONTENTFUL_DEFAULT_COMPONENTS_REPORT_PATH, renderReport(tasks));
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  if (changed.length > 0) {
    console.log(`\n✅ Spread CONTENTFUL_DEFAULT_COMPONENTS in ${changed.length} file(s).`);
  }

  if (tasks.length > 0) {
    console.log(
      `\n⚠️  ${tasks.length} call(s) need the default components by hand — see ${CONTENTFUL_DEFAULT_COMPONENTS_REPORT_PATH}.`,
    );
  } else if (changed.length === 0) {
    console.log('\n✅ Nothing to do.');
  }
}
