import { BLOCK_SELECTOR, HEADING_SELECTOR, RichTextEditorDomCore, HeadingTag } from './rich-text-editor-dom-core';

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

  const replaceBlockTag = (block: HTMLElement, tag: HeadingTag | 'p'): HTMLElement => {
    const replacement = renderer.createElement(tag);

    // Alignment is the one style the editor persists on blocks, so it has to survive the re-tag.
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
    const blocks = rawBlocks.filter((block) => !(block instanceof HTMLElement && block.tagName === 'TABLE'));

    if (rawBlocks.length > 0 && blocks.length === 0) {
      return;
    }

    if (blocks.length === 0) {
      const heading = renderer.createElement(tag);
      renderer.appendChild(heading, renderer.createElement('br'));
      renderer.appendChild(el, heading);
      collapseInto(heading, 0);

      return;
    }

    const produced: Node[] = [];

    blocks.forEach((block) => {
      // A heading cannot contain list items, so a selected list is left untouched.
      if (block instanceof HTMLElement && (block.tagName === 'UL' || block.tagName === 'OL')) {
        produced.push(block);

        return;
      }

      if (block instanceof HTMLElement && block.matches(HEADING_SELECTOR)) {
        produced.push(replaceBlockTag(block, block.tagName.toLowerCase() === tag ? 'p' : tag));

        return;
      }

      if (block instanceof HTMLElement && block.matches(BLOCK_SELECTOR)) {
        produced.push(replaceBlockTag(block, tag));

        return;
      }

      // A bare text node or inline element directly under the root has no wrapping block, so it must
      // be moved into a fresh heading rather than re-tagged, which would drop its inline markup.
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
