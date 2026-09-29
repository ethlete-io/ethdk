import { formatFiles, Tree } from '@nx/devkit';
import { createMigrationScope, MigrationScopeOptions } from '../migrate-query-error-labels/migration-scope.js';
import {
  StreamDefaultComponentsTask,
  streamUsageTask,
  scanStreamDefaultComponentsInFile,
} from './stream-default-components.js';

export const STREAM_DEFAULT_COMPONENTS_REPORT_PATH = 'stream-default-components-migration-tasks.md';

const renderReport = (tasks: StreamDefaultComponentsTask[]) =>
  [
    '# Stream default components migration tasks',
    '',
    'The shipped loading and error overlays are opt-in. A stream slot whose config names none renders no',
    'overlay while the player loads or fails. The migration spread `STREAM_DEFAULT_COMPONENTS` into every literal',
    '`provideStreamConfig` call; the sites below need it by hand. Add once, app-wide or where the slots render:',
    '',
    '```ts',
    "import { STREAM_DEFAULT_COMPONENTS, provideStreamConfig } from '@ethlete/components';",
    '',
    'provideStreamConfig({ ...STREAM_DEFAULT_COMPONENTS });',
    '```',
    '',
    'A stream that names overlays of its own needs nothing. Delete this file when done.',
    '',
    ...tasks.map((task) =>
      [`## \`${task.id}\``, '', `- ${task.file}:${task.line}`, `- ${task.message}`, ''].join('\n'),
    ),
  ].join('\n');

type MigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
};

export default async function migrateStreamDefaultComponents(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔎 Spreading STREAM_DEFAULT_COMPONENTS into provideStreamConfig...');

  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  const changed: string[] = [];
  const tasks: StreamDefaultComponentsTask[] = [];
  const usages: StreamDefaultComponentsTask[] = [];
  let hasConfig = false;

  scope.visit(tree, (filePath) => {
    if (!/\.(ts|html)$/.test(filePath) || filePath.endsWith('.d.ts')) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    const result = scanStreamDefaultComponentsInFile(filePath, content);

    hasConfig ||= result.hasConfig;
    tasks.push(...result.tasks);

    if (result.usesStream) usages.push(streamUsageTask(filePath, content));

    if (result.next !== null) {
      tree.write(filePath, result.next);
      changed.push(filePath);
    }
  });

  const report = hasConfig ? tasks : [...tasks, ...usages];

  if (report.length > 0) {
    tree.write(STREAM_DEFAULT_COMPONENTS_REPORT_PATH, renderReport(report));
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  if (changed.length > 0) {
    console.log(`\n✅ Spread STREAM_DEFAULT_COMPONENTS in ${changed.length} file(s).`);
  }

  if (report.length > 0) {
    console.log(
      `\n⚠️  ${report.length} site(s) need the default components by hand — see ${STREAM_DEFAULT_COMPONENTS_REPORT_PATH}.`,
    );
  } else if (changed.length === 0) {
    console.log('\n✅ Nothing to do.');
  }
}
