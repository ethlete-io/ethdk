import { Provider } from '@angular/core';
import { QUOTE_ICON } from '../../../icon';
import { createRichTextEditorBlockquote } from '../headless/internals/rich-text-editor-dom-blockquote';
import {
  RICH_TEXT_EDITOR_DOM_FEATURE,
  RichTextEditorDomFeature,
} from '../headless/internals/rich-text-editor-dom-features';
import { DEFAULT_RICH_TEXT_EDITOR_LABELS } from '../rich-text-editor-labels';
import { RICH_TEXT_EDITOR_TOOL, RichTextEditorToolDefinition } from '../rich-text-editor-tools';
import { RICH_TEXT_EDITOR_TOOL_ICON } from './rich-text-editor-tool-icons';

/**
 * Registers the `'blockquote'` tool: quoting the selected blocks as `> ` lines, lifting a quote back
 * out, Tab/Shift+Tab nesting, the Enter-on-the-last-line exit and the `> ` markdown autoformat
 * prefix. `'blockquote'` is in the default toolbar, so this provider is all it takes - without it the
 * editor renders no quote control, `> ` stays literal text, and the quote DOM operations tree-shake
 * away.
 *
 * @example
 * providers: [provideRichTextEditorBlockquoteTool()]
 */
export const provideRichTextEditorBlockquoteTool = (): Provider[] => [
  {
    provide: RICH_TEXT_EDITOR_DOM_FEATURE,
    useValue: {
      key: 'blockquote',
      create: ({ core }) => createRichTextEditorBlockquote(core),
    } satisfies RichTextEditorDomFeature,
    multi: true,
  },
  {
    provide: RICH_TEXT_EDITOR_TOOL_ICON,
    useValue: QUOTE_ICON,
    multi: true,
  },
  {
    provide: RICH_TEXT_EDITOR_TOOL,
    useValue: {
      token: 'blockquote',
      icon: 'et-quote',
      // Only a fallback: the toolbar reads `blockquote` from the label set, which is what a consumer localizes.
      label: DEFAULT_RICH_TEXT_EDITOR_LABELS.blockquote,
      isActive: (editor) => editor.blockquoteActive(),
      run: (editor) => editor.toggleBlockquote(),
      isDisabled: (editor) => editor.blockquoteToolDisabled(),
    } satisfies RichTextEditorToolDefinition,
    multi: true,
  },
];
