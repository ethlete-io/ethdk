import { InjectionToken, Type } from '@angular/core';
import { createStaticRootProvider } from '@ethlete/core';
import { RichTextEditorDirective } from './headless/rich-text-editor.directive';

/**
 * The formatting controls the rich text editor can render in its toolbar. `'divider'` renders a
 * visual separator and `'heading'` renders the block-style menu; every other token renders a toggle
 * button. Consumers pick and order them via the `tools` input or {@link provideRichTextEditorTools}.
 */
export const RICH_TEXT_EDITOR_TOOLS = {
  BOLD: 'bold',
  ITALIC: 'italic',
  UNDERLINE: 'underline',
  STRIKE: 'strike',
  CODE: 'code',
  HEADING: 'heading',
  ALIGN: 'align',
  BULLETED_LIST: 'bulletedList',
  NUMBERED_LIST: 'numberedList',
  LINK: 'link',
  TABLE: 'table',
  DIVIDER: 'divider',
} as const;

/**
 * A toolbar tool token. The `align` and `table` tools are opt-in — they only render when their
 * provider (`provideRichTextEditorAlignmentTool` / `provideRichTextEditorTableTool`) is present, so
 * their code tree-shakes away otherwise. `(string & {})` keeps the union open for custom tools.
 */
export type RichTextEditorTool = (typeof RICH_TEXT_EDITOR_TOOLS)[keyof typeof RICH_TEXT_EDITOR_TOOLS] | (string & {});

/** The default toolbar: the block-style menu first, then inline marks, lists and links. */
export const DEFAULT_RICH_TEXT_EDITOR_TOOLS: readonly RichTextEditorTool[] = [
  'heading',
  'divider',
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'divider',
  'bulletedList',
  'numberedList',
  'divider',
  'link',
];

/** The inline marks the selection (floating) toolbar can offer — headings/lists are block-level. */
export const RICH_TEXT_EDITOR_INLINE_TOOLS: readonly RichTextEditorTool[] = [
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'link',
];

export type RichTextEditorToolsConfig = { tools: readonly RichTextEditorTool[] };

const [ɵprovideRichTextEditorTools, injectRichTextEditorTools] = createStaticRootProvider<RichTextEditorToolsConfig>(
  { tools: DEFAULT_RICH_TEXT_EDITOR_TOOLS },
  { name: 'RichTextEditorTools' },
);

/**
 * Sets the default set (and order) of toolbar tools for every `et-rich-text-editor` in scope. A
 * per-instance `[tools]` input still wins over this. Omit both for the full default toolbar.
 */
export const provideRichTextEditorTools = (tools: readonly RichTextEditorTool[]) =>
  ɵprovideRichTextEditorTools({ tools });

export { injectRichTextEditorTools };

/** Icon + label + wiring for a single toggle-button tool. */
export type RichTextEditorToolButton = {
  icon: string;
  label: string;
  isActive: (editor: RichTextEditorDirective) => boolean;
  run: (editor: RichTextEditorDirective) => void;
  /** Link keeps its brand color, so its icon opts out of the neutral icon recolor. */
  allowHardcodedColor?: boolean;
};

/** The toggle-button tools, keyed by token (`divider`/`heading` are rendered specially). */
export const RICH_TEXT_EDITOR_TOOL_BUTTONS: Partial<Record<RichTextEditorTool, RichTextEditorToolButton>> = {
  bold: { icon: 'et-bold', label: 'Bold', isActive: (e) => e.boldActive(), run: (e) => e.toggleBold() },
  italic: { icon: 'et-italic', label: 'Italic', isActive: (e) => e.italicActive(), run: (e) => e.toggleItalic() },
  strike: {
    icon: 'et-strikethrough',
    label: 'Strikethrough',
    isActive: (e) => e.strikeActive(),
    run: (e) => e.toggleStrikethrough(),
  },
  underline: {
    icon: 'et-underline',
    label: 'Underline',
    isActive: (e) => e.underlineActive(),
    run: (e) => e.toggleUnderline(),
  },
  code: {
    icon: 'et-code',
    label: 'Inline code',
    isActive: (e) => e.codeActive(),
    run: (e) => e.toggleInlineCode(),
  },
  bulletedList: {
    icon: 'et-list-bulleted',
    label: 'Bulleted list',
    isActive: (e) => e.unorderedListActive(),
    run: (e) => e.toggleUnorderedList(),
  },
  numberedList: {
    icon: 'et-list-numbered',
    label: 'Numbered list',
    isActive: (e) => e.orderedListActive(),
    run: (e) => e.toggleOrderedList(),
  },
  link: {
    icon: 'et-link',
    label: 'Link',
    isActive: (e) => e.linkActive(),
    run: (e) => e.promptForLink(),
    allowHardcodedColor: true,
  },
};

/** Block-style options for the heading menu. `null` is a normal paragraph. */
export const RICH_TEXT_EDITOR_HEADING_OPTIONS: readonly { level: number | null; label: string; icon: string }[] = [
  { level: null, label: 'Normal', icon: 'et-paragraph' },
  { level: 1, label: 'Heading 1', icon: 'et-heading-1' },
  { level: 2, label: 'Heading 2', icon: 'et-heading-2' },
  { level: 3, label: 'Heading 3', icon: 'et-heading-3' },
];

/**
 * A tool contributed to the toolbar via DI. Base tools are the static {@link RICH_TEXT_EDITOR_TOOL_BUTTONS};
 * opt-in tools (table, alignment, or app-defined ones) register a definition through
 * {@link RICH_TEXT_EDITOR_TOOL} so their code only ships when provided. A tool renders either as a
 * toggle button (`icon` + `isActive`/`run`) or as a custom `control` component (given an `editor` input).
 */
export type RichTextEditorToolDefinition = {
  /** The `tools` token this definition renders for (e.g. `'table'`). */
  token: string;
  label: string;
  icon?: string;
  allowHardcodedColor?: boolean;
  isActive?: (editor: RichTextEditorDirective) => boolean;
  run?: (editor: RichTextEditorDirective) => void;
  /** Custom control rendered instead of a toggle button; it receives the editor as an `editor` input. */
  control?: Type<unknown>;
};

/** Multi-provider token opt-in tools register their {@link RichTextEditorToolDefinition} into. */
export const RICH_TEXT_EDITOR_TOOL = new InjectionToken<RichTextEditorToolDefinition[]>('RichTextEditorTool');
