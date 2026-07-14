import { Provider } from '@angular/core';
import { RICH_TEXT_EDITOR_TOOL, RichTextEditorToolDefinition } from '../rich-text-editor-tools';
import { RichTextEditorAlignToolComponent } from './rich-text-editor-align-tool.component';

/**
 * Registers the opt-in `'align'` tool (block text-align: left / center / right / justify). Add to a
 * component/route's providers and include `'align'` in the editor's `tools`. Alignment persists as a
 * native `text-align` style on the block (Markdown has no alignment syntax). Tree-shakes when unused.
 */
export const provideRichTextEditorAlignmentTool = (): Provider => ({
  provide: RICH_TEXT_EDITOR_TOOL,
  useValue: {
    token: 'align',
    label: 'Alignment',
    control: RichTextEditorAlignToolComponent,
  } satisfies RichTextEditorToolDefinition,
  multi: true,
});
