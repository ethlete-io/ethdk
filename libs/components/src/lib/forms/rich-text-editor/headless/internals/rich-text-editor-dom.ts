import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';
import { createProvider, injectRenderer } from '@ethlete/core';
import { createRichTextEditorAutoformat } from './rich-text-editor-dom-autoformat';
import { createRichTextEditorBlockquote } from './rich-text-editor-dom-blockquote';
import { createRichTextEditorCodeBlock } from './rich-text-editor-dom-code-block';
import { createRichTextEditorDomCore } from './rich-text-editor-dom-core';
import { createRichTextEditorHeadings } from './rich-text-editor-dom-headings';
import { createRichTextEditorDomHistory } from './rich-text-editor-dom-history';
import { createRichTextEditorInlineMarks } from './rich-text-editor-dom-inline-marks';
import { createRichTextEditorKeymap } from './rich-text-editor-dom-keymap';
import { createRichTextEditorLinks } from './rich-text-editor-dom-links';
import { createRichTextEditorLists } from './rich-text-editor-dom-lists';
import { createRichTextEditorPaste } from './rich-text-editor-dom-paste';

export type {
  EditableSelection,
  HeadingTag,
  InlineTag,
  ListTag,
  RichTextMarkStates,
} from './rich-text-editor-dom-core';

/** A caret at an element boundary (empty paragraph, empty editor) has no client rect at all — an
 *  all-zero rect reads as "reference hidden" to the overlay and instantly closes it. Approximate
 *  the visible caret instead: the element's content-box top-left, one line high. */
const caretRectFallback = (range: Range): DOMRect => {
  const container = range.startContainer;
  const el = container instanceof HTMLElement ? container : container.parentElement;
  const view = el?.ownerDocument.defaultView;

  if (!el || !view) return new DOMRect();

  const rect = el.getBoundingClientRect();
  const style = view.getComputedStyle(el);
  const fontSize = Number.parseFloat(style.fontSize) || 16;
  const lineHeight = Number.parseFloat(style.lineHeight) || fontSize * 1.2;

  return new DOMRect(
    rect.left + (Number.parseFloat(style.paddingLeft) || 0),
    rect.top + (Number.parseFloat(style.paddingTop) || 0),
    0,
    Math.min(lineHeight, rect.height || lineHeight),
  );
};

const hasNoRect = (rect: DOMRect) => rect.x === 0 && rect.y === 0 && rect.width === 0 && rect.height === 0;

/**
 * The rect selection popovers (link editor, floating toolbar) anchor to. A range whose boundaries
 * sit outside the text — a triple-click selects the whole `<li>`/`<p>` element — reports the
 * block's full-width border box from `getBoundingClientRect()`, which would center the popover's
 * arrow on the block instead of on the text. Clamping both boundaries into the first/last text
 * nodes inside the range keeps the rect on the rendered text. Collapsed ranges (carets) and
 * text-free ranges fall back to the plain bounding rect, and a rectless boundary caret to
 * {@link caretRectFallback}.
 */
export const rangeTextBoundingRect = (range: Range): DOMRect => {
  const doc = range.commonAncestorContainer.ownerDocument;

  if (range.collapsed || !doc) {
    const rect = range.getBoundingClientRect();

    return hasNoRect(rect) ? caretRectFallback(range) : rect;
  }

  const walker = doc.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT);
  let first: Text | null = null;
  let last: Text | null = null;

  while (walker.nextNode()) {
    const text = walker.currentNode as Text;

    if (!text.data.trim() || !range.intersectsNode(text)) continue;

    first ??= text;
    last = text;
  }

  if (!first || !last) {
    const rect = range.getBoundingClientRect();

    return hasNoRect(rect) ? caretRectFallback(range) : rect;
  }

  const clamped = range.cloneRange();

  if (first !== range.startContainer) clamped.setStart(first, 0);
  if (last !== range.endContainer) clamped.setEnd(last, last.length);

  return clamped.getBoundingClientRect();
};

/**
 * Composes the per-domain DOM modules into the single per-editor service the directive injects.
 * The split keeps each domain readable and testable on its own; the facade keeps consumption
 * trivial (one injected object, same API as before the split). Genuinely optional domains do NOT
 * live here — table caret navigation, for example, ships with `provideRichTextEditorTableTool`.
 */
const richTextEditorDomFactory = () => {
  const renderer = injectRenderer();
  const doc = inject(DOCUMENT);

  const core = createRichTextEditorDomCore(doc, renderer);
  const marks = createRichTextEditorInlineMarks(core);
  const lists = createRichTextEditorLists(core);
  const headings = createRichTextEditorHeadings(core);
  const links = createRichTextEditorLinks(core);
  const blockquote = createRichTextEditorBlockquote(core);
  const codeBlock = createRichTextEditorCodeBlock(core);
  const autoformat = createRichTextEditorAutoformat(core, { lists, headings, blockquote, codeBlock });
  const keymap = createRichTextEditorKeymap(core, { lists, headings, blockquote, codeBlock });
  const paste = createRichTextEditorPaste(core);
  const history = createRichTextEditorDomHistory(core);

  return {
    root: core.root,
    getSelection: core.getSelection,
    restoreSelection: core.restoreSelection,
    closestWithin: core.closestWithin,
    markStates: core.markStates,
    ensureCaret: core.ensureCaret,
    insertToken: core.insertToken,
    toggleInline: marks.toggleInline,
    activeInlineTags: marks.activeInlineTags,
    insertInlineText: marks.insertInlineText,
    toggleList: lists.toggleList,
    indentListItem: lists.indentListItem,
    outdentListItem: lists.outdentListItem,
    toggleHeading: headings.toggleHeading,
    toggleBlockquote: blockquote.toggleBlockquote,
    repairEmptyQuotes: blockquote.repairEmptyQuotes,
    indentBlockquote: blockquote.indentBlockquote,
    outdentBlockquote: blockquote.outdentBlockquote,
    toggleCodeBlock: codeBlock.toggleCodeBlock,
    codeBlockArrowDown: codeBlock.codeBlockArrowDown,
    exitCodeBlock: codeBlock.exitCodeBlock,
    repairCodeBlock: codeBlock.repairCodeBlock,
    applyLink: links.applyLink,
    readActiveLink: links.readActiveLink,
    removeLink: links.removeLink,
    insertNormalizedHtml: paste.insertNormalizedHtml,
    applyBlockAutoformat: autoformat.applyBlockAutoformat,
    applyInlineAutoformat: autoformat.applyInlineAutoformat,
    handleBackspace: keymap.handleBackspace,
    handleEnter: keymap.handleEnter,
    codeExit: keymap.codeExit,
    readSelectionOffsets: history.readSelectionOffsets,
    restoreSelectionOffsets: history.restoreSelectionOffsets,
  };
};

export type RichTextEditorDom = ReturnType<typeof richTextEditorDomFactory>;

export const [provideRichTextEditorDom, injectRichTextEditorDom] = createProvider(richTextEditorDomFactory, {
  name: 'RichTextEditorDom',
});
