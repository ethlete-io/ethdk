import { signal } from '@angular/core';
import { injectRenderer } from '@ethlete/core';

export type EditorRenderer = NonNullable<ReturnType<typeof injectRenderer>>;

export const INLINE_TAGS = ['strong', 'em', 'del', 'u', 'code'] as const;
export type InlineTag = (typeof INLINE_TAGS)[number];
export type ListTag = 'ul' | 'ol';
export type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

export const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';
/** Must list only block-level containers: an inline element re-tagged in place loses its mark, so a
 *  bare `<strong>` under the root has to be wrapped by the heading rather than turned into one. */
export const BLOCK_SELECTOR = 'p, div, blockquote, pre, li, figure, section, article';

const ROOT_BLOCK_SELECTOR = `${BLOCK_SELECTOR}, ${HEADING_SELECTOR}, ul, ol, table, hr, br`;
const INLINE_SLICE_BLOCK_SELECTOR = `li, p, td, th, div, blockquote, ${HEADING_SELECTOR}`;

const isInlineRunNode = (node: Node) =>
  node.nodeType === Node.TEXT_NODE || (node instanceof HTMLElement && !node.matches(ROOT_BLOCK_SELECTOR));

type RangePoint = { container: Node; offset: number } | { before: Node | null };

/** Alignment persists as a class, not an inline `text-align`, so rendered content passes a strict `style-src`. */
export const ALIGN_CLASS_PREFIX = 'et-rte-align-';

export const alignClassOf = (el: Element) =>
  [...el.classList].find((cls) => cls.startsWith(ALIGN_CLASS_PREFIX)) ?? null;

export type EditableSelection = {
  selection: Selection;
  range: Range;
};

export type RichTextMarkStates = {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  underline: boolean;
  /** Inline code only - the caret being inside a fenced code block reports {@link codeBlock}. */
  code: boolean;
  unorderedList: boolean;
  orderedList: boolean;
  link: boolean;
  blockquote: boolean;
  codeBlock: boolean;
  heading: number | null;
  tableCell: boolean;
};

export const createRichTextEditorDomCore = (doc: Document, renderer: EditorRenderer) => {
  const root = signal<HTMLElement | null>(null);

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

  const caretRangeAtPoint = (x: number, y: number): Range | null => {
    if (doc.caretPositionFromPoint) {
      const position = doc.caretPositionFromPoint(x, y);

      if (!position) return null;

      const range = doc.createRange();
      range.setStart(position.offsetNode, position.offset);

      return range;
    }

    return doc.caretRangeFromPoint?.(x, y) ?? null;
  };

  const placeCaretAtPoint = (x: number, y: number) => {
    const el = root();
    const selection = doc.getSelection();
    const range = caretRangeAtPoint(x, y);

    if (!el || !selection || !range || !el.contains(range.startContainer)) return false;

    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    lastRange = range.cloneRange();

    return true;
  };

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

  /** The added space must be a no-break space: a plain trailing space at the end of a line is
   *  CSS-collapsed and Chrome drops it from the text node on the next keystroke, gluing the word to
   *  the inline after all. Serialization normalizes `&nbsp;` back to a plain space. */
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

  const pointBoundary = (el: HTMLElement, point: RangePoint): [Node, number] => {
    if (!('before' in point)) return [point.container, point.offset];
    if (!point.before?.parentNode) return [el, el.childNodes.length];

    const parent = point.before.parentNode;

    return [parent, Array.prototype.indexOf.call(parent.childNodes, point.before)];
  };

  // Chrome keeps the first typed line as loose nodes under the root; a block command must see that
  // line as one block, not one per text node or mark.
  const wrapLooseRuns = (el: HTMLElement, range: Range) => {
    const runs: ChildNode[][] = [[]];

    el.childNodes.forEach((child) => {
      if (isInlineRunNode(child)) runs[runs.length - 1]?.push(child);
      else runs.push([]);
    });

    const loose = runs.filter((run) => run.length > 1 && run.some((node) => range.intersectsNode(node)));

    if (loose.length === 0) return;

    const pointOf = (container: Node, offset: number): RangePoint =>
      container === el ? { before: el.childNodes[offset] ?? null } : { container, offset };
    const start = pointOf(range.startContainer, range.startOffset);
    const end = pointOf(range.endContainer, range.endOffset);

    for (const run of loose) {
      const paragraph = renderer.createElement('p');

      renderer.insertBefore(el, paragraph, run[0] ?? null);
      run.forEach((node) => renderer.appendChild(paragraph, node));
    }

    range.setStart(...pointBoundary(el, start));
    range.setEnd(...pointBoundary(el, end));
  };

  const blocksInRange = (range: Range): ChildNode[] => {
    const el = root();
    const blocks: ChildNode[] = [];

    if (el) wrapLooseRuns(el, range);

    el?.childNodes.forEach((child) => {
      if (range.intersectsNode(child)) {
        blocks.push(child);
      }
    });

    return blocks;
  };

  const isBlockEmpty = (el: HTMLElement) => (el.textContent ?? '').trim().length === 0;

  // A mark applied to whitespace at the edge of the selection is invisible and has no markdown
  // representation, so the range is shrunk inward past it before (un)marking.
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

  // An inline wrapper must stay inside its block: a range crossing <li>/<p> boundaries would clone
  // the partially covered blocks into the wrapper, which serializes to broken markdown.
  const blockSlices = (range: Range): Range[] => {
    const el = root();
    const startBlock = closestWithin(range.startContainer, INLINE_SLICE_BLOCK_SELECTOR);
    const endBlock = closestWithin(range.endContainer, INLINE_SLICE_BLOCK_SELECTOR);

    if (!el || startBlock === endBlock) {
      return [range];
    }

    const leaves: Node[] = [];

    el.childNodes.forEach((child) => {
      if (!range.intersectsNode(child)) {
        return;
      }

      if (child instanceof HTMLElement && (child.tagName === 'UL' || child.tagName === 'OL')) {
        child.childNodes.forEach((item) => {
          if (range.intersectsNode(item)) {
            leaves.push(item);
          }
        });
      } else if (child instanceof HTMLTableElement) {
        for (const section of child.children) {
          if (!(section instanceof HTMLTableSectionElement)) continue;

          for (const tr of section.children) {
            if (!(tr instanceof HTMLTableRowElement)) continue;

            for (const cell of tr.cells) if (range.intersectsNode(cell)) leaves.push(cell);
          }
        }
      } else {
        leaves.push(child);
      }
    });

    const slices: Range[] = [];

    leaves.forEach((leaf) => {
      const slice = doc.createRange();
      slice.selectNodeContents(leaf);

      if (leaf.contains(range.startContainer)) {
        slice.setStart(range.startContainer, range.startOffset);
      }

      if (leaf.contains(range.endContainer)) {
        slice.setEnd(range.endContainer, range.endOffset);
      }

      trimRangeWhitespace(slice);

      if (!slice.collapsed && slice.toString().trim().length > 0) {
        slices.push(slice);
      }
    });

    return slices;
  };

  // A selection can be anchored on an element boundary rather than in a text node, and marks below
  // such an anchor are invisible to an ancestor walk - so mark detection must resolve the leaf here
  // first rather than read the raw container.
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

  const ensureCaret = () => {
    const el = root();

    if (!el) {
      return false;
    }

    if (getSelection()) {
      return true;
    }

    const selection = doc.getSelection();

    if (!selection) {
      return false;
    }

    const range = doc.createRange();

    if (lastRange && el.contains(lastRange.commonAncestorContainer)) {
      range.setStart(lastRange.startContainer, lastRange.startOffset);
      range.collapse(true);
    } else {
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
    blockSlices,
    resolveBoundaryNode,
    resolveStartNode,
    markStates,
    ensureCaret,
    placeCaretAtPoint,
    insertToken,
  };
};

export type RichTextEditorDomCore = ReturnType<typeof createRichTextEditorDomCore>;
