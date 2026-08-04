import { Provider } from '@angular/core';
import { createRichTextEditorCodeBlock } from '../headless/internals/rich-text-editor-dom-code-block';
import {
  RICH_TEXT_EDITOR_DOM_FEATURE,
  RichTextEditorDomFeature,
} from '../headless/internals/rich-text-editor-dom-features';
import { DEFAULT_RICH_TEXT_EDITOR_LABELS } from '../rich-text-editor-labels';
import { RICH_TEXT_EDITOR_TOOL, RichTextEditorToolDefinition } from '../rich-text-editor-tools';

/**
 * Registers the `'codeBlock'` tool: turning the selected blocks into a fenced code block and back,
 * the newline-on-Enter behavior inside a fence, the Escape and arrow-key exits, and the ```` ``` ````
 * markdown autoformat prefix. `'codeBlock'` is in the default toolbar, so this provider is all it
 * takes - without it the editor renders no fence control, ```` ``` ```` stays literal text, and the
 * fenced-code DOM operations tree-shake away.
 *
 * A fence a value already contains still renders (Markdown → HTML does not need this), but it is
 * then plain content: none of the caret handling above applies to it.
 *
 * @example
 * providers: [provideRichTextEditorCodeBlockTool()]
 */
export const provideRichTextEditorCodeBlockTool = (): Provider[] => [
  {
    provide: RICH_TEXT_EDITOR_DOM_FEATURE,
    useValue: {
      key: 'codeBlock',
      create: ({ core }) => createRichTextEditorCodeBlock(core),
    } satisfies RichTextEditorDomFeature,
    multi: true,
  },
  {
    provide: RICH_TEXT_EDITOR_TOOL,
    useValue: {
      token: 'codeBlock',
      icon: 'et-code-block',
      // Only a fallback: the toolbar reads `codeBlock` from the label set, which is what a consumer localizes.
      label: DEFAULT_RICH_TEXT_EDITOR_LABELS.codeBlock,
      isActive: (editor) => editor.codeBlockActive(),
      run: (editor) => editor.toggleCodeBlock(),
      isDisabled: (editor) => editor.codeBlockToolDisabled(),
    } satisfies RichTextEditorToolDefinition,
    multi: true,
  },
];
