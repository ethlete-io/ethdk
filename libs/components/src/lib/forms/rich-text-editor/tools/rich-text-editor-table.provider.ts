import { Provider } from '@angular/core';
import { injectRenderer } from '@ethlete/core';
import { DEFAULT_RICH_TEXT_EDITOR_LABELS } from '../rich-text-editor-labels';
import { RICH_TEXT_EDITOR_TOOL, RichTextEditorToolDefinition } from '../rich-text-editor-tools';
import { RichTextEditorTableToolComponent } from './rich-text-editor-table-tool.component';
import { createTableNav } from './rich-text-editor-table.util';

/**
 * Registers the opt-in `'table'` tool (insert via a grid-size picker, plus row/column editing) and
 * the caret navigation across table boundaries: arrow keys step in/out at the table's edges, and
 * Tab/Shift+Tab move between cells (stepping out past the first/last cell). Add to a
 * component/route's providers and include `'table'` in the editor's `tools`. Because the tool
 * component and all table DOM operations (including the caret navigation) are only referenced from
 * here, they tree-shake away for editors that don't provide it.
 */
export const provideRichTextEditorTableTool = (): Provider => ({
  provide: RICH_TEXT_EDITOR_TOOL,
  useFactory: (): RichTextEditorToolDefinition => {
    const nav = createTableNav(injectRenderer());

    return {
      token: 'table',
      // Only a fallback: the toolbar reads `table` from the label set, which is what a consumer localizes.
      label: DEFAULT_RICH_TEXT_EDITOR_LABELS.table,
      control: RichTextEditorTableToolComponent,
      keydown: (editor, event) =>
        nav.tab(editor.editorDom, event) ||
        nav.exit(editor.editorDom, event.key) ||
        nav.enter(editor.editorDom, event.key),
    };
  },
  multi: true,
});
