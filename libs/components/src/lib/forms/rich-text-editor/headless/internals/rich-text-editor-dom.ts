import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';
import { defineProvider, injectRenderer, toInjectFn, toProvideFn } from '@ethlete/core';
import { createRichTextEditorDomCore } from './rich-text-editor-dom-core';
import { RICH_TEXT_EDITOR_DOM_FEATURE, RichTextEditorDomFeatures } from './rich-text-editor-dom-features';
import { createRichTextEditorDomHistory } from './rich-text-editor-dom-history';
import { createRichTextEditorInlineMarks } from './rich-text-editor-dom-inline-marks';
import { createRichTextEditorKeymap } from './rich-text-editor-dom-keymap';
import { createRichTextEditorLists } from './rich-text-editor-dom-lists';
import { createRichTextEditorPaste } from './rich-text-editor-dom-paste';

export { INLINE_TAGS } from './rich-text-editor-dom-core';
export type {
  EditableSelection,
  HeadingTag,
  InlineTag,
  ListTag,
  RichTextMarkStates,
} from './rich-text-editor-dom-core';

/** A caret at an element boundary has no client rect at all, and an all-zero rect reads as
 *  "reference hidden" to the overlay, which then closes instantly. */
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
 * A range whose boundaries sit outside the text - a triple-click selects the whole `<li>`/`<p>` -
 * reports the block's full-width border box, which would center a popover's arrow on the block
 * instead of on the text, so both boundaries are clamped into the text nodes inside the range.
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
 * The opt-in domains must keep arriving through {@link RICH_TEXT_EDITOR_DOM_FEATURE}: nothing here
 * may reference their implementations, or they reach a bundle that never provides them.
 */
const richTextEditorDomFactory = () => {
  const renderer = injectRenderer();
  const doc = inject(DOCUMENT);
  const registered = inject(RICH_TEXT_EDITOR_DOM_FEATURE, { optional: true });

  const core = createRichTextEditorDomCore(doc, renderer);
  const marks = createRichTextEditorInlineMarks(core);
  const lists = createRichTextEditorLists(core);

  const features: RichTextEditorDomFeatures = {};
  const ctx = { core, lists, features };

  for (const feature of registered ?? []) {
    (features[feature.key] as unknown) = feature.create(ctx);
  }

  const keymap = createRichTextEditorKeymap(core, { lists, features });
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
    insertNormalizedHtml: paste.insertNormalizedHtml,
    handleBackspace: keymap.handleBackspace,
    handleEnter: keymap.handleEnter,
    codeExit: keymap.codeExit,
    readSelectionOffsets: history.readSelectionOffsets,
    restoreSelectionOffsets: history.restoreSelectionOffsets,

    headings: features.headings ?? null,
    links: features.links ?? null,
    blockquote: features.blockquote ?? null,
    codeBlock: features.codeBlock ?? null,
    autoformat: features.autoformat ?? null,
  };
};

export type RichTextEditorDom = ReturnType<typeof richTextEditorDomFactory>;

const RICH_TEXT_EDITOR_DOM_DEF = /* @__PURE__ */ defineProvider(richTextEditorDomFactory, {
  name: 'RichTextEditorDom',
});

export const provideRichTextEditorDom = /* @__PURE__ */ toProvideFn(RICH_TEXT_EDITOR_DOM_DEF);
export const injectRichTextEditorDom = /* @__PURE__ */ toInjectFn(RICH_TEXT_EDITOR_DOM_DEF);
