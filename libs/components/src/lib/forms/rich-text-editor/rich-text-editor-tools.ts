import { InjectionToken, Type } from '@angular/core';
import { createStaticRootProvider } from '@ethlete/core';
import { RichTextEditorDirective } from './headless/rich-text-editor.directive';
import { DEFAULT_RICH_TEXT_EDITOR_LABELS } from './rich-text-editor-labels';

/**
 * The formatting controls the rich text editor can render in its toolbar. `'divider'` renders a
 * visual separator and `'heading'` renders the block-style menu; every other token renders a toggle
 * button. Consumers pick and order them via the `tools` input or {@link provideRichTextEditorTools}.
 */
export const RICH_TEXT_EDITOR_TOOLS = {
  UNDO: 'undo',
  REDO: 'redo',
  BOLD: 'bold',
  ITALIC: 'italic',
  UNDERLINE: 'underline',
  STRIKE: 'strike',
  CODE: 'code',
  HEADING: 'heading',
  ALIGN: 'align',
  BULLETED_LIST: 'bulletedList',
  NUMBERED_LIST: 'numberedList',
  BLOCKQUOTE: 'blockquote',
  CODE_BLOCK: 'codeBlock',
  LINK: 'link',
  TABLE: 'table',
  IMAGE: 'image',
  DIVIDER: 'divider',
} as const;

/**
 * A toolbar tool token. The `align`, `table` and `image` tools are opt-in — they only render when
 * their provider (`provideRichTextEditorAlignmentTool` / `provideRichTextEditorTableTool` /
 * `provideRichTextEditorImageTool`) is present, so their code tree-shakes away otherwise.
 * `(string & {})` keeps the union open for custom tools.
 */
export type RichTextEditorTool = (typeof RICH_TEXT_EDITOR_TOOLS)[keyof typeof RICH_TEXT_EDITOR_TOOLS] | (string & {});

/** The default toolbar: history, then the block-style menu, inline marks, lists and links. */
export const DEFAULT_RICH_TEXT_EDITOR_TOOLS: readonly RichTextEditorTool[] = [
  'undo',
  'redo',
  'divider',
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
  'blockquote',
  'codeBlock',
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

/**
 * Icon + label + wiring for a single toggle-button tool.
 *
 * `label` is only the fallback: what the toolbar renders comes from `RICH_TEXT_EDITOR_LABELS`, keyed by
 * the tool's token — which is why the built-in tables below read their labels from that set's defaults
 * rather than repeating them.
 */
export type RichTextEditorToolButton = {
  icon: string;
  label: string;
  isActive: (editor: RichTextEditorDirective) => boolean;
  run: (editor: RichTextEditorDirective) => void;
  /** Disables the button in contexts where the tool cannot apply (e.g. lists inside a table cell). */
  isDisabled?: (editor: RichTextEditorDirective) => boolean;
  /** Link keeps its brand color, so its icon opts out of the neutral icon recolor. */
  allowHardcodedColor?: boolean;
};

/** The toggle-button tools, keyed by token (`divider`/`heading` are rendered specially). */
export const RICH_TEXT_EDITOR_TOOL_BUTTONS: Partial<Record<RichTextEditorTool, RichTextEditorToolButton>> = {
  // Undo/redo are actions, not toggles: they never report an active state, and disable themselves
  // at the ends of the history so the bar shows whether there is anything left to take back.
  undo: {
    icon: 'et-undo',
    label: DEFAULT_RICH_TEXT_EDITOR_LABELS.undo,
    isActive: () => false,
    run: (e) => e.undo(),
    isDisabled: (e) => !e.canUndo(),
  },
  redo: {
    icon: 'et-redo',
    label: DEFAULT_RICH_TEXT_EDITOR_LABELS.redo,
    isActive: () => false,
    run: (e) => e.redo(),
    isDisabled: (e) => !e.canRedo(),
  },
  bold: {
    icon: 'et-bold',
    label: DEFAULT_RICH_TEXT_EDITOR_LABELS.bold,
    isActive: (e) => e.boldActive(),
    run: (e) => e.toggleBold(),
    isDisabled: (e) => e.codeBlockActive(),
  },
  italic: {
    icon: 'et-italic',
    label: DEFAULT_RICH_TEXT_EDITOR_LABELS.italic,
    isActive: (e) => e.italicActive(),
    run: (e) => e.toggleItalic(),
    isDisabled: (e) => e.codeBlockActive(),
  },
  strike: {
    icon: 'et-strikethrough',
    label: DEFAULT_RICH_TEXT_EDITOR_LABELS.strike,
    isActive: (e) => e.strikeActive(),
    run: (e) => e.toggleStrikethrough(),
    isDisabled: (e) => e.codeBlockActive(),
  },
  underline: {
    icon: 'et-underline',
    label: DEFAULT_RICH_TEXT_EDITOR_LABELS.underline,
    isActive: (e) => e.underlineActive(),
    run: (e) => e.toggleUnderline(),
    isDisabled: (e) => e.codeBlockActive(),
  },
  code: {
    icon: 'et-code',
    label: DEFAULT_RICH_TEXT_EDITOR_LABELS.code,
    isActive: (e) => e.codeActive(),
    run: (e) => e.toggleInlineCode(),
    isDisabled: (e) => e.codeBlockActive(),
  },
  bulletedList: {
    icon: 'et-list-bulleted',
    label: DEFAULT_RICH_TEXT_EDITOR_LABELS.bulletedList,
    isActive: (e) => e.unorderedListActive(),
    run: (e) => e.toggleUnorderedList(),
    isDisabled: (e) => e.listToolDisabled(),
  },
  numberedList: {
    icon: 'et-list-numbered',
    label: DEFAULT_RICH_TEXT_EDITOR_LABELS.numberedList,
    isActive: (e) => e.orderedListActive(),
    run: (e) => e.toggleOrderedList(),
    isDisabled: (e) => e.listToolDisabled(),
  },
  blockquote: {
    icon: 'et-quote',
    label: DEFAULT_RICH_TEXT_EDITOR_LABELS.blockquote,
    isActive: (e) => e.blockquoteActive(),
    run: (e) => e.toggleBlockquote(),
    isDisabled: (e) => e.blockquoteToolDisabled(),
  },
  codeBlock: {
    icon: 'et-code-block',
    label: DEFAULT_RICH_TEXT_EDITOR_LABELS.codeBlock,
    isActive: (e) => e.codeBlockActive(),
    run: (e) => e.toggleCodeBlock(),
    isDisabled: (e) => e.codeBlockToolDisabled(),
  },
  link: {
    icon: 'et-link',
    label: DEFAULT_RICH_TEXT_EDITOR_LABELS.link,
    // Also pressed while the link editor popover is open, matching the menu-trigger tools.
    isActive: (e) => e.linkActive() || e.linkEditorOpen(),
    run: (e) => e.promptForLink(),
    isDisabled: (e) => e.codeBlockActive(),
    allowHardcodedColor: true,
  },
};

/** Block-style options for the heading menu. `null` is a normal paragraph. */
export const RICH_TEXT_EDITOR_HEADING_OPTIONS: readonly { level: number | null; label: string; icon: string }[] = [
  { level: null, label: DEFAULT_RICH_TEXT_EDITOR_LABELS.paragraph, icon: 'et-paragraph' },
  { level: 1, label: DEFAULT_RICH_TEXT_EDITOR_LABELS.heading(1), icon: 'et-heading-1' },
  { level: 2, label: DEFAULT_RICH_TEXT_EDITOR_LABELS.heading(2), icon: 'et-heading-2' },
  { level: 3, label: DEFAULT_RICH_TEXT_EDITOR_LABELS.heading(3), icon: 'et-heading-3' },
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
  /** Disables the button in contexts where the tool cannot apply (e.g. lists inside a table cell). */
  isDisabled?: (editor: RichTextEditorDirective) => boolean;
  /** Custom control rendered instead of a toggle button; it receives the editor as an `editor` input. */
  control?: Type<unknown>;
  /**
   * Intercepts a keydown inside the editor content before the editor's own handling (but after
   * list Tab/Enter handling). Runs for every provided tool — even when its `token` is not in the
   * visible toolbar, since it acts on content, not the button (e.g. table caret navigation must
   * work whenever the value can contain a table). Return `true` when the event was handled — the
   * editor then calls `preventDefault()` and syncs its value from the DOM.
   */
  keydown?: (editor: RichTextEditorDirective, event: KeyboardEvent) => boolean;

  /**
   * Intercepts a paste into the editor content **before** the editor's own HTML/text handling — the
   * hook for a payload only this tool understands (the image tool takes the clipboard's image
   * files). Return `true` when it was handled; the editor then calls `preventDefault()`.
   */
  paste?: (editor: RichTextEditorDirective, event: ClipboardEvent) => boolean;

  /**
   * Intercepts a drop into the editor content. Return `true` when it was handled; the editor then
   * calls `preventDefault()`, so the browser never inserts the dropped payload itself.
   */
  drop?: (editor: RichTextEditorDirective, event: DragEvent) => boolean;

  /**
   * Intercepts a click inside the editor content — for content this tool owns and lets the user act
   * on (clicking an image opens its popover). Return `true` when it was handled.
   */
  click?: (editor: RichTextEditorDirective, event: MouseEvent) => boolean;

  /**
   * Normalizes the editor's content into the shape this tool needs, after every render and every
   * value sync — the hook for structure the Markdown cannot carry (the image tool marks image blocks
   * `contenteditable="false"` and keeps a line after a trailing image). It must be **value-neutral**
   * and idempotent: whatever it changes has to serialize to the same Markdown, or the editor would
   * write a value it never got.
   */
  normalize?: (root: HTMLElement) => void;
};

/** Multi-provider token opt-in tools register their {@link RichTextEditorToolDefinition} into. */
export const RICH_TEXT_EDITOR_TOOL = new InjectionToken<RichTextEditorToolDefinition[]>('RichTextEditorTool');
