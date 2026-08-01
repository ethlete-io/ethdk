import { RichTextEditorDomCore, InlineTag } from './rich-text-editor-dom-core';

/**
 * Inline mark (bold/italic/strike/underline/code) toggling over arbitrary selections - including
 * cross-block slicing, nested-mark preservation on unwrap, and the collapsed-caret "stored marks"
 * insertion flow.
 */
export const createRichTextEditorInlineMarks = (core: RichTextEditorDomCore) => {
  const {
    doc,
    renderer,
    root,
    getSelection,
    closestWithin,
    selectNodeContents,
    selectAcross,
    unwrapElement,
    replaceWith,
    collectDescendants,
    trimRangeWhitespace,
    resolveBoundaryNode,
  } = core;

  // An inline wrapper must stay inside its block: extracting a range that crosses <li>/<p>
  // boundaries clones the partially covered blocks into the wrapper (an <em> holding <li>s inside
  // the list), which is invalid markup and serializes to broken markdown. Split such a range into
  // one slice per covered block so each slice can be wrapped within its own block. Whitespace-only
  // slices (e.g. an empty <li> swept up by an imprecise drag) are dropped entirely.
  const blockSlices = (range: Range): Range[] => {
    const el = root();
    // Boundaries resolving to no block are root-level inline flow - the root is their block, so
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
        // a selection spanning table cells must wrap each cell's content within that cell - never
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
    // (selectAcross) - markStates() resolves the active marks from the selection's start
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
  // container (the common case when the whole marked run is selected) - it can't reconstruct any
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
  // CommonMark emphasis), so a before/after split must never leave one behind - fall through to
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

  // wrapInline's surroundContents fallback uses Range.extractContents(), which - per spec -
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
          // Text child - check textContent, not childNodes.length, to catch that case too.
          if ((node.textContent ?? '').length === 0) {
            renderer.removeChild(node.parentNode as Node, node);
            removed = true;
          }
        }
      }
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
    // mark) is still detected as marked - otherwise the first toggle wrongly re-adds the mark.
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
   * Inserts `text` at the collapsed caret carrying exactly `tags` as inline marks - breaking out of
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

    let deepest: Node = content;
    while (deepest.firstChild) deepest = deepest.firstChild;

    // A plain trailing space at the end of a line is CSS-collapsed, and Chrome removes it from the
    // text node on the next keystroke - the caret would snap back inside the very mark it just
    // escaped, silently undoing the toggle (same trap as collapseAfterInline). Use a no-break
    // space there; serialization normalizes it back to a plain space.
    const next = content.nextSibling;
    const endsLine = !next || (next instanceof Text && next.data.length === 0);

    if (endsLine && deepest instanceof Text && deepest.data.endsWith(' ')) {
      deepest.data = deepest.data.replace(/ +$/, (spaces) => '\u00a0'.repeat(spaces.length));
    }

    // Caret to the end of the inserted text (inside the innermost mark when there is one) so native
    // typing continues in the right formatting context.
    const caret = doc.createRange();
    caret.setStart(deepest, (deepest.textContent ?? '').length);
    caret.collapse(true);
    const selection = doc.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(caret);

    pruneEmptyInline();
  };

  return { toggleInline, activeInlineTags, insertInlineText };
};

export type RichTextEditorDomInlineMarks = ReturnType<typeof createRichTextEditorInlineMarks>;
