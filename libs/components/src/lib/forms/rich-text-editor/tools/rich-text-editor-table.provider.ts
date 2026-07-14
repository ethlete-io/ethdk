import { Provider } from '@angular/core';
import { RICH_TEXT_EDITOR_TOOL, RichTextEditorToolDefinition } from '../rich-text-editor-tools';
import { RichTextEditorTableToolComponent } from './rich-text-editor-table-tool.component';

/**
 * Registers the opt-in `'table'` tool (insert via a grid-size picker, plus row/column editing). Add
 * to a component/route's providers and include `'table'` in the editor's `tools`. Because the tool
 * component and its table DOM operations are only referenced from here, they tree-shake away for
 * editors that don't provide it.
 */
export const provideRichTextEditorTableTool = (): Provider => ({
  provide: RICH_TEXT_EDITOR_TOOL,
  useValue: {
    token: 'table',
    label: 'Table',
    control: RichTextEditorTableToolComponent,
  } satisfies RichTextEditorToolDefinition,
  multi: true,
});
