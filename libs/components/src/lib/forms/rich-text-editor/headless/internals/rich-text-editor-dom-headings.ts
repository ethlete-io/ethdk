import { BLOCK_SELECTOR, HEADING_SELECTOR, RichTextEditorDomCore, HeadingTag } from './rich-text-editor-dom-core';

/**
 * Heading toggling (re-tagging blocks in place, preserving alignment and inline marks) and the
 * Enter-at-heading-edge behavior that starts a plain paragraph instead of continuing the heading.
 */
export const createRichTextEditorHeadings = (core: RichTextEditorDomCore) => {
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
    blocksInRange,
    isBlockEmpty,
  } = core;

  // Re-tag a block-level element in place, carrying its children (including any inline marks)
  // into the new element. Used to turn a paragraph into a heading and back.
  const replaceBlockTag = (block: HTMLElement, tag: HeadingTag | 'p'): HTMLElement => {
    const replacement = renderer.createElement(tag);

    // alignment survives the re-tag - it's the one style the editor persists on blocks
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
    // Headings can't wrap a table (and wrapping the whole table would style every cell) - a caret
    // inside one makes the heading a no-op, matching how it leaves lists untouched.
    const blocks = rawBlocks.filter((block) => !(block instanceof HTMLElement && block.tagName === 'TABLE'));

    if (rawBlocks.length > 0 && blocks.length === 0) {
      return;
    }

    // An empty editor has no block to convert - start a fresh heading with an empty line box so
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
      // A heading cannot contain list items, so leave lists untouched - the heading button is a
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
      // sitting directly under the root has no wrapping block - move it into a fresh heading in the
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

  return { toggleHeading, headingEnter };
};

export type RichTextEditorDomHeadings = ReturnType<typeof createRichTextEditorHeadings>;
