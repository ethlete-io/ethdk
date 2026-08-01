import { RichTextEditorDomCore } from './rich-text-editor-dom-core';

/**
 * Anchor handling for the link editor: reading the link at the caret, applying/updating a link
 * over the selection (guarding against nested/empty anchors), and unwrapping it again.
 */
export const createRichTextEditorLinks = (core: RichTextEditorDomCore) => {
  const {
    renderer,
    root,
    getSelection,
    closestWithin,
    collapseAfter,
    collapseAfterInline,
    unwrapElement,
    collectDescendants,
  } = core;

  /**
   * Shrinks a selection to exclude leading/trailing whitespace (a word selection often includes the
   * trailing space) so that whitespace stays outside the created anchor. The link editor trims the
   * label it emits, which would otherwise mismatch the untrimmed selection and delete the space
   * along with it.
   */
  const trimSelectionEdges = (range: Range) => {
    const text = range.toString();

    // an all-whitespace selection stays as-is (trimming from both ends would invert the range)
    if (!text.trim()) return;

    const leading = text.length - text.trimStart().length;
    const trailing = text.length - text.trimEnd().length;
    const { startContainer, startOffset, endContainer, endOffset } = range;

    if (leading && startContainer instanceof Text && startOffset + leading <= startContainer.length) {
      range.setStart(startContainer, startOffset + leading);
    }

    if (trailing && endContainer instanceof Text && endOffset - trailing >= 0) {
      range.setEnd(endContainer, endOffset - trailing);
    }
  };

  /** `_blank` links get a forced `rel="noopener noreferrer"`; clearing new-tab removes both. */
  const applyTargetRel = (anchor: HTMLElement, newTab: boolean) => {
    if (newTab) {
      renderer.setAttribute(anchor, 'target', '_blank');
      renderer.setAttribute(anchor, 'rel', 'noopener noreferrer');
    } else {
      renderer.removeAttribute(anchor, 'target');
      renderer.removeAttribute(anchor, 'rel');
    }
  };

  /** The link at the caret (for pre-filling the link editor), or the current selection as the
   *  suggested text when there is no link yet. `null` only when there's no editable selection. */
  const readActiveLink = (): { href: string; text: string; newTab: boolean; exists: boolean } | null => {
    const editable = getSelection();

    if (!editable) return null;

    const anchor = closestWithin(editable.range.startContainer, 'a');

    if (anchor) {
      return {
        href: anchor.getAttribute('href') ?? '',
        text: anchor.textContent ?? '',
        newTab: anchor.getAttribute('target') === '_blank',
        exists: true,
      };
    }

    return {
      href: '',
      text: editable.range.collapsed ? '' : editable.range.toString(),
      newTab: false,
      exists: false,
    };
  };

  const applyLink = (href: string, options: { newTab?: boolean; text?: string | null } = {}) => {
    const editable = getSelection();

    if (!editable) {
      return;
    }

    const newTab = options.newTab ?? false;
    const text = options.text ?? null;
    const el = root();
    const existing = closestWithin(editable.range.startContainer, 'a');

    // Editing an existing link: update href/target and, if the label changed, its text.
    if (existing) {
      renderer.setAttribute(existing, 'href', href);
      applyTargetRel(existing, newTab);

      if (text !== null && text !== existing.textContent) {
        existing.textContent = text;
      }

      collapseAfter(existing);

      return;
    }

    const anchor = renderer.createElement('a') as HTMLElement;
    renderer.setAttribute(anchor, 'href', href);
    applyTargetRel(anchor, newTab);

    if (!editable.range.collapsed) {
      trimSelectionEdges(editable.range);
    }

    const selectionText = editable.range.collapsed ? '' : editable.range.toString();
    const label = (text ?? selectionText).trim() || href;

    // Wrap the selection (preserving its inner marks) only when the label is unchanged; otherwise
    // - a collapsed caret, or the user edited the text - insert a fresh anchor with the given label.
    if (!editable.range.collapsed && text === selectionText) {
      try {
        editable.range.surroundContents(anchor);
      } catch {
        // The range crosses an existing <a> boundary (e.g. it starts before the anchor and ends
        // inside it) - surroundContents throws, so fall back to extract + insert. That fallback can
        // pull the whole existing anchor's content into the new one (nesting an <a> inside an <a>)
        // and, per Range.extractContents()'s spec, strand the drained original anchor as an empty
        // shell - both of which produce broken markdown (nested/empty link syntax).
        renderer.appendChild(anchor, editable.range.extractContents());
        editable.range.insertNode(anchor);
      }
    } else {
      renderer.appendChild(anchor, renderer.createText(label));
      editable.range.deleteContents();
      editable.range.insertNode(anchor);
    }

    collectDescendants(anchor, 'a').forEach((nested) => unwrapElement(nested));

    if (el) {
      collectDescendants(el, 'a')
        .filter((node) => (node.textContent ?? '').length === 0)
        .forEach((empty) => renderer.removeChild(empty.parentNode as Node, empty));

      el.normalize();
    }

    collapseAfterInline(anchor);
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

  return { applyLink, readActiveLink, removeLink };
};

export type RichTextEditorDomLinks = ReturnType<typeof createRichTextEditorLinks>;
