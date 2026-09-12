import { RichTextEditorDomCore } from './rich-text-editor-dom-core';

const NOT_QUOTABLE = /* @__PURE__ */ new Set(['TABLE', 'UL', 'OL', 'PRE']);

/**
 * A quote's lines must stay `<br>`-separated inline content inside one `<blockquote>` - the shape
 * `markdownToHtml` produces for `> ` lines, and so the only one that survives a re-render from the
 * value (undo, an external write) unchanged.
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

    if (blocks.length === 0) {
      renderer.appendChild(quote, renderer.createElement('br'));
      renderer.appendChild(el, quote);
      collapseInto(quote, 0);

      return;
    }

    blocks.forEach((block, index) => {
      if (index > 0) renderer.appendChild(quote, renderer.createElement('br'));

      if (block.nodeType === Node.TEXT_NODE) {
        renderer.appendChild(quote, block.cloneNode(true));

        return;
      }

      while (block.firstChild) renderer.appendChild(quote, block.firstChild);
    });

    if (!quote.firstChild) renderer.appendChild(quote, renderer.createElement('br'));

    renderer.insertBefore(el, quote, blocks[0] ?? null);
    blocks.forEach((block) => {
      if (block.parentNode === el) renderer.removeChild(el, block);
    });

    selectNodeContents(quote);
    el.normalize();
  };

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

  const outdentBlockquote = () => {
    const editable = getSelection();
    const quote = quoteAtCaret();

    if (!editable || !quote) return false;

    const outer = quote.parentElement;

    if (outer instanceof HTMLElement && outer.tagName === 'BLOCKQUOTE') {
      const { startContainer, startOffset } = editable.range;
      const ref = quote.nextSibling;

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

  const atLineStart = (quote: HTMLElement, range: Range) => {
    const { startContainer, startOffset } = range;
    const isBreak = (node: Node | null) => !node || (node instanceof HTMLElement && node.tagName === 'BR');

    if (startContainer === quote) return isBreak(quote.childNodes[startOffset - 1] ?? null);
    if (startContainer.nodeType !== Node.TEXT_NODE) return false;

    return startOffset === 0 && isBreak(startContainer.previousSibling);
  };

  /**
   * Left to the browser, Enter splits the quote into two `<blockquote>`s instead of breaking the
   * line inside one - a shape the value does not round-trip to.
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
      let outermost = quote;

      while (outermost.parentElement && outermost.parentElement !== el) outermost = outermost.parentElement;

      // `Range.insertNode` leaves empty text nodes behind when it splits a text node: they are
      // invisible in the markup, but the loop below would stop at one before reaching the break.
      const isTrailingBlank = (node: ChildNode | null) =>
        !!node &&
        ((node instanceof HTMLElement && node.tagName === 'BR') ||
          (node.nodeType === Node.TEXT_NODE && (node.textContent ?? '') === ''));

      while (isTrailingBlank(quote.lastChild)) renderer.removeChild(quote, quote.lastChild as ChildNode);

      const paragraph = renderer.createElement('p');
      renderer.appendChild(paragraph, renderer.createElement('br'));
      renderer.insertBefore(el, paragraph, outermost.nextSibling);

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
   * Deleting a quote's whole content leaves the browser's empty `<blockquote>` behind. An empty
   * quote the editor itself made always holds a `<br>`, so a childless one is only ever that
   * leftover.
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
