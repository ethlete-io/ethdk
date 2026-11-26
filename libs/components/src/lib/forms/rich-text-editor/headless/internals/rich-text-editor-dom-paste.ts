import { HEADING_SELECTOR, RichTextEditorDomCore } from './rich-text-editor-dom-core';

const LINE_BLOCK_TAGS = /* @__PURE__ */ new Set([
  'P',
  'DIV',
  'LI',
  'PRE',
  'BLOCKQUOTE',
  'TR',
  'UL',
  'OL',
  'TABLE',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
]);

/** The text of pasted HTML with one line per block, for a target that only takes literal text. */
export const clipboardPlainText = (root: Node) => {
  let out = '';

  const breakLine = () => {
    if (out && !out.endsWith('\n')) out += '\n';
  };

  const walk = (node: Node, preformatted: boolean) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const data = (child as Text).data;
        const text = preformatted ? data : data.replace(/[\t\n\r ]+/g, ' ');

        out += !out || out.endsWith('\n') ? (preformatted ? text : text.trimStart()) : text;

        return;
      }

      if (child.nodeType !== Node.ELEMENT_NODE) return;

      const { tagName } = child as Element;

      if (tagName === 'BR') {
        out += '\n';

        return;
      }

      const block = LINE_BLOCK_TAGS.has(tagName);

      if (block) breakLine();
      walk(child, preformatted || tagName === 'PRE');
      if (block) breakLine();
    });
  };

  walk(root, false);

  return out.replace(/[ \n]+$/, '');
};

export const createRichTextEditorPaste = (core: RichTextEditorDomCore) => {
  const { doc, renderer, root, getSelection, collectDescendants } = core;

  const isEmptyBlock = (node: Node) =>
    !node.textContent &&
    !(node instanceof HTMLElement && collectDescendants(node, 'img, [contenteditable="false"]').length > 0);

  const isParagraph = (node: Node | undefined): node is HTMLElement =>
    node instanceof HTMLElement && node.tagName === 'P';

  const insertAll = (parent: Node, nodes: Node[]) => (ref: Node | null) =>
    nodes.forEach((node) => renderer.insertBefore(parent, node, ref));

  const pruneEmptyEdgeItem = (list: HTMLElement, edge: 'first' | 'last') => {
    const item = edge === 'first' ? list.firstElementChild : list.lastElementChild;

    if (item instanceof HTMLElement && item.tagName === 'LI' && isEmptyBlock(item)) {
      renderer.removeChild(list, item);
    }
  };

  /** Returns where the caret goes when the last pasted paragraph merged into the half after the caret. */
  const insertBlocks = (range: Range, nodes: Node[]): { container: Node; offset: number } | null => {
    const el = root();

    if (!el) return null;

    if (range.startContainer === el) {
      insertAll(el, nodes)(el.childNodes[range.startOffset] ?? null);

      return null;
    }

    let anchor: Node = range.startContainer;

    while (anchor.parentNode && anchor.parentNode !== el) anchor = anchor.parentNode;

    if (!(anchor instanceof HTMLElement) || anchor.matches('table, pre')) {
      insertAll(el, nodes)(anchor.nextSibling);

      return null;
    }

    const rest = doc.createRange();
    rest.setStart(range.startContainer, range.startOffset);
    rest.setEnd(anchor, anchor.childNodes.length);

    const tail = anchor.cloneNode(false) as HTMLElement;
    renderer.appendChild(tail, rest.extractContents());

    if (anchor.matches('ul, ol')) {
      pruneEmptyEdgeItem(anchor, 'last');
      pruneEmptyEdgeItem(tail, 'first');
    }

    const ref = anchor.nextSibling;
    const pasted = [...nodes];
    const mergeable = anchor.matches(`p, div, ${HEADING_SELECTOR}`);
    const first = pasted[0];

    if (mergeable && isParagraph(first)) {
      if (isEmptyBlock(anchor)) {
        Array.from(anchor.childNodes).forEach((child) => renderer.removeChild(anchor, child));
      }

      Array.from(first.childNodes).forEach((child) => renderer.appendChild(anchor, child));
      pasted.shift();
    } else if (isEmptyBlock(anchor)) {
      renderer.removeChild(el, anchor);
    }

    let caret: { container: Node; offset: number } | null = null;
    const last = pasted[pasted.length - 1];

    if (mergeable && isParagraph(last)) {
      const moved = Array.from(last.childNodes);
      const tailStart = tail.firstChild;
      moved.forEach((child) => renderer.insertBefore(tail, child, tailStart));
      pasted[pasted.length - 1] = tail;
      caret = { container: tail, offset: moved.length };
    } else if (!isEmptyBlock(tail)) {
      pasted.push(tail);
    }

    insertAll(el, pasted)(ref);

    return caret;
  };

  const insertNormalizedHtml = (html: string) => {
    const editable = getSelection();
    const el = root();

    if (!editable || !el) return;

    const template = renderer.createElement('template') as HTMLTemplateElement;
    template.innerHTML = html;

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
      const position = insertBlocks(range, nodes);
      const caret = doc.createRange();

      if (position) {
        caret.setStart(position.container, position.offset);
      } else {
        caret.selectNodeContents(nodes[nodes.length - 1] as Node);
      }

      caret.collapse(!!position);
      const selection = doc.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(caret);
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

  return { insertNormalizedHtml };
};
