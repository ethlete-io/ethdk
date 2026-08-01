import { formatFiles, Tree } from '@nx/devkit';
import { createMigrationScope, MigrationScopeOptions } from '../migrate-query-error-labels/migration-scope.js';
import { RichTextEditorLinkEditorTask, scanRichTextEditorLinkEditorInFile } from './rich-text-editor-link-editor.js';

export const RICH_TEXT_EDITOR_LINK_EDITOR_REPORT_PATH = 'rich-text-editor-link-editor-migration-tasks.md';

const renderReport = (tasks: RichTextEditorLinkEditorTask[]) =>
  [
    '# Rich text editor link editor migration tasks',
    '',
    'The rich text editor no longer mounts the link editor popover. Its `link` tool now falls back to the',
    "browser's `prompt()`, so an editor that never opts in stops bundling the popover (and the form",
    'controls and overlay strategies it pulls in).',
    '',
    'To keep the popover, add once — app-wide, or on the component/route that renders the editor:',
    '',
    '```ts',
    "import { provideRichTextEditorLinkEditor } from '@ethlete/components';",
    '',
    'provideRichTextEditorLinkEditor();',
    '```',
    '',
    'If the prompt fallback is fine (or the app never uses the `link` tool), there is nothing to do — delete',
    'this file.',
    '',
    ...tasks.map((task) =>
      [`## \`${task.id}\``, '', `- ${task.file}:${task.line}`, `- ${task.message}`, ''].join('\n'),
    ),
  ].join('\n');

type MigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
};

export default async function migrateRichTextEditorLinkEditor(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔎 Scanning for rich text editor usage affected by the opt-in link editor...');

  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  const tasks: RichTextEditorLinkEditorTask[] = [];
  let hasLinkEditorProvider = false;

  scope.visit(tree, (filePath) => {
    if (!/\.(ts|html)$/.test(filePath) || filePath.endsWith('.d.ts')) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    const result = scanRichTextEditorLinkEditorInFile(filePath, content);

    tasks.push(...result.usages);
    hasLinkEditorProvider ||= result.hasLinkEditorProvider;
  });

  if (hasLinkEditorProvider) {
    console.log('   ✓ Found a provideRichTextEditorLinkEditor call — the popover is already opted back in.');
  } else if (tasks.length > 0) {
    tree.write(RICH_TEXT_EDITOR_LINK_EDITOR_REPORT_PATH, renderReport(tasks));
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  if (!hasLinkEditorProvider && tasks.length > 0) {
    console.log(
      `\n⚠️  ${tasks.length} site(s) use the rich text editor without the link editor — see ${RICH_TEXT_EDITOR_LINK_EDITOR_REPORT_PATH}.`,
    );
  } else {
    console.log('\n✅ Nothing to do.');
  }
}
