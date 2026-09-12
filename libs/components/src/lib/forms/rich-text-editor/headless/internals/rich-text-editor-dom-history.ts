import { RichTextEditorDomCore } from './rich-text-editor-dom-core';
import { RichTextEditorSelectionOffsets } from './rich-text-editor-history';

const locateTextOffset = (root: HTMLElement, target: number): { node: Node; offset: number } => {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let last: Text | null = null;

  while (walker.nextNode()) {
    const text = walker.currentNode as Text;

    if (consumed + text.length >= target) return { node: text, offset: target - consumed };

    consumed += text.length;
    last = text;
  }

  return last ? { node: last, offset: last.length } : { node: root, offset: root.childNodes.length };
};

export const createRichTextEditorDomHistory = (core: RichTextEditorDomCore) => {
  const { doc, root, getSelection } = core;

  const readSelectionOffsets = (): RichTextEditorSelectionOffsets | null => {
    const el = root();
    const editable = getSelection();

    if (!el || !editable) return null;

    const { range } = editable;
    const prefix = doc.createRange();

    prefix.setStart(el, 0);
    prefix.setEnd(range.startContainer, range.startOffset);

    // Range.toString() concatenates the text nodes it spans - the same metric locateTextOffset walks.
    const start = prefix.toString().length;

    return { start, end: start + range.toString().length };
  };

  const restoreSelectionOffsets = (offsets: RichTextEditorSelectionOffsets | null) => {
    const el = root();
    const selection = doc.getSelection();

    if (!el || !selection) return;

    const range = doc.createRange();

    if (offsets) {
      const start = locateTextOffset(el, offsets.start);
      const end = offsets.end === offsets.start ? start : locateTextOffset(el, offsets.end);

      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
    } else {
      range.selectNodeContents(el);
      range.collapse(false);
    }

    selection.removeAllRanges();
    selection.addRange(range);
  };

  return { readSelectionOffsets, restoreSelectionOffsets };
};

export type RichTextEditorDomHistory = ReturnType<typeof createRichTextEditorDomHistory>;
