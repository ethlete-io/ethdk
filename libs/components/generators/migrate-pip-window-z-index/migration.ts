import { formatFiles, Tree } from '@nx/devkit';
import { createMigrationScope, MigrationScopeOptions } from '../migrate-query-error-labels/migration-scope.js';
import {
  addPipWindowConfigToAppConfig,
  isPipWindowZIndexCandidate,
  PIP_WINDOW_Z_INDEX_PROPERTY,
  PipWindowZIndexTask,
  pipWindowZIndexTasks,
  scanPipWindowZIndexInFile,
} from './pip-window-z-index.js';

export const PIP_WINDOW_Z_INDEX_REPORT_PATH = 'pip-window-z-index-migration-tasks.md';

const renderReport = (tasks: PipWindowZIndexTask[]) =>
  [
    '# PiP window z-index migration tasks',
    '',
    `\`${PIP_WINDOW_Z_INDEX_PROPERTY}\` is removed. The PiP window paints at and declares one layer, set in the`,
    'application config. Its default is `2147483005`, above SDK overlays and the notification stack:',
    '',
    '```ts',
    "import { providePipWindowConfig } from '@ethlete/components';",
    '',
    'providers: [...providePipWindowConfig({ overlayLayer: 2147483005 })];',
    '```',
    '',
    'Move each site below into that config, then delete it and this file.',
    '',
    ...tasks.map((task) => [`- ${task.file}:${task.line}`, `  ${task.message}`].join('\n')),
    '',
  ].join('\n');

type MigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
};

type Scanned = { file: string; content: string; next: string | null; values: number[] };

export default async function migratePipWindowZIndex(tree: Tree, schema: MigrationSchema) {
  console.log(`\n🔎 Moving ${PIP_WINDOW_Z_INDEX_PROPERTY} into providePipWindowConfig...`);

  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  const scanned: Scanned[] = [];
  const tasks: PipWindowZIndexTask[] = [];
  const appConfigs: string[] = [];

  scope.visit(tree, (filePath) => {
    if (!isPipWindowZIndexCandidate(filePath)) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    const result = scanPipWindowZIndexInFile(filePath, content);

    tasks.push(...result.tasks);
    if (result.next !== null) scanned.push({ file: filePath, content, next: result.next, values: result.values });
    if (filePath.endsWith('.ts') && addPipWindowConfigToAppConfig(content, 0) !== null) appConfigs.push(filePath);
  });

  const values = [...new Set(scanned.flatMap((entry) => entry.values))];
  const [layer] = values;
  const changed: string[] = [];

  if (values.length === 1 && layer !== undefined && appConfigs.length > 0) {
    for (const entry of scanned) {
      tree.write(entry.file, entry.next ?? entry.content);
      changed.push(entry.file);
    }

    for (const filePath of appConfigs) {
      const next = addPipWindowConfigToAppConfig(tree.read(filePath, 'utf-8') ?? '', layer);
      if (next === null) continue;

      tree.write(filePath, next);
      changed.push(filePath);
    }
  } else {
    const reason =
      values.length > 1
        ? `The workspace sets ${values.join(', ')}; the migration moves only one value.`
        : 'The migration found no application config to add `providePipWindowConfig` to.';

    for (const entry of scanned) {
      tasks.push(...pipWindowZIndexTasks(entry.file, entry.content, `Sets a literal level. ${reason}`));
    }
  }

  tasks.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

  if (tasks.length > 0) {
    tree.write(PIP_WINDOW_Z_INDEX_REPORT_PATH, renderReport(tasks));
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  if (changed.length > 0) {
    console.log(
      `\n✅ Moved ${PIP_WINDOW_Z_INDEX_PROPERTY}: ${layer} into providePipWindowConfig (${changed.length} file(s)).`,
    );
  }

  if (tasks.length > 0) {
    console.log(`\n⚠️  ${tasks.length} site(s) need it by hand — see ${PIP_WINDOW_Z_INDEX_REPORT_PATH}:`);
    for (const task of tasks) console.log(`   ${task.file}:${task.line}`);
  } else if (changed.length === 0) {
    console.log('\n✅ Nothing to do.');
  }
}
