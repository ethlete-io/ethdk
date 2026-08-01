import { RichTextEditorDomCore } from './rich-text-editor-dom-core';

/** Blocks a quote can't take in: their Markdown form doesn't survive inside `> ` lines. */
const NOT_QUOTABLE = /* @__PURE__ */ new Set(['TABLE', 'UL', 'OL', 'PRE']);

/**
 * Block quotes. A quote's lines are `<br>`-separated inline content inside one `<blockquote>` -
 * the shape `markdownToHtml` produces for `> ` lines, so a quote survives being re-rendered from
 * the value (undo, an external write) unchanged. Nesting is a `<blockquote>` inside a
 * `<blockquote>` (`>>`), adjusted with Tab / Shift+Tab.
 */
export const createRichTextEditorBlockquote = (core: RichTextEditorDomCore) => {
  const {
    renderer,
    root,
    getSelection,
    closestWithin,
    selectNodeContents,
    collapseInto,
    collapseAfter,
    replaceWith,
    collectDescendants,
    blocksInRange,
  } = core;

  const quoteAtCaret = () => {
    const editable = getSelection();

    return editable ? closestWithin(editable.range.startContainer, 'blockquote') : null;
  };

  /** Lifts one nesting level out: the quote's content takes its place, as paragraphs split on the
   *  `<br>` line breaks (a nested quote inside it stays a quote). */
  const unwrapQuote = (quote: HTMLElement) => {
    const parent = quote.parentNode;

    if (!parent) return;

    const produced: HTMLElement[] = [];
    let current = renderer.createElement('p');

    const flush = () => {
      if (!current.firstChild) renderer.appendChild(current, renderer.createElement('br'));

      produced.push(current);
      current = renderer.createElement('p');
    };

    while (quote.firstChild) {
      const child = quote.firstChild;

      if (child instanceof HTMLElement && child.tagName === 'BR') {
        renderer.removeChild(quote, child);
        flush();

        continue;
      }

      // A nested quote (or any block) can't live inside the paragraph - emit it on its own.
      if (child instanceof HTMLElement && (child.tagName === 'BLOCKQUOTE' || child.tagName === 'P')) {
        if (current.firstChild) flush();

        renderer.removeChild(quote, child);
        produced.push(child);

        continue;
      }

      renderer.removeChild(quote, child);
      renderer.appendChild(current, child);
    }

    if (current.firstChild) flush();
    if (produced.length === 0) flush();

    replaceWith(quote, produced);

    const first = produced[0];

    if (first) collapseInto(first, 0);
  };

  /**
   * Quotes the selected blocks, or lifts the caret's quote out one level when it already is one.
   * A selection holding something a quote can't serialize (list, table, code block) is left alone.
   */
  const toggleBlockquote = () => {
    const editable = getSelection();
    const el = root();

    if (!el || !editable) return;

    const existing = quoteAtCaret();

    if (existing) {
      unwrapQuote(existing);
      el.normalize();

      return;
    }

    const blocks = blocksInRange(editable.range);

    if (blocks.some((block) => block instanceof HTMLElement && NOT_QUOTABLE.has(block.tagName))) return;

    const quote = renderer.createElement('blockquote');

    // An empty editor has no block to quote - start an empty one, the <br> giving it a line box
    // for the caret (same treatment as toggleList / toggleHeading).
    if (blocks.length === 0) {
      renderer.appendChild(quote, renderer.createElement('br'));
      renderer.appendChild(el, quote);
      collapseInto(quote, 0);

      return;
    }

    blocks.forEach((block, index) => {
      // every block becomes one quoted line
      if (index > 0) renderer.appendChild(quote, renderer.createElement('br'));

      if (block.nodeType === Node.TEXT_NODE) {
        renderer.appendChild(quote, block.cloneNode(true));

        return;
      }

      while (block.firstChild) renderer.appendChild(quote, block.firstChild);
    });

    // the quoted blocks may all have been empty - the <br> keeps a line box for the caret
    if (!quote.firstChild) renderer.appendChild(quote, renderer.createElement('br'));

    renderer.insertBefore(el, quote, blocks[0] ?? null);
    blocks.forEach((block) => {
      if (block.parentNode === el) renderer.removeChild(el, block);
    });

    selectNodeContents(quote);
    el.normalize();
  };

  /** Tab inside a quote: nest it one level deeper (`>` → `>>`). Returns `true` when handled. */
  const indentBlockquote = () => {
    const editable = getSelection();
    const quote = quoteAtCaret();

    if (!editable || !quote) return false;

    const { startContainer, startOffset } = editable.range;
    const wrapper = renderer.createElement('blockquote');

    replaceWith(quote, [wrapper]);
    renderer.appendChild(wrapper, quote);
    collapseInto(startContainer, startOffset);

    return true;
  };

  /** Shift+Tab inside a quote: lift it one level (`>>` → `>`), or out of the quote at the top
   *  level. Returns `true` when handled. */
  const outdentBlockquote = () => {
    const editable = getSelection();
    const quote = quoteAtCaret();

    if (!editable || !quote) return false;

    const outer = quote.parentElement;

    if (outer instanceof HTMLElement && outer.tagName === 'BLOCKQUOTE') {
      const { startContainer, startOffset } = editable.range;
      const ref = quote.nextSibling;

      // the lifted lines become the outer quote's own - kept apart from what sits above them
      if (
        quote.previousSibling &&
        !(quote.previousSibling instanceof HTMLElement && quote.previousSibling.tagName === 'BR')
      ) {
        renderer.insertBefore(outer, renderer.createElement('br'), quote);
      }

      while (quote.firstChild) renderer.insertBefore(outer, quote.firstChild, ref);

      renderer.removeChild(outer, quote);
      collapseInto(startContainer, startOffset);

      return true;
    }

    unwrapQuote(quote);

    return true;
  };

  /** Whether the caret sits at the start of a quoted line - nothing but a line break (or the start
   *  of the quote) before it. */
  const atLineStart = (quote: HTMLElement, range: Range) => {
    const { startContainer, startOffset } = range;
    const isBreak = (node: Node | null) => !node || (node instanceof HTMLElement && node.tagName === 'BR');

    if (startContainer === quote) return isBreak(quote.childNodes[startOffset - 1] ?? null);
    if (startContainer.nodeType !== Node.TEXT_NODE) return false;

    return startOffset === 0 && isBreak(startContainer.previousSibling);
  };

  /**
   * Enter inside a quote: a line break within the same `<blockquote>` - left to the browser it
   * would split the quote into two instead, which is neither the shape the value round-trips to nor
   * what the user asked for. On the quote's already-empty last line it leaves the quote, the way
   * out that lists and headings have. Returns `true` when handled.
   */
  const blockquoteEnter = () => {
    const editable = getSelection();
    const el = root();
    const quote = quoteAtCaret();

    if (!editable || !el || !quote || !editable.range.collapsed) return false;

    const { range } = editable;
    const toEnd = range.cloneRange();
    toEnd.setEnd(quote, quote.childNodes.length);
    const atQuoteEnd = toEnd.toString().trim().length === 0;

    if (atQuoteEnd && atLineStart(quote, range)) {
      // the outermost wrapper is what the new paragraph goes after
      let outermost = quote;

      while (outermost.parentElement && outermost.parentElement !== el) outermost = outermost.parentElement;

      // Drop the empty last line. Alongside its break that means the empty text nodes
      // `Range.insertNode` leaves behind when it splits a text node - they are invisible in the
      // markup but would keep the loop from reaching the break.
      const isTrailingBlank = (node: ChildNode | null) =>
        !!node &&
        ((node instanceof HTMLElement && node.tagName === 'BR') ||
          (node.nodeType === Node.TEXT_NODE && (node.textContent ?? '') === ''));

      while (isTrailingBlank(quote.lastChild)) renderer.removeChild(quote, quote.lastChild as ChildNode);

      const paragraph = renderer.createElement('p');
      renderer.appendChild(paragraph, renderer.createElement('br'));
      renderer.insertBefore(el, paragraph, outermost.nextSibling);

      // a quote emptied by the line that left it goes away with it
      if (!quote.firstChild && quote.parentNode) renderer.removeChild(quote.parentNode, quote);
      if (!outermost.firstChild && outermost.parentNode) renderer.removeChild(el, outermost);

      collapseInto(paragraph, 0);

      return true;
    }

    range.deleteContents();

    const lineBreak = renderer.createElement('br');
    range.insertNode(lineBreak);

    // A break at the very end of the quote needs a second one after it, or the new (empty) line
    // gets no line box and the caret snaps back to the end of the previous one.
    if (atQuoteEnd && lineBreak.parentNode) {
      renderer.insertBefore(lineBreak.parentNode, renderer.createElement('br'), lineBreak.nextSibling);
    }

    collapseAfter(lineBreak);

    return true;
  };

  /**
   * Removes a quote the browser emptied: selecting a quote's whole content and deleting it leaves
   * the `<blockquote>` behind, which would go on serializing an empty `>` line (and swallow what is
   * typed next). An empty quote the editor itself made always holds the `<br>` that gives it a line
   * box, so a childless one is only ever that leftover. Returns `true` when it removed one.
   */
  const repairEmptyQuotes = () => {
    const el = root();

    if (!el) return false;

    let repaired = false;

    for (const quote of collectDescendants(el, 'blockquote')) {
      const blank = Array.from(quote.childNodes).every(
        (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '') === '',
      );

      if (!blank || !quote.parentNode) continue;

      renderer.removeChild(quote.parentNode, quote);
      repaired = true;
    }

    return repaired;
  };

  return { toggleBlockquote, indentBlockquote, outdentBlockquote, blockquoteEnter, repairEmptyQuotes };
};

export type RichTextEditorDomBlockquote = ReturnType<typeof createRichTextEditorBlockquote>;
