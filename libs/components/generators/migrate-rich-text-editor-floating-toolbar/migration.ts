import { formatFiles, Tree } from '@nx/devkit';
import { createMigrationScope, MigrationScopeOptions } from '../migrate-query-error-labels/migration-scope.js';
import {
  RichTextEditorFloatingToolbarTask,
  scanRichTextEditorFloatingToolbarInFile,
} from './rich-text-editor-floating-toolbar.js';

export const RICH_TEXT_EDITOR_FLOATING_TOOLBAR_REPORT_PATH = 'rich-text-editor-floating-toolbar-migration-tasks.md';

const renderReport = (tasks: RichTextEditorFloatingToolbarTask[]) =>
  [
    '# Rich text editor selection toolbar migration tasks',
    '',
    'The rich text editor no longer mounts the toolbar that follows the selection. An editor that never opts',
    'in keeps its static toolbar only — and stops bundling the overlay runtime and anchored positioning this',
    'was the sole reason a default editor needed, worth ~15 kB gz (~22 kB with `@floating-ui/dom`).',
    '',
    'To keep it, add once — app-wide, or on the component/route that renders the editor:',
    '',
    '```ts',
    "import { provideRichTextEditorFloatingToolbar } from '@ethlete/components';",
    '',
    'provideRichTextEditorFloatingToolbar();',
    '```',
    '',
    'It never offered an action the static toolbar does not, and it was already suppressed on touch devices, so',
    'leaving it out costs no functionality — if that is fine, there is nothing to do; delete this file.',
    '',
    ...tasks.map((task) =>
      [`## \`${task.id}\``, '', `- ${task.file}:${task.line}`, `- ${task.message}`, ''].join('\n'),
    ),
  ].join('\n');

type MigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
};

export default async function migrateRichTextEditorFloatingToolbar(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔎 Scanning for rich text editor usage affected by the opt-in selection toolbar...');

  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  const tasks: RichTextEditorFloatingToolbarTask[] = [];
  let hasFloatingToolbarProvider = false;

  scope.visit(tree, (filePath) => {
    if (!/\.(ts|html)$/.test(filePath) || filePath.endsWith('.d.ts')) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    const result = scanRichTextEditorFloatingToolbarInFile(filePath, content);

    tasks.push(...result.usages);
    hasFloatingToolbarProvider ||= result.hasFloatingToolbarProvider;
  });

  if (hasFloatingToolbarProvider) {
    console.log('   ✓ Found a provideRichTextEditorFloatingToolbar call — it is already opted back in.');
  } else if (tasks.length > 0) {
    tree.write(RICH_TEXT_EDITOR_FLOATING_TOOLBAR_REPORT_PATH, renderReport(tasks));
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  if (!hasFloatingToolbarProvider && tasks.length > 0) {
    console.log(
      `\n⚠️  ${tasks.length} site(s) use the rich text editor without the selection toolbar — see ${RICH_TEXT_EDITOR_FLOATING_TOOLBAR_REPORT_PATH}.`,
    );
  } else {
    console.log('\n✅ Nothing to do.');
  }
}
