import { Provider } from '@angular/core';
import { provideRichTextEditorAutoformat } from './rich-text-editor-autoformat.provider';
import { provideRichTextEditorBlockquoteTool } from './rich-text-editor-blockquote.provider';
import { provideRichTextEditorCodeBlockTool } from './rich-text-editor-code-block.provider';
import { provideRichTextEditorHeadingTool } from './rich-text-editor-heading.provider';
import { provideRichTextEditorLinkTool } from './rich-text-editor-link.provider';

/**
 * Everything {@link DEFAULT_RICH_TEXT_EDITOR_TOOLS} names that is opt-in: the block-style menu,
 * quotes, fenced code, links and markdown-as-you-type. Registering this gives an editor the full
 * default toolbar in one line.
 *
 * It also pulls all five domains into the bundle. An editor that needs fewer - a comment box wants
 * marks, lists and links, not fences - registers just those providers instead and leaves the rest
 * out; that is the whole reason they are separate.
 *
 * The always-built-in tools (undo/redo, the inline marks, the two lists) need no provider, and
 * alignment, tables and images are not in the default toolbar - they have their own providers.
 *
 * @example
 * providers: [provideRichTextEditorDefaultTools()]
 */
export const provideRichTextEditorDefaultTools = (): Provider[] => [
  provideRichTextEditorHeadingTool(),
  provideRichTextEditorBlockquoteTool(),
  provideRichTextEditorCodeBlockTool(),
  provideRichTextEditorLinkTool(),
  provideRichTextEditorAutoformat(),
];
