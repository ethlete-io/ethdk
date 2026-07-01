import { DOCUMENT } from '@angular/common';
import { inject, signal } from '@angular/core';
import { createProvider, injectRenderer } from '@ethlete/core';

export type InlineTag = 'strong' | 'em' | 'del';
export type ListTag = 'ul' | 'ol';

export type EditableSelection = {
  selection: Selection;
  range: Range;
};

export type RichTextMarkStates = {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  unorderedList: boolean;
  orderedList: boolean;
  link: boolean;
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

  const wrapInline = (range: Range, tag: InlineTag) => {
    const wrapper = renderer.createElement(tag);

    try {
      range.surroundContents(wrapper);
    } catch {
      renderer.appendChild(wrapper, range.extractContents());
      range.insertNode(wrapper);
    }

    collectDescendants(wrapper, tag).forEach((nested) => unwrapElement(nested));
    selectNodeContents(wrapper);
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

  const markStates = (): RichTextMarkStates | null => {
    const editable = getSelection();

    if (!editable) {
      return null;
    }

    const node = editable.range.startContainer;

    return {
      bold: !!closestWithin(node, 'strong'),
      italic: !!closestWithin(node, 'em'),
      strike: !!closestWithin(node, 'del'),
      unorderedList: !!closestWithin(node, 'ul'),
      orderedList: !!closestWithin(node, 'ol'),
      link: !!closestWithin(node, 'a'),
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
    const fullyMarked = !!closestWithin(range.startContainer, tag) && !!closestWithin(range.endContainer, tag);

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

    const blocks = blocksInRange(editable.range);

    if (blocks.length === 0) {
      return;
    }

    const list = renderer.createElement(listTag);

    blocks.forEach((block) => {
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
      return mergeParagraphIntoPreviousList(paragraph);
    }

    return false;
  };

  return {
    root,
    getSelection,
    closestWithin,
    markStates,
    toggleInline,
    toggleList,
    applyLink,
    removeLink,
    insertToken,
    handleBackspace,
  };
};

export type RichTextEditorDom = ReturnType<typeof richTextEditorDomFactory>;

export const [provideRichTextEditorDom, injectRichTextEditorDom] = createProvider(richTextEditorDomFactory, {
  name: 'RichTextEditorDom',
});
