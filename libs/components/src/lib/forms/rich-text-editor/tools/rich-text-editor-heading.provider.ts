import { Provider } from '@angular/core';
import {
  RICH_TEXT_EDITOR_DOM_FEATURE,
  RichTextEditorDomFeature,
} from '../headless/internals/rich-text-editor-dom-features';
import { createRichTextEditorHeadings } from '../headless/internals/rich-text-editor-dom-headings';
import { DEFAULT_RICH_TEXT_EDITOR_LABELS } from '../rich-text-editor-labels';
import { RICH_TEXT_EDITOR_TOOL, RichTextEditorToolDefinition } from '../rich-text-editor-tools';
import { RichTextEditorHeadingToolComponent } from './rich-text-editor-heading-tool.component';

/**
 * Registers the `'heading'` tool: the block-style menu (paragraph, H1, H2, H3), the Enter-at-a-
 * heading-edge behavior and the `# `–`### ` markdown autoformat prefixes. `'heading'` is in the
 * default toolbar, so this provider is all it takes - without it the editor renders no block-style
 * control, `# ` stays literal text, and the heading DOM operations tree-shake away.
 */
export const provideRichTextEditorHeadingTool = (): Provider[] => [
  {
    provide: RICH_TEXT_EDITOR_DOM_FEATURE,
    useValue: {
      key: 'headings',
      create: ({ core }) => createRichTextEditorHeadings(core),
    } satisfies RichTextEditorDomFeature,
    multi: true,
  },
  {
    provide: RICH_TEXT_EDITOR_TOOL,
    useValue: {
      token: 'heading',
      // Only a fallback: the toolbar reads `heading` from the label set, which is what a consumer localizes.
      label: DEFAULT_RICH_TEXT_EDITOR_LABELS.textStyle(DEFAULT_RICH_TEXT_EDITOR_LABELS.paragraph),
      control: RichTextEditorHeadingToolComponent,
    } satisfies RichTextEditorToolDefinition,
    multi: true,
  },
];
