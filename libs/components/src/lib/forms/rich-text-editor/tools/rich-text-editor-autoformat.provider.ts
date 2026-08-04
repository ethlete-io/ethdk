import { Provider } from '@angular/core';
import { createRichTextEditorAutoformat } from '../headless/internals/rich-text-editor-dom-autoformat';
import {
  RICH_TEXT_EDITOR_DOM_FEATURE,
  RichTextEditorDomFeature,
} from '../headless/internals/rich-text-editor-dom-features';

/**
 * Turns on markdown-as-you-type for every editor in scope: at a line start `- `, `1. `, `# `–`### `,
 * `> ` and ```` ``` ```` convert the block, and a closing `**bold**`, `*italic*`, `` `code` ``,
 * `~~strike~~`, `__`/`_` run converts into its mark. Registered token-trigger characters never
 * autoformat, and the editor's `autoformat` input still switches it off per instance.
 *
 * Each block rule needs its own domain to be provided as well - `# ` only converts with
 * `provideRichTextEditorHeadingTool()`, `> ` with `provideRichTextEditorBlockquoteTool()`,
 * ```` ``` ```` with `provideRichTextEditorCodeBlockTool()`. The list and inline rules work on their
 * own.
 *
 * @example
 * providers: [provideRichTextEditorAutoformat()]
 */
export const provideRichTextEditorAutoformat = (): Provider => ({
  provide: RICH_TEXT_EDITOR_DOM_FEATURE,
  useValue: {
    key: 'autoformat',
    create: ({ core, lists, features }) => createRichTextEditorAutoformat(core, { lists, features }),
  } satisfies RichTextEditorDomFeature,
  multi: true,
});
