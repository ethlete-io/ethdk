import { DOCUMENT } from '@angular/common';
import { inject, signal } from '@angular/core';
import { createProvider, injectRenderer } from '@ethlete/core';

export type InlineTag = 'strong' | 'em' | 'del' | 'u' | 'code';
export type ListTag = 'ul' | 'ol';
export type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';
/** Block-level containers that can be re-tagged as a heading in place. An inline element sitting
 *  directly under the root (e.g. bare `<strong>` before any paragraph exists) is NOT one — it must
 *  be wrapped by the heading, not turned into it (which would drop the inline mark). */
const BLOCK_SELECTOR = 'p, div, blockquote, pre, li, figure, section, article';

export type EditableSelection = {
  selection: Selection;
  range: Range;
};

export type RichTextMarkStates = {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  underline: boolean;
  code: boolean;
  unorderedList: boolean;
  orderedList: boolean;
  link: boolean;
  /** Heading level of the block the selection starts in, or `null` when it is not a heading. */
  heading: number | null;
  /** Whether the selection starts inside a table cell — where block tools (headings, lists) have
   *  no GFM representation and are disabled. */
  tableCell: boolean;
};

const richTextEditorDomFactory = () => {
  const renderer = injectRenderer();
  const doc = inject(DOCUMENT);

  /** The contenteditable element, set by the owning directive once its view exists. */
  const root = signal<HTMLElement | null>(null);

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

    return { selection, range };
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

  // An inline wrapper must stay inside its block: extracting a range that crosses <li>/<p>
  // boundaries clones the partially covered blocks into the wrapper (an <em> holding <li>s inside
  // the list), which is invalid markup and serializes to broken markdown. Split such a range into
  // one slice per covered block so each slice can be wrapped within its own block. Whitespace-only
  // slices (e.g. an empty <li> swept up by an imprecise drag) are dropped entirely.
  const blockSlices = (range: Range): Range[] => {
    const el = root();
    // Boundaries resolving to no block are root-level inline flow — the root is their block, so
    // two null boundaries count as the same block just like two boundaries in the same <li>/<p>/cell.
    const startBlock = closestWithin(range.startContainer, 'li, p, td, th');
    const endBlock = closestWithin(range.endContainer, 'li, p, td, th');

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
        // a selection spanning table cells must wrap each cell's content within that cell — never
        // across cell boundaries, which would tear the table apart
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

  const wrapInline = (range: Range, tag: InlineTag) => {
    const wrappers: HTMLElement[] = [];

    blockSlices(range).forEach((slice) => {
      const wrapper = renderer.createElement(tag);

      try {
        slice.surroundContents(wrapper);
      } catch {
        renderer.appendChild(wrapper, slice.extractContents());
        slice.insertNode(wrapper);
      }

      collectDescendants(wrapper, tag).forEach((nested) => unwrapElement(nested));
      wrappers.push(wrapper);
    });

    const first = wrappers[0];
    const last = wrappers[wrappers.length - 1];

    if (!first || !last) {
      return;
    }

    if (first === last) {
      selectNodeContents(first);

      return;
    }

    // Anchor the restored selection inside the first/last wrapper rather than before/after them
    // (selectAcross) — markStates() resolves the active marks from the selection's start
    // container, so a boundary outside the wrapper would leave the toolbar button unpressed
    // until the user re-selects.
    const selection = doc.getSelection();

    if (!selection) {
      return;
    }

    const restored = doc.createRange();
    restored.setStart(first, 0);
    restored.setEnd(last, last.childNodes.length);
    selection.removeAllRanges();
    selection.addRange(restored);
  };

  const pathFromAncestor = (ancestor: Node, node: Node): number[] | null => {
    const path: number[] = [];
    let current: Node | null = node;

    while (current && current !== ancestor) {
      const parent: Node | null = current.parentNode;

      if (!parent) {
        return null;
      }

      path.unshift(Array.from(parent.childNodes).indexOf(current as ChildNode));
      current = parent;
    }

    return current === ancestor ? path : null;
  };

  const resolvePath = (ancestor: Node, path: number[]): Node | null => {
    let current: Node = ancestor;

    for (const index of path) {
      const next: Node | undefined = current.childNodes[index];

      if (!next) {
        return null;
      }

      current = next;
    }

    return current;
  };

  // `range.cloneContents()` collapses to plain text whenever the range's start and end share a
  // container (the common case when the whole marked run is selected) — it can't reconstruct any
  // ancestor elements in that situation, so nested marks (e.g. an <em> inside the <strong> being
  // unbolded) would be silently dropped. Work around it by trimming a clone of `markEl` down to
  // the selected span instead, which preserves every nested element other than `markEl` itself.
  const extractMarkedMiddle = (markEl: HTMLElement, range: Range): Node[] => {
    const startPath = pathFromAncestor(markEl, range.startContainer);
    const endPath = pathFromAncestor(markEl, range.endContainer);

    if (!startPath || !endPath) {
      return Array.from(range.cloneContents().childNodes);
    }

    const clone = markEl.cloneNode(true) as HTMLElement;
    const clonedStart = resolvePath(clone, startPath);
    const clonedEnd = resolvePath(clone, endPath);

    if (!clonedStart || !clonedEnd) {
      return Array.from(range.cloneContents().childNodes);
    }

    const trimAfter = doc.createRange();
    trimAfter.setStart(clonedEnd, range.endOffset);
    trimAfter.setEnd(clone, clone.childNodes.length);
    trimAfter.deleteContents();

    const trimBefore = doc.createRange();
    trimBefore.setStart(clone, 0);
    trimBefore.setEnd(clonedStart, range.startOffset);
    trimBefore.deleteContents();

    return Array.from(clone.childNodes);
  };

  // A mark wrapping nothing but whitespace has no markdown representation (`** **` isn't valid
  // CommonMark emphasis), so a before/after split must never leave one behind — fall through to
  // plain, unwrapped text for a whitespace-only slice instead of re-wrapping it in `tag`.
  const markSegmentNodes = (frag: DocumentFragment, tag: InlineTag): Node[] => {
    const text = frag.textContent ?? '';

    if (text.length === 0) {
      return [];
    }

    if (text.trim().length === 0) {
      return Array.from(frag.childNodes);
    }

    const wrapper = renderer.createElement(tag);
    renderer.appendChild(wrapper, frag);

    return [wrapper];
  };

  const unwrapInline = (range: Range, tag: InlineTag) => {
    const startEl = closestWithin(range.startContainer, tag);
    const endEl = closestWithin(range.endContainer, tag);

    if (startEl && startEl === endEl) {
      const beforeRange = doc.createRange();
      beforeRange.selectNodeContents(startEl);
      beforeRange.setEnd(range.startContainer, range.startOffset);

      const afterRange = doc.createRange();
      afterRange.selectNodeContents(startEl);
      afterRange.setStart(range.endContainer, range.endOffset);

      const beforeFrag = beforeRange.cloneContents();
      const afterFrag = afterRange.cloneContents();
      const selectedNodes = extractMarkedMiddle(startEl, range);
      const replacement: Node[] = [];

      replacement.push(...markSegmentNodes(beforeFrag, tag));
      selectedNodes.forEach((node) => replacement.push(node));
      replacement.push(...markSegmentNodes(afterFrag, tag));

      replaceWith(startEl, replacement);

      const first = selectedNodes[0];
      const last = selectedNodes[selectedNodes.length - 1];

      if (first && last) {
        selectAcross(first, last);
      }

      return;
    }

    const affected = new Set<HTMLElement>();

    if (startEl) affected.add(startEl);
    if (endEl) affected.add(endEl);

    const el = root();

    if (el) {
      collectDescendants(el, tag).forEach((marked) => {
        if (range.intersectsNode(marked)) {
          affected.add(marked);
        }
      });
    }

    affected.forEach((marked) => unwrapElement(marked));
  };

  const unwrapList = (list: HTMLElement) => {
    const paragraphs: Node[] = [];

    childrenByTag(list, 'li').forEach((li) => {
      const paragraph = renderer.createElement('p');

      while (li.firstChild) {
        renderer.appendChild(paragraph, li.firstChild);
      }

      paragraphs.push(paragraph);
    });

    replaceWith(list, paragraphs);

    const first = paragraphs[0];
    const last = paragraphs[paragraphs.length - 1];

    if (first && last) {
      selectAcross(first, last);
    }
  };

  const exitListItem = (li: HTMLElement) => {
    const list = li.parentElement;
    const parent = list?.parentNode;

    if (!list || !parent) {
      return;
    }

    // A nested item steps out one level at a time; only a top-level item leaves the list entirely.
    if (list.parentElement instanceof HTMLElement && list.parentElement.tagName === 'LI') {
      outdentListItem();

      return;
    }

    const tag = list.tagName.toLowerCase() as ListTag;

    // Element siblings after the empty item move into a continuation list of the same type.
    const trailing: HTMLElement[] = [];
    let sibling = li.nextElementSibling;

    while (sibling) {
      trailing.push(sibling as HTMLElement);
      sibling = sibling.nextElementSibling;
    }

    const paragraph = renderer.createElement('p');
    const refAfterList = list.nextSibling;

    // Carry over whatever the (empty) item held — typically the <br> a browser inserts so an
    // empty line still has a caret-able line box. Without one, a bare <p> can end up with no
    // line box at all, and the caret falls through to the next focusable position instead.
    while (li.firstChild) {
      renderer.appendChild(paragraph, li.firstChild);
    }

    if (!paragraph.firstChild) {
      renderer.appendChild(paragraph, renderer.createElement('br'));
    }

    if (trailing.length > 0) {
      const continuation = renderer.createElement(tag);
      trailing.forEach((item) => renderer.appendChild(continuation, item));
      renderer.insertBefore(parent, continuation, refAfterList);
      renderer.insertBefore(parent, paragraph, continuation);
    } else {
      renderer.insertBefore(parent, paragraph, refAfterList);
    }

    renderer.removeChild(list, li);

    if (childrenByTag(list, 'li').length === 0) {
      renderer.removeChild(parent, list);
    }

    collapseInto(paragraph, 0);
  };

  const mergeParagraphIntoPreviousList = (paragraph: HTMLElement) => {
    const previous = paragraph.previousElementSibling;
    const tag = previous?.tagName.toLowerCase();

    if (!previous || (tag !== 'ul' && tag !== 'ol')) {
      return false;
    }

    const items = childrenByTag(previous as HTMLElement, 'li');
    const lastLi = items[items.length - 1];

    if (!lastLi) {
      return false;
    }

    const parent = paragraph.parentNode;

    if (parent) {
      renderer.removeChild(parent, paragraph);
    }

    const selection = doc.getSelection();

    if (selection) {
      const range = doc.createRange();
      range.selectNodeContents(lastLi);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    return true;
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

    return {
      bold: !!closestWithin(node, 'strong'),
      italic: !!closestWithin(node, 'em'),
      strike: !!closestWithin(node, 'del'),
      underline: !!closestWithin(node, 'u'),
      code: !!closestWithin(node, 'code'),
      unorderedList: !!closestWithin(node, 'ul'),
      orderedList: !!closestWithin(node, 'ol'),
      link: !!closestWithin(node, 'a'),
      heading: headingEl ? Number(headingEl.tagName[1]) : null,
      tableCell: !!closestWithin(node, 'td, th'),
    };
  };

  // wrapInline's surroundContents fallback can leave behind an untouched sibling with the same
  // tag right next to the new wrapper (e.g. selecting partway into an already-bold word produces
  // two adjacent `<strong>` elements). Left unmerged, markdown serialization emits a delimiter per
  // element (duplicated `**` markers), so collapse adjacent same-tag runs back into one.
  const mergeAdjacentSameTag = (tag: InlineTag) => {
    const el = root();

    if (!el) {
      return;
    }

    let merged = true;

    while (merged) {
      merged = false;

      for (const node of collectDescendants(el, tag)) {
        const next = node.nextSibling;

        if (next instanceof HTMLElement && next.tagName.toLowerCase() === tag) {
          while (next.firstChild) {
            renderer.appendChild(node, next.firstChild);
          }

          renderer.removeChild(next.parentNode as Node, next);
          merged = true;

          break;
        }
      }
    }
  };

  // wrapInline's surroundContents fallback uses Range.extractContents(), which — per spec —
  // leaves the original ancestor element in place (now empty) whenever the range's boundary
  // fully consumes that ancestor's content, since only a clone of it travels into the extracted
  // fragment. That empty shell can be of any of the three inline tags, not just the one being
  // toggled (e.g. italicizing text that starts inside a <strong> can strand an empty <strong>).
  const pruneEmptyInline = () => {
    const el = root();

    if (!el) {
      return;
    }

    const tags: InlineTag[] = ['strong', 'em', 'del'];
    let removed = true;

    while (removed) {
      removed = false;

      for (const t of tags) {
        for (const node of collectDescendants(el, t)) {
          // extractContents() fully drains a wholly-selected text node's data via replaceData
          // rather than removing the node, so an "empty" shell can still hold a zero-length
          // Text child — check textContent, not childNodes.length, to catch that case too.
          if ((node.textContent ?? '').length === 0) {
            renderer.removeChild(node.parentNode as Node, node);
            removed = true;
          }
        }
      }
    }
  };

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

  const toggleInline = (tag: InlineTag) => {
    const editable = getSelection();
    const el = root();

    if (!el || !editable || editable.range.collapsed) {
      return;
    }

    trimRangeWhitespace(editable.range);

    if (editable.range.collapsed) {
      return;
    }

    const { range } = editable;
    // Resolve to the leaf boundary nodes so a range that wraps a whole block (its child carrying the
    // mark) is still detected as marked — otherwise the first toggle wrongly re-adds the mark.
    const startLeaf = resolveBoundaryNode(range.startContainer, range.startOffset);
    const endLeaf = resolveBoundaryNode(range.endContainer, range.endOffset);
    const fullyMarked = !!closestWithin(startLeaf, tag) && !!closestWithin(endLeaf, tag);

    if (fullyMarked) {
      unwrapInline(range, tag);
    } else {
      wrapInline(range, tag);
    }

    pruneEmptyInline();
    mergeAdjacentSameTag(tag);
    el.normalize();
  };

  const toggleList = (listTag: ListTag) => {
    const editable = getSelection();
    const el = root();

    if (!el || !editable) {
      return;
    }

    const existingList = closestWithin(editable.range.startContainer, listTag);

    if (existingList) {
      unwrapList(existingList);
      el.normalize();

      return;
    }

    // Caret inside a list of the other type: switch the list's type in place. Falling through to
    // the block-wrapping path below would treat the whole list as one block and nest its <li>s
    // inside a new <li>, going one level deeper on every toggle.
    const otherList = closestWithin(editable.range.startContainer, listTag === 'ul' ? 'ol' : 'ul');

    if (otherList) {
      const converted = renderer.createElement(listTag);

      while (otherList.firstChild) {
        renderer.appendChild(converted, otherList.firstChild);
      }

      replaceWith(otherList, [converted]);
      selectNodeContents(converted);
      el.normalize();

      return;
    }

    const rawBlocks = blocksInRange(editable.range);
    // A list can't wrap a table — a caret inside one makes the command a no-op.
    const blocks = rawBlocks.filter((block) => !(block instanceof HTMLElement && block.tagName === 'TABLE'));

    if (rawBlocks.length > 0 && blocks.length === 0) {
      return;
    }

    const list = renderer.createElement(listTag);

    // An empty editor has no blocks to wrap — start a fresh list with one empty item instead.
    // The <br> gives the item a line box so the caret has somewhere to land (see exitListItem).
    if (blocks.length === 0) {
      const li = renderer.createElement('li');
      renderer.appendChild(li, renderer.createElement('br'));
      renderer.appendChild(list, li);
      renderer.appendChild(el, list);
      collapseInto(li, 0);

      return;
    }

    blocks.forEach((block) => {
      // A block that is itself a list (a selection spanning a paragraph and a list of the other
      // type) contributes its items directly — wrapping it would nest its <li>s inside a new <li>.
      if (block instanceof HTMLElement && (block.tagName === 'UL' || block.tagName === 'OL')) {
        childrenByTag(block, 'li').forEach((item) => renderer.appendChild(list, item));

        return;
      }

      const li = renderer.createElement('li');

      if (block.nodeType === Node.TEXT_NODE) {
        renderer.appendChild(li, block.cloneNode(true));
      } else {
        while (block.firstChild) {
          renderer.appendChild(li, block.firstChild);
        }
      }

      renderer.appendChild(list, li);
    });

    renderer.insertBefore(el, list, blocks[0] ?? null);
    blocks.forEach((block) => {
      if (block.parentNode === el) {
        renderer.removeChild(el, block);
      }
    });

    selectNodeContents(list);
    el.normalize();
  };

  // Re-tag a block-level element in place, carrying its children (including any inline marks)
  // into the new element. Used to turn a paragraph into a heading and back.
  const replaceBlockTag = (block: HTMLElement, tag: HeadingTag | 'p'): HTMLElement => {
    const replacement = renderer.createElement(tag);

    // alignment survives the re-tag — it's the one style the editor persists on blocks
    if (block.style.textAlign) {
      renderer.setStyle(replacement, { textAlign: block.style.textAlign });
    }

    while (block.firstChild) {
      renderer.appendChild(replacement, block.firstChild);
    }

    replaceWith(block, [replacement]);

    return replacement;
  };

  const toggleHeading = (tag: HeadingTag) => {
    const editable = getSelection();
    const el = root();

    if (!el || !editable) {
      return;
    }

    const rawBlocks = blocksInRange(editable.range);
    // Headings can't wrap a table (and wrapping the whole table would style every cell) — a caret
    // inside one makes the heading a no-op, matching how it leaves lists untouched.
    const blocks = rawBlocks.filter((block) => !(block instanceof HTMLElement && block.tagName === 'TABLE'));

    if (rawBlocks.length > 0 && blocks.length === 0) {
      return;
    }

    // An empty editor has no block to convert — start a fresh heading with an empty line box so
    // the caret has somewhere to land, mirroring toggleList's empty-editor branch.
    if (blocks.length === 0) {
      const heading = renderer.createElement(tag);
      renderer.appendChild(heading, renderer.createElement('br'));
      renderer.appendChild(el, heading);
      collapseInto(heading, 0);

      return;
    }

    const produced: Node[] = [];

    blocks.forEach((block) => {
      // A heading cannot contain list items, so leave lists untouched — the heading button is a
      // no-op over a selected list rather than producing invalid markup.
      if (block instanceof HTMLElement && (block.tagName === 'UL' || block.tagName === 'OL')) {
        produced.push(block);

        return;
      }

      if (block instanceof HTMLElement && block.matches(HEADING_SELECTOR)) {
        // Same level toggles back to a paragraph; a different level re-levels the heading.
        produced.push(replaceBlockTag(block, block.tagName.toLowerCase() === tag ? 'p' : tag));

        return;
      }

      if (block instanceof HTMLElement && block.matches(BLOCK_SELECTOR)) {
        produced.push(replaceBlockTag(block, tag));

        return;
      }

      // A bare text node, <br>, or bare inline element (e.g. <strong> before any paragraph exists)
      // sitting directly under the root has no wrapping block — move it into a fresh heading in the
      // same position, preserving its inline markup.
      const heading = renderer.createElement(tag);
      const ref = block.nextSibling;

      renderer.removeChild(el, block);
      renderer.appendChild(heading, block);
      renderer.insertBefore(el, heading, ref);
      produced.push(heading);
    });

    const first = produced[0];
    const last = produced[produced.length - 1];

    if (first && last) {
      if (first === last) {
        selectNodeContents(first);
      } else {
        selectAcross(first, last);
      }
    }

    el.normalize();
  };

  const applyLink = (href: string) => {
    const editable = getSelection();

    if (!editable) {
      return;
    }

    const existing = closestWithin(editable.range.startContainer, 'a');

    if (existing) {
      renderer.setAttribute(existing, 'href', href);

      return;
    }

    if (editable.range.collapsed) {
      return;
    }

    const el = root();
    const anchor = renderer.createElement('a');
    renderer.setAttribute(anchor, 'href', href);

    try {
      editable.range.surroundContents(anchor);
    } catch {
      // The range crosses an existing <a> boundary (e.g. it starts before the anchor and ends
      // inside it) — surroundContents throws, so fall back to extract + insert. That fallback can
      // pull the whole existing anchor's content into the new one (nesting an <a> inside an <a>)
      // and, per Range.extractContents()'s spec, strand the drained original anchor as an empty
      // shell — both of which produce broken markdown (nested/empty link syntax).
      renderer.appendChild(anchor, editable.range.extractContents());
      editable.range.insertNode(anchor);
    }

    collectDescendants(anchor, 'a').forEach((nested) => unwrapElement(nested));

    if (el) {
      collectDescendants(el, 'a')
        .filter((node) => (node.textContent ?? '').length === 0)
        .forEach((empty) => renderer.removeChild(empty.parentNode as Node, empty));

      el.normalize();
    }

    selectNodeContents(anchor);
  };

  const removeLink = () => {
    const editable = getSelection();
    const anchor = editable ? closestWithin(editable.range.startContainer, 'a') : null;
    const el = root();

    if (anchor && el) {
      unwrapElement(anchor);
      el.normalize();
    }
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

  /**
   * Markdown block autoformat: typing a space right after a line-start markdown prefix converts the
   * block — `-`/`*`/`+` into a bulleted list, `1.` into a numbered list, `#`–`###` into a heading.
   * Only fires when the prefix is the entire line before the caret, and never inside contexts the
   * block tools don't apply to (list items, table cells, code, headings). `isReserved` marks
   * characters claimed by the token-trigger system — a reserved prefix never converts, so e.g. a
   * `#` trigger keeps opening its autocomplete instead of becoming a heading.
   * Returns `true` when it converted (the caller must then swallow the typed space).
   */
  const applyBlockAutoformat = (isReserved: (char: string) => boolean) => {
    const editable = getSelection();
    const el = root();

    if (!el || !editable || !editable.range.collapsed) return false;

    const { range } = editable;

    if (closestWithin(range.startContainer, `li, td, th, pre, code, ${HEADING_SELECTOR}`)) return false;

    // The line starts at the caret's paragraph — a browser-created <div> line counts too (Chrome
    // inserts <div>s on Enter; the serializer maps them to paragraphs) — or at the editor root for
    // the loose first line a contenteditable holds before any block exists.
    const container = closestWithin(range.startContainer, 'p, div') ?? el;
    const probe = doc.createRange();

    probe.selectNodeContents(container);
    probe.setEnd(range.startContainer, range.startOffset);

    const prefix = probe.toString();

    let action: (() => void) | null = null;

    if (/^[-*+]$/.test(prefix) && !isReserved(prefix)) {
      action = () => toggleList('ul');
    } else if (/^\d{1,9}\.$/.test(prefix) && !isReserved(prefix[0] ?? '')) {
      action = () => toggleList('ol');
    } else if (/^#{1,3}$/.test(prefix) && !isReserved('#')) {
      action = () => toggleHeading(`h${prefix.length}` as HeadingTag);
    }

    if (!action) return false;

    probe.deleteContents();
    el.normalize();
    collapseInto(container === el ? el : container, 0);
    action();

    // The consumed prefix usually leaves the converted block empty — give it a line box and a
    // clean collapsed caret so typing continues inside it.
    const editableAfter = getSelection();
    // descend from the restored selection's boundary (e.g. the <ul> after toggleList) to the leaf
    const landed = editableAfter
      ? closestWithin(resolveStartNode(editableAfter.range), `li, ${HEADING_SELECTOR}`)
      : null;

    if (landed && isBlockEmpty(landed)) {
      if (collectDescendants(landed, 'br').length === 0) {
        renderer.appendChild(landed, renderer.createElement('br'));
      }

      collapseInto(landed, 0);
    }

    return true;
  };

  /** The inline autoformat rules: markdown delimiter runs completed by the typed closing char.
   *  Longer delimiters come first so `**` wins over `*` (and `__` over `_`). */
  const inlineAutoformatRules: { char: string; tag: InlineTag; re: RegExp }[] = [
    { char: '*', tag: 'strong', re: /\*\*([^\s*](?:[^*]*[^\s*])?)\*\*$/ },
    { char: '*', tag: 'em', re: /(?<!\*)\*([^\s*](?:[^*]*[^\s*])?)\*$/ },
    { char: '~', tag: 'del', re: /~~([^\s~](?:[^~]*[^\s~])?)~~$/ },
    { char: '`', tag: 'code', re: /`([^`]+)`$/ },
    { char: '_', tag: 'strong', re: /(?<![\w_])__([^\s_](?:[^_]*[^\s_])?)__$/ },
    { char: '_', tag: 'em', re: /(?<![\w_])_([^\s_](?:[^_]*[^\s_])?)_$/ },
  ];

  /**
   * Markdown inline autoformat: typing the closing delimiter of `**bold**`, `*italic*`,
   * `` `code` ``, `~~strike~~`, `__bold__` or `_italic_` converts the run into its mark, with the
   * caret placed after the mark so typing continues unformatted. The whole run must live in the
   * caret's text node (marks already applied inside it keep it from matching — a v1 limit).
   * `typed` is the char about to be inserted; returns `true` when it consumed it.
   */
  const applyInlineAutoformat = (typed: string, isReserved: (char: string) => boolean) => {
    const editable = getSelection();
    const el = root();

    if (!el || !editable || !editable.range.collapsed) return false;

    const { range } = editable;
    const node = range.startContainer;

    if (!(node instanceof Text)) return false;

    // backticks & co. are literal inside code spans/blocks
    if (closestWithin(node, 'code, pre')) return false;

    const text = (node.textContent ?? '').slice(0, range.startOffset) + typed;

    for (const rule of inlineAutoformatRules) {
      if (rule.char !== typed || isReserved(rule.char)) continue;

      const match = rule.re.exec(text);

      if (!match) continue;

      const inner = match[1] ?? '';
      const start = match.index;

      node.deleteData(start, range.startOffset - start);

      const mark = renderer.createElement(rule.tag) as HTMLElement;

      renderer.appendChild(mark, renderer.createText(inner));

      const insertAt = doc.createRange();

      insertAt.setStart(node, start);
      insertAt.collapse(true);
      insertAt.insertNode(mark);

      // Land the caret in a real text node after the mark (a zero-width space when nothing
      // follows — stripped on serialize), mirroring codeExit: a bare element boundary doesn't
      // stick and the browser would snap the caret back inside the mark.
      let target = mark.nextSibling;
      let offset = 0;

      if (!(target instanceof Text) || target.length === 0) {
        target = renderer.createText('\u200b');
        renderer.insertBefore(mark.parentNode as Node, target, mark.nextSibling);
        offset = 1;
      }

      collapseInto(target, offset);

      return true;
    }

    return false;
  };

  /**
   * Inserts already-normalized editor HTML at the selection (replacing it). Content that is a
   * single paragraph (or bare inline flow) is spliced into the caret's block; multi-block content
   * is inserted as root-level blocks after the caret's block — the surrounding block is not split.
   */
  const insertNormalizedHtml = (html: string) => {
    const editable = getSelection();
    const el = root();

    if (!editable || !el) return;

    const template = renderer.createElement('template') as HTMLTemplateElement;
    template.innerHTML = html;

    // a lone paragraph opens up into its inline children so it flows into the caret's block
    const only = template.content.childNodes.length === 1 ? template.content.firstChild : null;

    if (only instanceof HTMLElement && only.tagName === 'P') {
      only.replaceWith(...only.childNodes);
    }

    const nodes = Array.from(template.content.childNodes);

    if (nodes.length === 0) return;

    const { range } = editable;
    range.deleteContents();

    const isBlock = (node: Node) =>
      node instanceof HTMLElement && !node.matches('a, strong, em, del, u, code, span, br, img');

    if (nodes.some(isBlock)) {
      // block content goes to the root level, after the block holding the caret
      let anchor: Node | null = range.startContainer;

      while (anchor && anchor !== el && anchor.parentNode !== el) anchor = anchor.parentNode;

      let ref: Node | null = anchor && anchor !== el ? anchor.nextSibling : null;

      nodes.forEach((node) => {
        renderer.insertBefore(el, node, ref);
        ref = node.nextSibling;
      });

      const last = nodes[nodes.length - 1];

      if (last) {
        const caret = doc.createRange();
        caret.selectNodeContents(last);
        caret.collapse(false);
        const selection = doc.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(caret);
      }
    } else {
      nodes.forEach((node) => {
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
      });

      const selection = doc.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }

    el.normalize();
  };

  const handleBackspace = () => {
    const editable = getSelection();

    if (!editable || !editable.range.collapsed) {
      return false;
    }

    const node = editable.range.startContainer;
    const li = closestWithin(node, 'li');

    if (li && isBlockEmpty(li)) {
      exitListItem(li);

      return true;
    }

    const paragraph = closestWithin(node, 'p');

    if (paragraph && isBlockEmpty(paragraph)) {
      // an empty first line sitting directly above a table can't merge upward — remove it and drop
      // the caret into the table so an unneeded exit line can be deleted
      const next = paragraph.nextElementSibling;

      if (!paragraph.previousElementSibling && next instanceof HTMLTableElement) {
        const el = root();
        let cell: HTMLTableCellElement | null = null;

        for (const section of next.children) {
          if (section instanceof HTMLTableSectionElement) {
            for (const tr of section.children) {
              if (tr instanceof HTMLTableRowElement && tr.cells[0]) {
                cell = tr.cells[0];
                break;
              }
            }
          }

          if (cell) break;
        }

        if (el) renderer.removeChild(el, paragraph);
        if (cell) collapseInto(cell, 0);

        return true;
      }

      return mergeParagraphIntoPreviousList(paragraph);
    }

    return false;
  };

  /** Enter at the edge of a root-level heading starts a plain paragraph instead of letting the
   *  browser continue the heading: at the end, an empty paragraph follows and receives the caret;
   *  at the start, an empty paragraph is inserted above and the heading keeps the caret.
   *  Mid-heading Enter stays native (splitting into two headings, like every editor). */
  const headingEnter = () => {
    const editable = getSelection();
    const el = root();

    if (!editable || !el || !editable.range.collapsed) {
      return false;
    }

    const { range } = editable;
    const heading = closestWithin(range.startContainer, HEADING_SELECTOR);

    if (!heading || heading.parentElement !== el || isBlockEmpty(heading)) {
      return false;
    }

    const textToward = (side: 'start' | 'end') => {
      const probe = doc.createRange();
      probe.selectNodeContents(heading);

      if (side === 'end') probe.setStart(range.startContainer, range.startOffset);
      else probe.setEnd(range.startContainer, range.startOffset);

      return probe.toString().length;
    };

    const paragraph = renderer.createElement('p');
    renderer.appendChild(paragraph, renderer.createElement('br'));

    if (textToward('end') === 0) {
      renderer.insertBefore(el, paragraph, heading.nextSibling);
      collapseInto(paragraph, 0);

      return true;
    }

    if (textToward('start') === 0) {
      renderer.insertBefore(el, paragraph, heading);

      return true;
    }

    return false;
  };

  /** Enter on an empty list item steps it out one nesting level (or leaves the list at the top),
   *  instead of inserting another empty item; Enter at a heading's edge starts a paragraph.
   *  Returns `true` when handled. */
  const handleEnter = () => {
    const editable = getSelection();

    if (!editable || !editable.range.collapsed) {
      return false;
    }

    const li = closestWithin(editable.range.startContainer, 'li');

    if (li && isBlockEmpty(li)) {
      exitListItem(li);

      return true;
    }

    return headingEnter();
  };

  // The inline mark elements a caret can sit inside; used for the collapsed-caret "stored marks" flow.
  const inlineMarkTags = new Set<string>(['STRONG', 'EM', 'DEL', 'U', 'CODE']);

  /** The inline mark tags wrapping the collapsed caret (innermost-first). */
  const activeInlineTags = (): InlineTag[] => {
    const editable = getSelection();
    const el = root();

    if (!editable || !el) return [];

    const tags: InlineTag[] = [];
    const start = editable.range.startContainer;
    let node: HTMLElement | null = start.nodeType === Node.ELEMENT_NODE ? (start as HTMLElement) : start.parentElement;

    while (node && node !== el) {
      if (inlineMarkTags.has(node.tagName)) tags.push(node.tagName.toLowerCase() as InlineTag);
      node = node.parentElement;
    }

    return tags;
  };

  /** Splits every inline-mark ancestor at the collapsed caret so it ends up outside all of them. */
  const splitInlineAncestorsAtCaret = (range: Range) => {
    const el = root();

    if (!el) return;

    let guard = 0;

    while (guard++ < 32) {
      const start = range.startContainer;
      let mark: HTMLElement | null =
        start.nodeType === Node.ELEMENT_NODE ? (start as HTMLElement) : start.parentElement;

      while (mark && mark !== el && !inlineMarkTags.has(mark.tagName)) mark = mark.parentElement;

      if (!mark || mark === el || !inlineMarkTags.has(mark.tagName)) return;

      // Move the content after the caret (within this mark) into a same-tag clone placed after it.
      const tail = doc.createRange();
      tail.setStart(range.startContainer, range.startOffset);
      tail.setEnd(mark, mark.childNodes.length);
      const frag = tail.extractContents();

      if ((frag.textContent ?? '').length > 0) {
        const clone = mark.cloneNode(false) as HTMLElement;
        while (frag.firstChild) renderer.appendChild(clone, frag.firstChild);
        renderer.insertBefore(mark.parentNode as Node, clone, mark.nextSibling);
      }

      range.setStartAfter(mark);
      range.collapse(true);
    }
  };

  /**
   * Inserts `text` at the collapsed caret carrying exactly `tags` as inline marks — breaking out of
   * whatever marks currently wrap the caret first. Drives "stored marks": toggling a mark with no
   * selection changes what the next typed text is wrapped in.
   */
  const insertInlineText = (text: string, tags: InlineTag[]) => {
    const editable = getSelection();
    const el = root();

    if (!editable || !el || !editable.range.collapsed) return;

    const range = editable.range;

    splitInlineAncestorsAtCaret(range);

    let content: Node = renderer.createText(text);

    for (const tag of tags) {
      const wrapper = renderer.createElement(tag) as HTMLElement;
      renderer.appendChild(wrapper, content);
      content = wrapper;
    }

    range.insertNode(content);

    // Caret to the end of the inserted text (inside the innermost mark when there is one) so native
    // typing continues in the right formatting context.
    let deepest: Node = content;
    while (deepest.firstChild) deepest = deepest.firstChild;
    const caret = doc.createRange();
    caret.setStart(deepest, (deepest.textContent ?? '').length);
    caret.collapse(true);
    const selection = doc.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(caret);

    pruneEmptyInline();
  };

  const listItemAtCaret = (): HTMLElement | null => {
    const editable = getSelection();

    return editable ? closestWithin(editable.range.startContainer, 'li') : null;
  };

  /** Tab in a list: nest the current item into a sublist under the previous item. No-op for the
   *  first item (nothing to nest under). Returns `true` when handled. */
  const indentListItem = () => {
    const editable = getSelection();
    const li = listItemAtCaret();

    if (!editable || !li) return false;

    const prev = li.previousElementSibling;

    if (!(prev instanceof HTMLElement) || prev.tagName !== 'LI') return false;

    const listTag = (li.parentElement?.tagName.toLowerCase() ?? 'ul') as ListTag;
    const last = prev.lastElementChild;
    let sublist: HTMLElement;

    if (last instanceof HTMLElement && (last.tagName === 'UL' || last.tagName === 'OL')) {
      sublist = last;
    } else {
      sublist = renderer.createElement(listTag);
      renderer.appendChild(prev, sublist);
    }

    const { startContainer, startOffset } = editable.range;
    renderer.appendChild(sublist, li);
    collapseInto(startContainer, startOffset);

    return true;
  };

  /** Shift+Tab in a list: lift the current item out one nesting level. No-op at the top level.
   *  Returns `true` when handled. */
  const outdentListItem = () => {
    const editable = getSelection();
    const li = listItemAtCaret();

    if (!editable || !li) return false;

    const sublist = li.parentElement;
    const parentLi = sublist?.parentElement;

    if (!(parentLi instanceof HTMLElement) || parentLi.tagName !== 'LI') return false;

    const outerList = parentLi.parentElement;

    if (!outerList) return false;

    const { startContainer, startOffset } = editable.range;
    renderer.insertBefore(outerList, li, parentLi.nextSibling);

    if (sublist && sublist.childElementCount === 0 && sublist.parentElement) {
      renderer.removeChild(sublist.parentElement, sublist);
    }

    collapseInto(startContainer, startOffset);

    return true;
  };

  /**
   * ArrowRight at the end of an inline `<code>` span (or ArrowLeft at its start) steps the caret
   * just outside the code element, so continuing to type isn't code. Returns `true` when handled.
   */
  const codeExit = (key: string) => {
    if (key !== 'ArrowRight' && key !== 'ArrowLeft') return false;

    const editable = getSelection();

    if (!editable || !editable.range.collapsed) return false;

    const { range } = editable;
    const code = closestWithin(range.startContainer, 'code');

    // inline code only — leave fenced code blocks (`<pre><code>`) alone
    if (!code || closestWithin(range.startContainer, 'pre')) return false;

    const emptyToward = (side: 'start' | 'end') => {
      const r = doc.createRange();
      r.selectNodeContents(code);
      if (side === 'end') r.setStart(range.startContainer, range.startOffset);
      else r.setEnd(range.startContainer, range.startOffset);

      return r.toString().length === 0;
    };

    let target: Node;
    let offset: number;

    // Just moving the caret past the code's boundary doesn't stick — the browser snaps it back
    // inside. Land it in a real text node outside the code instead, inserting a zero-width-space
    // node when there's nothing adjacent (stripped on serialize).
    if (key === 'ArrowRight' && emptyToward('end')) {
      const next = code.nextSibling;

      if (next && next.nodeType === Node.TEXT_NODE) {
        target = next;
        offset = 0;
      } else {
        target = renderer.createText('\u200b');
        renderer.insertBefore(code.parentNode as Node, target, code.nextSibling);
        offset = 1;
      }
    } else if (key === 'ArrowLeft' && emptyToward('start')) {
      const previous = code.previousSibling;

      if (previous && previous.nodeType === Node.TEXT_NODE) {
        target = previous;
        offset = previous.textContent?.length ?? 0;
      } else {
        target = renderer.createText('\u200b');
        renderer.insertBefore(code.parentNode as Node, target, code);
        offset = 0;
      }
    } else {
      return false;
    }

    const caret = doc.createRange();
    caret.setStart(target, offset);
    caret.collapse(true);
    const selection = doc.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(caret);

    return true;
  };

  /**
   * Moves the caret out of a root-level table when an arrow key would otherwise strand it at the
   * table's edge (a contenteditable quirk). Steps into the adjacent block, creating an empty
   * paragraph when the table sits flush against the top/bottom of the editor. Returns `true` when it
   * handled the key (the caller must then prevent the default).
   */
  const tableExit = (key: string) => {
    const el = root();
    const editable = getSelection();

    if (!el || !editable || !editable.range.collapsed) return false;

    const { range } = editable;
    let cell: HTMLElement | null =
      range.startContainer instanceof HTMLElement ? range.startContainer : range.startContainer.parentElement;

    while (cell && cell !== el && !(cell instanceof HTMLTableCellElement)) cell = cell.parentElement;

    if (!(cell instanceof HTMLTableCellElement)) return false;

    const row = cell.parentElement;
    const table = row?.parentElement?.parentElement;

    if (!(row instanceof HTMLTableRowElement) || !(table instanceof HTMLTableElement) || table.parentElement !== el) {
      return false;
    }

    const rows: HTMLTableRowElement[] = [];
    for (const section of table.children) {
      if (section instanceof HTMLTableSectionElement) {
        for (const r of section.children) if (r instanceof HTMLTableRowElement) rows.push(r);
      }
    }

    const firstRow = rows[0] === row;
    const lastRow = rows[rows.length - 1] === row;
    const firstCell = row.cells[0] === cell;
    const lastCell = row.cells[row.cells.length - 1] === cell;

    const atCellStart = () => {
      const r = doc.createRange();
      r.selectNodeContents(cell);
      r.setEnd(range.startContainer, range.startOffset);

      return r.toString().length === 0;
    };
    const atCellEnd = () => {
      const r = doc.createRange();
      r.selectNodeContents(cell);
      r.setStart(range.startContainer, range.startOffset);

      return r.toString().length === 0;
    };

    let edge: 'before' | 'after' | null = null;

    if (key === 'ArrowUp' && firstRow) edge = 'before';
    else if (key === 'ArrowDown' && lastRow) edge = 'after';
    else if (key === 'ArrowLeft' && firstRow && firstCell && atCellStart()) edge = 'before';
    else if (key === 'ArrowRight' && lastRow && lastCell && atCellEnd()) edge = 'after';

    if (!edge) return false;

    const sibling = edge === 'before' ? table.previousElementSibling : table.nextElementSibling;
    let target = sibling instanceof HTMLElement ? sibling : null;

    if (!target) {
      target = renderer.createElement('p');
      renderer.appendChild(target, renderer.createElement('br'));
      renderer.insertBefore(el, target, edge === 'before' ? table : table.nextSibling);
    }

    const caret = doc.createRange();
    caret.selectNodeContents(target);
    caret.collapse(edge === 'before' ? false : true);
    const selection = doc.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(caret);

    return true;
  };

  /**
   * Moves the caret INTO an adjacent root-level table (its first/last cell) when an arrow key from a
   * neighbouring block would otherwise strand it at the table's edge. Returns `true` when handled.
   */
  const tableEnter = (key: string) => {
    const el = root();
    const editable = getSelection();

    if (!el || !editable || !editable.range.collapsed) return false;

    const { range } = editable;
    let block: Node | null = range.startContainer;

    while (block && block.parentNode !== el) block = block.parentNode;

    if (!block || block instanceof HTMLTableElement) return false;

    const atEdge = (side: 'start' | 'end') => {
      const r = doc.createRange();
      r.selectNodeContents(block as Node);
      if (side === 'start') r.setEnd(range.startContainer, range.startOffset);
      else r.setStart(range.startContainer, range.startOffset);

      return r.toString().length === 0;
    };

    const elementSibling = (from: Node, dir: 'next' | 'prev'): Element | null => {
      let sib = dir === 'next' ? from.nextSibling : from.previousSibling;
      while (sib && sib.nodeType !== Node.ELEMENT_NODE) sib = dir === 'next' ? sib.nextSibling : sib.previousSibling;

      return sib instanceof Element ? sib : null;
    };

    let table: Element | null = null;
    let edge: 'first' | 'last' = 'first';

    if ((key === 'ArrowDown' || key === 'ArrowRight') && atEdge('end')) {
      table = elementSibling(block, 'next');
      edge = 'first';
    } else if ((key === 'ArrowUp' || key === 'ArrowLeft') && atEdge('start')) {
      table = elementSibling(block, 'prev');
      edge = 'last';
    }

    if (!(table instanceof HTMLTableElement)) return false;

    const rows: HTMLTableRowElement[] = [];
    for (const section of table.children) {
      if (section instanceof HTMLTableSectionElement) {
        for (const r of section.children) if (r instanceof HTMLTableRowElement) rows.push(r);
      }
    }

    const targetRow = edge === 'first' ? rows[0] : rows[rows.length - 1];
    const cell = targetRow?.cells[edge === 'first' ? 0 : targetRow.cells.length - 1];

    if (!cell) return false;

    collapseInto(cell, 0);

    return true;
  };

  return {
    root,
    getSelection,
    closestWithin,
    markStates,
    activeInlineTags,
    toggleInline,
    insertInlineText,
    codeExit,
    indentListItem,
    outdentListItem,
    tableExit,
    tableEnter,
    toggleList,
    toggleHeading,
    applyLink,
    removeLink,
    insertToken,
    insertNormalizedHtml,
    applyBlockAutoformat,
    applyInlineAutoformat,
    handleBackspace,
    handleEnter,
  };
};

export type RichTextEditorDom = ReturnType<typeof richTextEditorDomFactory>;

export const [provideRichTextEditorDom, injectRichTextEditorDom] = createProvider(richTextEditorDomFactory, {
  name: 'RichTextEditorDom',
});
