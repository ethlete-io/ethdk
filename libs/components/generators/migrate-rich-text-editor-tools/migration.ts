import { formatFiles, Tree } from '@nx/devkit';
import { createMigrationScope, MigrationScopeOptions } from '../migrate-query-error-labels/migration-scope.js';
import { RichTextEditorToolsTask, scanRichTextEditorToolsInFile } from './rich-text-editor-tools.js';

export const RICH_TEXT_EDITOR_TOOLS_REPORT_PATH = 'rich-text-editor-tools-migration-tasks.md';

const renderReport = (tasks: RichTextEditorToolsTask[]) =>
  [
    '# Rich text editor tools migration tasks',
    '',
    "The rich text editor's block-style menu, quotes, code blocks, links and markdown-as-you-type are opt-in.",
    'Without a provider those four buttons render nothing and a typed `# ` / `> ` / ``` stays literal text, so',
    'an editor that only needs marks and lists stops bundling any of it.',
    '',
    'To get the previous toolbar back, add once — app-wide, or on the component/route that renders the editor:',
    '',
    '```ts',
    "import { provideRichTextEditorDefaultTools } from '@ethlete/components';",
    '',
    'provideRichTextEditorDefaultTools();',
    '```',
    '',
    'For a smaller editor, register only what it offers instead:',
    '`provideRichTextEditorHeadingTool()`, `provideRichTextEditorBlockquoteTool()`,',
    '`provideRichTextEditorCodeBlockTool()`, `provideRichTextEditorLinkTool()`,',
    '`provideRichTextEditorAutoformat()`.',
    '',
    'Calling `toggleBlockquote()`, `toggleHeading()`, `applyLink()` and friends without their provider throws',
    '`ET2506` in dev mode and no-ops in production.',
    '',
    'If marks and lists are all the app needs, there is nothing to do — delete this file.',
    '',
    ...tasks.map((task) =>
      [`## \`${task.id}\``, '', `- ${task.file}:${task.line}`, `- ${task.message}`, ''].join('\n'),
    ),
  ].join('\n');

type MigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
};

export default async function migrateRichTextEditorTools(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔎 Scanning for rich text editor usage affected by the opt-in tools...');

  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  const tasks: RichTextEditorToolsTask[] = [];
  let hasToolProvider = false;

  scope.visit(tree, (filePath) => {
    if (!/\.(ts|html)$/.test(filePath) || filePath.endsWith('.d.ts')) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    const result = scanRichTextEditorToolsInFile(filePath, content);

    tasks.push(...result.usages);
    hasToolProvider ||= result.hasToolProvider;
  });

  if (hasToolProvider) {
    console.log('   ✓ Found a tool provider — the app already opts into the tools it wants.');
  } else if (tasks.length > 0) {
    tree.write(RICH_TEXT_EDITOR_TOOLS_REPORT_PATH, renderReport(tasks));
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  if (!hasToolProvider && tasks.length > 0) {
    console.log(
      `\n⚠️  ${tasks.length} site(s) use the rich text editor without any tool provider — see ${RICH_TEXT_EDITOR_TOOLS_REPORT_PATH}.`,
    );
  } else {
    console.log('\n✅ Nothing to do.');
  }
}
