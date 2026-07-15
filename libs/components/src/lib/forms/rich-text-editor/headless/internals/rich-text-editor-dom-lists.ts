import { RichTextEditorDomCore, ListTag } from './rich-text-editor-dom-core';

/**
 * Bulleted/numbered list handling: toggling (including type switching and cross-block wrapping),
 * Tab/Shift+Tab nesting, and the empty-item exit used by Enter/Backspace.
 */
export const createRichTextEditorLists = (core: RichTextEditorDomCore) => {
  const {
    doc,
    renderer,
    root,
    getSelection,
    closestWithin,
    selectNodeContents,
    selectAcross,
    collapseInto,
    replaceWith,
    childrenByTag,
    blocksInRange,
  } = core;

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

  return { toggleList, indentListItem, outdentListItem, exitListItem, mergeParagraphIntoPreviousList };
};

export type RichTextEditorDomLists = ReturnType<typeof createRichTextEditorLists>;
