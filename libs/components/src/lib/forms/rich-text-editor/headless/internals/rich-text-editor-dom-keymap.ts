import { RichTextEditorDomCore } from './rich-text-editor-dom-core';
import { RichTextEditorDomFeatures } from './rich-text-editor-dom-features';
import { RichTextEditorDomLists } from './rich-text-editor-dom-lists';

/**
 * Key behaviors that need editor-schema awareness beyond the browser's contenteditable defaults:
 * Backspace on empty blocks (list exit, merge into a previous list, table-adjacent first line,
 * empty code block), Enter on empty list items / heading edges / the last line of a quote or code
 * block, newlines inside a code block, and arrow keys stepping out of inline code.
 *
 * The quote, fenced-code and heading parts only apply where those domains were provided, so every
 * one of them is read off `features` per event rather than bound up front.
 */
export const createRichTextEditorKeymap = (
  core: RichTextEditorDomCore,
  deps: {
    lists: RichTextEditorDomLists;
    features: RichTextEditorDomFeatures;
  },
) => {
  const { doc, renderer, root, getSelection, closestWithin, collapseInto, isBlockEmpty } = core;
  const { exitListItem, mergeParagraphIntoPreviousList } = deps.lists;
  const { features } = deps;

  const handleBackspace = () => {
    const editable = getSelection();

    if (!editable || !editable.range.collapsed) {
      return false;
    }

    if (features.codeBlock?.codeBlockBackspace()) {
      return true;
    }

    const node = editable.range.startContainer;
    const li = closestWithin(node, 'li');

    if (li && isBlockEmpty(li)) {
      exitListItem(li);

      return true;
    }

    const paragraph = closestWithin(node, 'p');

    if (paragraph && isBlockEmpty(paragraph)) {
      // an empty first line sitting directly above a table can't merge upward - remove it and drop
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

  /** Enter on an empty list item steps it out one nesting level (or leaves the list at the top),
   *  instead of inserting another empty item; inside a code block it inserts a newline (and on the
   *  empty last line leaves the block), on a quote's empty last line it leaves the quote, and at a
   *  heading's edge it starts a paragraph. Returns `true` when handled. */
  const handleEnter = () => {
    const editable = getSelection();

    // a code block owns Enter outright - a fence holds newlines, not blocks
    if (features.codeBlock?.codeBlockEnter()) {
      return true;
    }

    if (!editable || !editable.range.collapsed) {
      return false;
    }

    const li = closestWithin(editable.range.startContainer, 'li');

    if (li && isBlockEmpty(li)) {
      exitListItem(li);

      return true;
    }

    return (features.blockquote?.blockquoteEnter() || features.headings?.headingEnter()) ?? false;
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

    // inline code only - leave fenced code blocks (`<pre><code>`) alone
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

    // Just moving the caret past the code's boundary doesn't stick - the browser snaps it back
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

  return { handleBackspace, handleEnter, codeExit };
};

export type RichTextEditorDomKeymap = ReturnType<typeof createRichTextEditorKeymap>;
