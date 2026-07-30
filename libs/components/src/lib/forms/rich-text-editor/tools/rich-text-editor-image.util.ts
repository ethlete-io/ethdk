import { injectRenderer } from '@ethlete/core';
import { RichTextEditorDom } from '../headless/internals/rich-text-editor-dom';

/** The Ethlete renderer wrapper returned by `injectRenderer()`. */
type EditorRenderer = NonNullable<ReturnType<typeof injectRenderer>>;

/** Class on the transient upload placeholder. Also the CSS hook — see `rich-text-editor.component.css`. */
export const RICH_TEXT_EDITOR_IMAGE_PLACEHOLDER_CLASS = 'et-rte-image-upload';

/** The image at the caret, as the alt editor needs it. */
export type RichTextEditorActiveImage = {
  element: HTMLImageElement;
  src: string;
  alt: string;
};

/** Whether a block holds nothing but (at most) the line break that gives an empty line its box. */
const isBlockEmpty = (block: HTMLElement) =>
  !block.textContent?.trim() && Array.from(block.children).every((child) => child.tagName === 'BR');

/**
 * Whether a block is an image and nothing else — the shape `![alt](url)` renders to, and the one the
 * editor treats as an atom. A paragraph with an image *among text* is ordinary editable prose.
 */
const isImageBlock = (block: Element): block is HTMLElement =>
  block.tagName === 'P' &&
  !block.textContent?.trim() &&
  block.children.length === 1 &&
  block.children[0]?.tagName === 'IMG';

/**
 * Every image inside the editor. Walked by hand rather than queried: the editable's content is not
 * Angular's to know about, and the DOM-query lint rule (rightly) points at view queries for anything
 * that is.
 */
const imagesIn = (node: Element, found: HTMLImageElement[] = []): HTMLImageElement[] => {
  for (const child of Array.from(node.children)) {
    if (child instanceof HTMLImageElement) found.push(child);
    else imagesIn(child, found);
  }

  return found;
};

/** The root-level node `node` lives in, or `null` when it *is* the root (an empty editor). */
const rootLevelBlockOf = (root: HTMLElement, node: Node): HTMLElement | null => {
  let current: Node | null = node;

  while (current && current !== root && current.parentNode !== root) current = current.parentNode;

  return current && current !== root && current instanceof HTMLElement ? current : null;
};

/** Resolves the node a range boundary points at, which for `(element, offset)` is that child. */
const nodeAtBoundary = (container: Node, offset: number): Node => {
  if (container instanceof Text) return container;

  return container.childNodes[offset] ?? container.childNodes[Math.max(0, offset - 1)] ?? container;
};

/**
 * DOM operations for the opt-in image tool: the upload placeholder, inserting the finished image as
 * its own block, and reading/editing/removing the image at the caret.
 *
 * The placeholder is deliberately **text-free** — an element with no text content serializes to
 * nothing, so an upload in flight leaves the editor's Markdown value untouched (and out of the undo
 * history). Everything it shows — spinner, progress, failure — is CSS on its attributes.
 */
export const createImageOps = (renderer: EditorRenderer) => {
  /**
   * Puts the placeholder on a line of its own after the block the caret sits in, and moves the caret
   * to the line below it — so writing continues under the image from the moment the upload starts,
   * not once it lands. Returns it, or `null` when there is nowhere to insert.
   *
   * A `<span>` (styled `display: block`), not a real block element: `<p>`/`<div>` would serialize as a
   * paragraph boundary, and this has to serialize as nothing at all.
   */
  const insertPlaceholder = (dom: RichTextEditorDom, label: string): HTMLElement | null => {
    const root = dom.root();

    if (!root || !dom.ensureCaret()) return null;

    const editable = dom.getSelection();

    if (!editable) return null;

    const placeholder = renderer.createElement('span') as HTMLElement;

    renderer.addClass(placeholder, RICH_TEXT_EDITOR_IMAGE_PLACEHOLDER_CLASS);
    renderer.setAttribute(placeholder, 'contenteditable', 'false');
    renderer.setAttribute(placeholder, 'role', 'img');
    renderer.setAttribute(placeholder, 'aria-label', label);
    renderer.setAttribute(placeholder, 'data-state', 'uploading');

    if (!editable.range.collapsed) editable.range.deleteContents();

    const host = rootLevelBlockOf(root, editable.range.startContainer);

    if (host && isBlockEmpty(host)) {
      // The caret is on an empty line: put the placeholder above it and let that line be the one
      // below the image, instead of leaving a blank line stranded over it.
      renderer.insertBefore(root, placeholder, host);
    } else if (host) {
      renderer.insertBefore(root, placeholder, host.nextSibling);
    } else {
      // An empty editor has no block to sit after.
      dom.insertToken(placeholder);
    }

    placeCaretIn(ensureLineAfter(root, placeholder));

    return placeholder;
  };

  /** Reflects upload progress on the placeholder. `null` keeps it indeterminate. */
  const setPlaceholderProgress = (placeholder: HTMLElement, percentage: number | null) => {
    if (percentage === null) {
      renderer.removeAttribute(placeholder, 'data-progress');

      return;
    }

    renderer.setAttribute(placeholder, 'data-progress', `${Math.round(percentage)}`);
    renderer.setCssProperty(placeholder, '--_et-rte-image-progress', `${Math.round(percentage)}%`);
  };

  const removePlaceholder = (placeholder: HTMLElement) => {
    const parent = placeholder.parentNode;

    if (parent) renderer.removeChild(parent, placeholder);
  };

  /** Puts the caret at the start of `block`. */
  const placeCaretIn = (block: HTMLElement) => {
    const doc = block.ownerDocument;
    const selection = doc.getSelection();

    if (!selection) return;

    const range = doc.createRange();
    range.setStart(block, 0);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  /**
   * The editable line after `block`, reusing an empty one that already follows. An image block is not
   * editable, so without this there would be nowhere to put the caret — and no way to keep writing
   * when the image is the last thing in the document.
   */
  const ensureLineAfter = (root: HTMLElement, block: Element): HTMLElement => {
    const next = block.nextElementSibling;

    if (next instanceof HTMLElement && next.tagName === 'P' && !isImageBlock(next) && isBlockEmpty(next)) {
      return next;
    }

    const paragraph = renderer.createElement('p') as HTMLElement;

    // The line break gives the empty paragraph a line box, so the caret has somewhere to sit.
    renderer.appendChild(paragraph, renderer.createElement('br'));
    renderer.insertBefore(root, paragraph, block.nextSibling);

    return paragraph;
  };

  /**
   * Makes every image block an atom: `contenteditable="false"`, so a tap can no longer land the caret
   * beside the image (a position that reads as a line of text the image happens to be in, and that
   * typing would break the block out of), and an editable line after a trailing image so the document
   * never ends on something that cannot be typed after.
   *
   * Runs on every render and every value sync — both are value-neutral: `htmlToMarkdown` drops the
   * attribute, and an empty trailing paragraph serializes to nothing.
   */
  const normalizeImages = (root: HTMLElement) => {
    for (const image of imagesIn(root)) {
      const block = image.parentElement;

      if (block && block !== root && isImageBlock(block)) {
        renderer.setAttribute(block, 'contenteditable', 'false');
      }
    }

    const last = root.lastElementChild;

    if (last && isImageBlock(last)) ensureLineAfter(root, last);
  };

  /**
   * Swaps the placeholder for the uploaded image, in the exact place it was holding — the
   * `<p><img></p>` shape `markdownToHtml` produces for `![alt](url)`, so a re-render keeps what was
   * inserted. The caret is deliberately left where it is: it moved below the placeholder when the
   * upload started, and by now the user may be typing somewhere else entirely.
   *
   * Returns the image, or `null` when the placeholder is gone (an undo or an external value write
   * replaced the content while the upload was in flight).
   */
  const replacePlaceholderWithImage = ({
    dom,
    placeholder,
    image,
  }: {
    dom: RichTextEditorDom;
    placeholder: HTMLElement;
    image: { src: string; alt: string };
  }): HTMLImageElement | null => {
    const root = dom.root();

    if (!root || !root.contains(placeholder)) return null;

    const paragraph = renderer.createElement('p') as HTMLElement;
    const img = renderer.createElement('img') as HTMLImageElement;

    renderer.setAttribute(img, 'src', image.src);
    renderer.setAttribute(img, 'alt', image.alt);
    renderer.appendChild(paragraph, img);

    const anchor = placeholder.nextSibling;

    removePlaceholder(placeholder);
    renderer.insertBefore(root, paragraph, anchor);
    renderer.setAttribute(paragraph, 'contenteditable', 'false');

    // Keeps the "an image never ends the document" rule when the placeholder was the last thing.
    normalizeImages(root);

    return img;
  };

  /** The image the caret sits on (a clicked image is selected, so it is the boundary's own node). */
  const readActiveImage = (dom: RichTextEditorDom): RichTextEditorActiveImage | null => {
    const editable = dom.getSelection();

    if (!editable) return null;

    const { range } = editable;
    const candidates = [
      nodeAtBoundary(range.startContainer, range.startOffset),
      nodeAtBoundary(range.endContainer, range.endOffset),
    ];

    const element = candidates.find((node): node is HTMLImageElement => node instanceof HTMLImageElement) ?? null;

    if (!element) return null;

    return { element, src: element.getAttribute('src') ?? '', alt: element.getAttribute('alt') ?? '' };
  };

  const applyAlt = (image: HTMLImageElement, alt: string) => {
    renderer.setAttribute(image, 'alt', alt);
  };

  /** Removes the image, and the block it was alone in — an empty paragraph is not what was meant. */
  const removeImage = (dom: RichTextEditorDom, image: HTMLImageElement) => {
    const root = dom.root();
    const block = image.parentElement;

    if (image.parentNode) renderer.removeChild(image.parentNode, image);

    if (root && block && block !== root && isBlockEmpty(block) && block.parentNode) {
      renderer.removeChild(block.parentNode, block);
    }
  };

  return {
    insertPlaceholder,
    setPlaceholderProgress,
    removePlaceholder,
    replacePlaceholderWithImage,
    normalizeImages,
    readActiveImage,
    applyAlt,
    removeImage,
  };
};

export type RichTextEditorImageOps = ReturnType<typeof createImageOps>;
