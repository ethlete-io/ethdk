import { signal } from '@angular/core';
import { injectRenderer } from '@ethlete/core';

/** The Ethlete renderer wrapper returned by `injectRenderer()`. */
export type EditorRenderer = NonNullable<ReturnType<typeof injectRenderer>>;

export type InlineTag = 'strong' | 'em' | 'del' | 'u' | 'code';
export type ListTag = 'ul' | 'ol';
export type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

export const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';
/** Block-level containers that can be re-tagged as a heading in place. An inline element sitting
 *  directly under the root (e.g. bare `<strong>` before any paragraph exists) is NOT one — it must
 *  be wrapped by the heading, not turned into it (which would drop the inline mark). */
export const BLOCK_SELECTOR = 'p, div, blockquote, pre, li, figure, section, article';

export type EditableSelection = {
  selection: Selection;
  range: Range;
};

export type RichTextMarkStates = {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  underline: boolean;
  /** Inline code only — the caret being inside a fenced code block reports {@link codeBlock}. */
  code: boolean;
  unorderedList: boolean;
  orderedList: boolean;
  link: boolean;
  /** Whether the selection starts inside a block quote (at any nesting level). */
  blockquote: boolean;
  /** Whether the selection starts inside a fenced code block, where the value is literal text —
   *  no inline marks, no block structure, and no autoformat. */
  codeBlock: boolean;
  /** Heading level of the block the selection starts in, or `null` when it is not a heading. */
  heading: number | null;
  /** Whether the selection starts inside a table cell — where block tools (headings, lists) have
   *  no GFM representation and are disabled. */
  tableCell: boolean;
};

/**
 * The always-shipped foundation the rich text editor DOM modules build on: the root element
 * signal, selection read/restore, caret placement, and generic node traversal/mutation helpers.
 * Domain modules (inline marks, lists, headings, links, autoformat, keymap, paste) receive this
 * core and stay independent of each other unless composed explicitly in `rich-text-editor-dom.ts`.
 */
export const createRichTextEditorDomCore = (doc: Document, renderer: EditorRenderer) => {
  /** The contenteditable element, set by the owning directive once its view exists. */
  const root = signal<HTMLElement | null>(null);

  /** The last selection that was inside the editor. Kept so a tap on the docked mobile toolbar — which
   *  can move focus out of the contenteditable on touch — can restore what was selected before acting. */
  let lastRange: Range | null = null;

  const getSelection = (): EditableSelection | null => {
    const el = root();

    if (!el) {
      return null;
    }

    const selection = doc.getSelection();

    if (!selection || selection.rangeCount === 0) {
      return null;
    }

    const range = selection.getRangeAt(0);

    if (!el.contains(range.commonAncestorContainer)) {
      return null;
    }

    lastRange = range.cloneRange();

    return { selection, range };
  };

  /** Re-applies {@link lastRange} when the live selection has left the editor (e.g. a toolbar tap
   *  moved focus). No-op when the selection is already inside the editor. */
  const restoreSelection = () => {
    if (getSelection()) return;

    const el = root();

    if (!el || !lastRange) return;

    el.focus();
    doc.getSelection()?.removeAllRanges();
    doc.getSelection()?.addRange(lastRange);
  };

  const closestWithin = (node: Node | null, selector: string): HTMLElement | null => {
    const el = root();

    if (!el) {
      return null;
    }

    let current: HTMLElement | null = node instanceof HTMLElement ? node : (node?.parentElement ?? null);

    while (current && el.contains(current)) {
      if (current.matches(selector)) {
        return current;
      }

      current = current.parentElement;
    }

    return null;
  };

  const selectNodeContents = (node: Node) => {
    const selection = doc.getSelection();

    if (!selection) {
      return;
    }

    const range = doc.createRange();
    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  /** Collapses the caret to just after `node`, so typing continues after it (not inside/over it). */
  const collapseAfter = (node: Node) => {
    const selection = doc.getSelection();

    if (!selection) {
      return;
    }

    const range = doc.createRange();
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  /** Places the caret after an inserted inline `node`. When the inline ends its line (nothing after),
   *  a single space is added first so the caret isn't glued to it and typing continues as plain text
   *  — but a mid-text inline (followed by more content) is left untouched so it isn't split from the
   *  following words/punctuation. Reusable for links, tokens and other atomic inline inserts.
   *  The space must be a no-break space: a plain trailing space at the end of a line is
   *  CSS-collapsed, and Chrome drops it from the text node on the next keystroke — the word would
   *  end up glued to the inline after all. Serialization normalizes `&nbsp;` back to a plain space. */
  const collapseAfterInline = (node: Node) => {
    const parent = node.parentNode;
    const next = node.nextSibling;
    const endsLine = !next || (next instanceof Text && next.data.length === 0);

    if (parent && endsLine) {
      const space = renderer.createText('\u00a0');
      renderer.insertBefore(parent, space, next);
      collapseAfter(space);

      return;
    }

    collapseAfter(node);
  };

  const selectAcross = (first: Node, last: Node) => {
    const selection = doc.getSelection();

    if (!selection) {
      return;
    }

    const range = doc.createRange();
    range.setStartBefore(first);
    range.setEndAfter(last);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const collapseInto = (node: Node, offset: number) => {
    const selection = doc.getSelection();

    if (!selection) {
      return;
    }

    const range = doc.createRange();
    range.setStart(node, offset);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const unwrapElement = (el: HTMLElement) => {
    const parent = el.parentNode;

    if (!parent) {
      return;
    }

    while (el.firstChild) {
      renderer.insertBefore(parent, el.firstChild, el);
    }

    renderer.removeChild(parent, el);
  };

  const replaceWith = (oldEl: HTMLElement, newNodes: Node[]) => {
    const parent = oldEl.parentNode;

    if (!parent) {
      return;
    }

    newNodes.forEach((node) => renderer.insertBefore(parent, node, oldEl));
    renderer.removeChild(parent, oldEl);
  };

  const collectDescendants = (node: Node, selector: string): HTMLElement[] => {
    const out: HTMLElement[] = [];

    node.childNodes.forEach((child) => {
      if (child instanceof HTMLElement) {
        if (child.matches(selector)) {
          out.push(child);
        }

        out.push(...collectDescendants(child, selector));
      }
    });

    return out;
  };

  const childrenByTag = (parent: HTMLElement, tag: string): HTMLElement[] => {
    const out: HTMLElement[] = [];

    Array.from(parent.children).forEach((child) => {
      if (child instanceof HTMLElement && child.tagName.toLowerCase() === tag) {
        out.push(child);
      }
    });

    return out;
  };

  const blocksInRange = (range: Range): ChildNode[] => {
    const el = root();
    const blocks: ChildNode[] = [];

    el?.childNodes.forEach((child) => {
      if (range.intersectsNode(child)) {
        blocks.push(child);
      }
    });

    return blocks;
  };

  const isBlockEmpty = (el: HTMLElement) => (el.textContent ?? '').trim().length === 0;

  // A mark applied to whitespace at the very edge of the selection is invisible and has no
  // markdown representation, so shrink the range inward past any leading/trailing whitespace
  // before (un)marking it — matching how most rich text editors ignore edge whitespace on toggle.
  const trimRangeWhitespace = (range: Range) => {
    if (range.collapsed) {
      return;
    }

    const { startContainer, endContainer } = range;

    if (startContainer.nodeType === Node.TEXT_NODE) {
      const data = startContainer.textContent ?? '';
      const limit = startContainer === endContainer ? range.endOffset : data.length;
      let offset = range.startOffset;

      while (offset < limit && /\s/.test(data[offset] ?? '')) {
        offset++;
      }

      range.setStart(startContainer, offset);
    }

    if (range.collapsed) {
      return;
    }

    if (endContainer.nodeType === Node.TEXT_NODE) {
      const data = endContainer.textContent ?? '';
      const limit = endContainer === startContainer ? range.startOffset : 0;
      let offset = range.endOffset;

      while (offset > limit && /\s/.test(data[offset - 1] ?? '')) {
        offset--;
      }

      range.setEnd(endContainer, offset);
    }
  };

  // The selection may be anchored on an element boundary rather than in a text node — e.g. the
  // restored selection after a cross-block wrap starts at (wrapper, 0). Marks *below* such an
  // anchor (a <strong> inside the <em> wrapper) are invisible to an ancestor walk, so descend to
  // the deepest node at the selection's start position first.
  // Descend from a range boundary (container + offset) to the leaf node it actually points at, so
  // callers see the innermost text/element rather than a block container. Essential for mark
  // detection when the range wraps a whole block (e.g. selectNodeContents(<h2>) whose child is a
  // <strong>) — the raw container is the block, but the marked content is a descendant.
  const resolveBoundaryNode = (container: Node, offset: number): Node => {
    let node: Node = container;
    let o = offset;

    while (node.nodeType === Node.ELEMENT_NODE && node.childNodes.length > 0) {
      node = node.childNodes[Math.min(o, node.childNodes.length - 1)] as Node;
      o = 0;
    }

    return node;
  };

  const resolveStartNode = (range: Range): Node => resolveBoundaryNode(range.startContainer, range.startOffset);

  const markStates = (): RichTextMarkStates | null => {
    const editable = getSelection();

    if (!editable) {
      return null;
    }

    const node = resolveStartNode(editable.range);
    const headingEl = closestWithin(node, HEADING_SELECTOR);
    const codeBlock = !!closestWithin(node, 'pre');

    return {
      bold: !!closestWithin(node, 'strong'),
      italic: !!closestWithin(node, 'em'),
      strike: !!closestWithin(node, 'del'),
      underline: !!closestWithin(node, 'u'),
      code: !codeBlock && !!closestWithin(node, 'code'),
      unorderedList: !!closestWithin(node, 'ul'),
      orderedList: !!closestWithin(node, 'ol'),
      link: !!closestWithin(node, 'a'),
      blockquote: !!closestWithin(node, 'blockquote'),
      codeBlock,
      heading: headingEl ? Number(headingEl.tagName[1]) : null,
      tableCell: !!closestWithin(node, 'td, th'),
    };
  };

  /** Ensures there is a caret to act on for a programmatic insert, preferring (in order) the live
   *  in-editor selection, the last known in-editor range (e.g. before a palette button stole focus),
   *  then the end of the content. Does not move focus. Returns `false` only when the editor has no
   *  root or no usable selection object. */
  const ensureCaret = () => {
    const el = root();

    if (!el) {
      return false;
    }

    // Live selection already inside the editor — insert exactly where the caret sits.
    if (getSelection()) {
      return true;
    }

    const selection = doc.getSelection();

    if (!selection) {
      return false;
    }

    const range = doc.createRange();

    if (lastRange && el.contains(lastRange.commonAncestorContainer)) {
      // Restore the caret the editor last held (focus moved to a palette/toolbar control).
      range.setStart(lastRange.startContainer, lastRange.startOffset);
      range.collapse(true);
    } else {
      // Never focused: append at the end of the content.
      range.selectNodeContents(el);
      range.collapse(false);
    }

    selection.removeAllRanges();
    selection.addRange(range);

    return true;
  };

  const insertToken = (node: Node) => {
    const editable = getSelection();

    if (!editable) {
      return;
    }

    const { selection, range } = editable;

    range.deleteContents();
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  return {
    doc,
    renderer,
    root,
    getSelection,
    restoreSelection,
    closestWithin,
    selectNodeContents,
    collapseAfter,
    collapseAfterInline,
    selectAcross,
    collapseInto,
    unwrapElement,
    replaceWith,
    collectDescendants,
    childrenByTag,
    blocksInRange,
    isBlockEmpty,
    trimRangeWhitespace,
    resolveBoundaryNode,
    resolveStartNode,
    markStates,
    ensureCaret,
    insertToken,
  };
};

export type RichTextEditorDomCore = ReturnType<typeof createRichTextEditorDomCore>;
