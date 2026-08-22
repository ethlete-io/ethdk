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

/** A caret at an element boundary (empty paragraph, empty editor) has no client rect at all - an
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
 * sit outside the text - a triple-click selects the whole `<li>`/`<p>` element - reports the
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
 * Composes the DOM modules into the single per-editor service the directive injects. The domains
 * every editor has (selection, inline marks, lists, paste, history and the key handling over them)
 * are built here; the ones an editor only has when it asked for them - headings, links, quotes,
 * fenced code, markdown autoformat - arrive through {@link RICH_TEXT_EDITOR_DOM_FEATURE} and are
 * reachable under {@link RichTextEditorDomFeatures}, `null` when their provider is absent. That
 * indirection is the point: nothing here references those implementations, so they only reach a
 * bundle that provides them.
 */
const richTextEditorDomFactory = () => {
  const renderer = injectRenderer();
  const doc = inject(DOCUMENT);
  const registered = inject(RICH_TEXT_EDITOR_DOM_FEATURE, { optional: true });

  const core = createRichTextEditorDomCore(doc, renderer);
  const marks = createRichTextEditorInlineMarks(core);
  const lists = createRichTextEditorLists(core);

  // Filled below, and handed to the factories as it is: a feature built on other features reads it
  // when it runs, so the consumer's provider order never matters.
  const features: RichTextEditorDomFeatures = {};
  const ctx = { core, lists, features };

  for (const feature of registered ?? []) {
    // The mapped-type union guarantees create() returns what its own key holds; TS cannot follow
    // that through the erased key here.
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

    /** The block-style domain, from `provideRichTextEditorHeadingTool()`. */
    headings: features.headings ?? null,

    /** The link domain, from `provideRichTextEditorLinkTool()`. */
    links: features.links ?? null,

    /** The quote domain, from `provideRichTextEditorBlockquoteTool()`. */
    blockquote: features.blockquote ?? null,

    /** The fenced-code domain, from `provideRichTextEditorCodeBlockTool()`. */
    codeBlock: features.codeBlock ?? null,

    /** Markdown-as-you-type, from `provideRichTextEditorAutoformat()`. */
    autoformat: features.autoformat ?? null,
  };
};

export type RichTextEditorDom = ReturnType<typeof richTextEditorDomFactory>;

const RICH_TEXT_EDITOR_DOM_DEF = /* @__PURE__ */ defineProvider(richTextEditorDomFactory, {
  name: 'RichTextEditorDom',
});

export const provideRichTextEditorDom = /* @__PURE__ */ toProvideFn(RICH_TEXT_EDITOR_DOM_DEF);
export const injectRichTextEditorDom = /* @__PURE__ */ toInjectFn(RICH_TEXT_EDITOR_DOM_DEF);
