import { RichTextEditorDomCore } from './rich-text-editor-dom-core';
import { RichTextEditorSelectionOffsets } from './rich-text-editor-history';

/**
 * The text node (and offset into it) that sits `target` characters into `root`'s text content,
 * counting the same way {@link createRichTextEditorDomHistory}'s reader does: text nodes only, so
 * block boundaries and `<br>`s contribute nothing. Past the end it clamps to the last text node.
 */
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

/**
 * Reads and re-applies the selection as plain character offsets, which is what makes the snapshot
 * history usable: an undo replaces the whole editable, so a saved `Range` would point at detached
 * nodes. Offsets survive because the restored DOM is rendered from the same value the offsets were
 * taken against.
 */
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

    // Range.toString() concatenates the text nodes it spans — the same metric locateTextOffset walks.
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
      // The entry predates any caret (e.g. the value was set before the editor was ever focused).
      range.selectNodeContents(el);
      range.collapse(false);
    }

    selection.removeAllRanges();
    selection.addRange(range);
  };

  return { readSelectionOffsets, restoreSelectionOffsets };
};

export type RichTextEditorDomHistory = ReturnType<typeof createRichTextEditorDomHistory>;
