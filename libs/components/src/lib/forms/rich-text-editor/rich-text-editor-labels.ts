import { createLabels } from '@ethlete/core';

/**
 * Every string the rich text editor renders or announces itself. Defaults are English
 * ({@link DEFAULT_RICH_TEXT_EDITOR_LABELS}); override them app-wide with
 * {@link provideRichTextEditorLabels} or per instance via `et-rich-text-editor`'s `labels` input.
 *
 * Almost all of it is accessible labels: the toolbar's buttons show icons, so their name is the only
 * thing a screen reader has to go on.
 *
 * The **tool** keys (`bold` … `table`) are named after their tool tokens, which is how the toolbar looks
 * a button's name up. A tool your app registers through `RICH_TEXT_EDITOR_TOOL` keeps the `label` on its
 * own definition instead — you wrote that string, so it is already in your language.
 */
export type RichTextEditorLabels = {
  /** Accessible label for the toolbar. */
  toolbar: string;
  /** Accessible label for the toolbar that follows a selection (`floatingToolbar`). */
  selectionToolbar: string;

  /** Accessible name for the block-style menu's trigger, given the current style's own label. */
  textStyle: (currentStyle: string) => string;
  /** Block-style menu entry: a normal paragraph. */
  paragraph: string;
  /** Block-style menu entry for a heading level. */
  heading: (level: number) => string;

  /** Accessible label for the link editor popover. */
  linkEditor: string;
  /** The link editor's heading while the caret sits on an existing link. */
  linkEditorEdit: string;
  /** The link editor's heading while adding a new link. */
  linkEditorAdd: string;
  /** Accessible label for the link editor's close button. */
  linkEditorClose: string;
  /** Label for the link editor's text field. */
  linkTextLabel: string;
  /** Placeholder for the link editor's text field. */
  linkTextPlaceholder: string;
  /** Label for the link editor's URL field. */
  linkUrlLabel: string;
  /** Placeholder for the link editor's URL field. */
  linkUrlPlaceholder: string;
  /** The link editor's "open in a new tab" checkbox. */
  linkNewTab: string;
  /** The link editor's action that strips the link, shown only for an existing one. */
  linkRemove: string;
  /** The link editor's confirm action while adding a link. */
  linkAdd: string;
  /** The link editor's confirm action while editing an existing link. */
  linkUpdate: string;

  /** The token palette's trigger. */
  insertToken: string;
  /** Shown by a token popup or palette that has nothing to offer. */
  noResults: string;

  /** Accessible label for a cell in the table tool's size picker, e.g. `'3 by 4'`. */
  tableSize: (rows: number, columns: number) => string;
  /** The size picker's readout while a size is hovered, e.g. `'3 × 4'`. */
  tableSizePreview: (rows: number, columns: number) => string;
  /** The size picker's readout before any size is hovered. */
  tableInsert: string;
  /** Table menu entry: add a header row to a table that has none. */
  tableInsertHeaderRow: string;
  /** Table menu entry: insert a row above the caret's. */
  tableInsertRowAbove: string;
  /** Table menu entry: insert a row below the caret's. */
  tableInsertRowBelow: string;
  /** Table menu entry: insert a column left of the caret's. */
  tableInsertColumnLeft: string;
  /** Table menu entry: insert a column right of the caret's. */
  tableInsertColumnRight: string;
  /** Table menu entry: delete the caret's row. */
  tableDeleteRow: string;
  /** Table menu entry: delete the caret's column. */
  tableDeleteColumn: string;
  /** Table menu entry: delete the whole table. */
  tableDeleteTable: string;

  /** Toolbar tool: undo the last edit. */
  undo: string;
  /** Toolbar tool: reapply the last undone edit. */
  redo: string;
  /** Toolbar tool: bold. */
  bold: string;
  /** Toolbar tool: italic. */
  italic: string;
  /** Toolbar tool: strikethrough. */
  strike: string;
  /** Toolbar tool: underline. */
  underline: string;
  /** Toolbar tool: inline code. */
  code: string;
  /** Toolbar tool: bulleted list. */
  bulletedList: string;
  /** Toolbar tool: numbered list. */
  numberedList: string;
  /** Toolbar tool: block quote. */
  blockquote: string;
  /** Toolbar tool: fenced code block. */
  codeBlock: string;
  /** Toolbar tool: link. */
  link: string;
  /** Toolbar tool: the opt-in alignment menu. */
  align: string;
  /** Accessible label for the alignment menu's trigger. */
  alignTrigger: string;
  /** Alignment menu entry: align left. */
  alignLeft: string;
  /** Alignment menu entry: center. */
  alignCenter: string;
  /** Alignment menu entry: align right. */
  alignRight: string;
  /** Alignment menu entry: justify. */
  alignJustify: string;
  /** Toolbar tool: the opt-in table menu, and its trigger. */
  table: string;
  /** Toolbar tool: the multi-language editor's language switcher. */
  language: string;
  /** Accessible name for the language switcher's trigger, given the active language's own name. */
  languageTrigger: (currentLanguage: string) => string;
};

/** The built-in English labels. */
export const DEFAULT_RICH_TEXT_EDITOR_LABELS: RichTextEditorLabels = {
  toolbar: 'Text formatting',
  selectionToolbar: 'Selection formatting',

  textStyle: (currentStyle) => `Text style: ${currentStyle}`,
  paragraph: 'Normal',
  heading: (level) => `Heading ${level}`,

  linkEditor: 'Edit link',
  linkEditorEdit: 'Edit link',
  linkEditorAdd: 'Add link',
  linkEditorClose: 'Close',
  linkTextLabel: 'Text',
  linkTextPlaceholder: 'Link text',
  linkUrlLabel: 'URL',
  linkUrlPlaceholder: 'https://…',
  linkNewTab: 'Open in new tab',
  linkRemove: 'Remove',
  linkAdd: 'Add',
  linkUpdate: 'Update',

  insertToken: 'Insert token',
  noResults: 'No results',

  tableSize: (rows, columns) => `${rows} by ${columns}`,
  tableSizePreview: (rows, columns) => `${rows} × ${columns}`,
  tableInsert: 'Insert table',
  tableInsertHeaderRow: 'Insert header row',
  tableInsertRowAbove: 'Insert row above',
  tableInsertRowBelow: 'Insert row below',
  tableInsertColumnLeft: 'Insert column left',
  tableInsertColumnRight: 'Insert column right',
  tableDeleteRow: 'Delete row',
  tableDeleteColumn: 'Delete column',
  tableDeleteTable: 'Delete table',

  undo: 'Undo',
  redo: 'Redo',
  bold: 'Bold',
  italic: 'Italic',
  strike: 'Strikethrough',
  underline: 'Underline',
  code: 'Inline code',
  bulletedList: 'Bulleted list',
  numberedList: 'Numbered list',
  blockquote: 'Block quote',
  codeBlock: 'Code block',
  link: 'Link',
  align: 'Alignment',
  alignTrigger: 'Text alignment',
  alignLeft: 'Align left',
  alignCenter: 'Align center',
  alignRight: 'Align right',
  alignJustify: 'Justify',
  table: 'Table',
  language: 'Language',
  languageTrigger: (currentLanguage) => `Language: ${currentLanguage}`,
};

/**
 * Localize the rich text editor's strings for everything below this injector, and read the set in
 * effect here as a signal. Partial — whatever you leave out keeps its
 * {@link DEFAULT_RICH_TEXT_EDITOR_LABELS} value. See {@link createLabels} for the shape, which every
 * domain in this library shares.
 *
 * @example
 * provideRichTextEditorLabels({
 *   toolbar: 'Textformatierung',
 *   bold: 'Fett',
 *   heading: (level) => `Überschrift ${level}`,
 * });
 */
export const [provideRichTextEditorLabels, injectRichTextEditorLabels, RICH_TEXT_EDITOR_LABELS] =
  createLabels<RichTextEditorLabels>('RICH_TEXT_EDITOR_LABELS', DEFAULT_RICH_TEXT_EDITOR_LABELS);

/**
 * A toolbar button's accessible name: the label set's entry for its tool token, or the `label` on the
 * definition itself for a tool this library doesn't ship (an app's own tool, already in its language).
 *
 * The cast is the price of an extensible token: tool tokens are open strings, so no index signature can
 * describe "the built-in ones happen to be keys of {@link RichTextEditorLabels}".
 */
export const richTextEditorToolLabel = (labels: RichTextEditorLabels, tool: { token: string; label: string }) => {
  const label = (labels as Record<string, unknown>)[tool.token];

  return typeof label === 'string' ? label : tool.label;
};
