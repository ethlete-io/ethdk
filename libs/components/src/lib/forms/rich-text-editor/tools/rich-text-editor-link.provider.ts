import { Provider } from '@angular/core';
import {
  RICH_TEXT_EDITOR_DOM_FEATURE,
  RichTextEditorDomFeature,
} from '../headless/internals/rich-text-editor-dom-features';
import { createRichTextEditorLinks } from '../headless/internals/rich-text-editor-dom-links';
import { DEFAULT_RICH_TEXT_EDITOR_LABELS } from '../rich-text-editor-labels';
import { RICH_TEXT_EDITOR_TOOL, RichTextEditorToolDefinition } from '../rich-text-editor-tools';

/**
 * Registers the `'link'` tool and the link DOM operations behind
 * {@link RichTextEditorDirective.applyLink} / `removeLink` / `promptForLink`. `'link'` is in the
 * default toolbar and in {@link RICH_TEXT_EDITOR_INLINE_TOOLS}, so this provider is all it takes -
 * without it neither toolbar renders a link control and the link DOM operations tree-shake away.
 *
 * What the tool *opens* is a separate opt-in: with `provideRichTextEditorLinkEditor()` it is the
 * popover form, without it `window.prompt`.
 *
 * @example
 * providers: [provideRichTextEditorLinkTool(), provideRichTextEditorLinkEditor()]
 */
export const provideRichTextEditorLinkTool = (): Provider[] => [
  {
    provide: RICH_TEXT_EDITOR_DOM_FEATURE,
    useValue: {
      key: 'links',
      create: ({ core }) => createRichTextEditorLinks(core),
    } satisfies RichTextEditorDomFeature,
    multi: true,
  },
  {
    provide: RICH_TEXT_EDITOR_TOOL,
    useValue: {
      token: 'link',
      icon: 'et-link',
      // Only a fallback: the toolbar reads `link` from the label set, which is what a consumer localizes.
      label: DEFAULT_RICH_TEXT_EDITOR_LABELS.link,
      // Also pressed while the link editor popover is open, matching the menu-trigger tools.
      isActive: (editor) => editor.linkActive() || editor.linkEditorOpen(),
      run: (editor) => editor.promptForLink(),
      isDisabled: (editor) => editor.codeBlockActive(),
      // Link keeps its brand color, so its icon opts out of the neutral icon recolor.
      allowHardcodedColor: true,
    } satisfies RichTextEditorToolDefinition,
    multi: true,
  },
];
