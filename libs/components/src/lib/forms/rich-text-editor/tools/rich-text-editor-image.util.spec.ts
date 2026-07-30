import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { htmlToMarkdown, injectRenderer } from '@ethlete/core';
import '../../../../test-helpers';
import {
  injectRichTextEditorDom,
  provideRichTextEditorDom,
  RichTextEditorDom,
} from '../headless/internals/rich-text-editor-dom';
import { createImageOps } from './rich-text-editor-image.util';

describe('rich text editor image ops', () => {
  let renderer: NonNullable<ReturnType<typeof injectRenderer>>;
  let doc: Document;
  let ops: ReturnType<typeof createImageOps>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRichTextEditorDom()] });
    renderer = TestBed.runInInjectionContext(() => injectRenderer());
    doc = TestBed.inject(DOCUMENT);
    ops = createImageOps(renderer);
  });

  afterEach(() => {
    doc.body.innerHTML = '';
    doc.getSelection()?.removeAllRanges();
  });

  const setup = (html: string): { root: HTMLElement; dom: RichTextEditorDom } => {
    const root = renderer.createElement('div');
    root.contentEditable = 'true';
    root.innerHTML = html;
    renderer.appendChild(doc.body, root);

    const dom = TestBed.runInInjectionContext(() => injectRichTextEditorDom());
    dom.root.set(root);

    return { root, dom };
  };

  /** Puts the caret at a text offset inside the first text node of `node`. */
  const caretIn = (node: Node, offset: number) => {
    const selection = doc.getSelection();
    const range = doc.createRange();
    range.setStart(node, offset);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  it('inserts a placeholder that serializes to nothing', () => {
    const { root, dom } = setup('<p>Hello</p>');
    caretIn(root.firstChild!.firstChild!, 5);

    const placeholder = ops.insertPlaceholder(dom, 'Uploading image…');

    expect(placeholder).not.toBeNull();
    expect(root.querySelector('.et-rte-image-upload')).not.toBeNull();
    expect(placeholder?.getAttribute('contenteditable')).toBe('false');
    expect(placeholder?.getAttribute('aria-label')).toBe('Uploading image…');
    // The value must not change while an upload is in flight.
    expect(htmlToMarkdown(root.innerHTML)).toBe('Hello');
  });

  it('reflects and clears upload progress', () => {
    const { root, dom } = setup('<p>Hello</p>');
    caretIn(root.firstChild!.firstChild!, 5);
    const placeholder = ops.insertPlaceholder(dom, 'Uploading image…')!;

    ops.setPlaceholderProgress(placeholder, 41.6);
    expect(placeholder.getAttribute('data-progress')).toBe('42');

    ops.setPlaceholderProgress(placeholder, null);
    expect(placeholder.hasAttribute('data-progress')).toBe(false);
  });

  it('puts the placeholder on its own line and the caret on the line below it', () => {
    const { root, dom } = setup('<p>Hello</p>');
    caretIn(root.firstChild!.firstChild!, 5);

    ops.insertPlaceholder(dom, 'Uploading…');

    // Its own line after the paragraph, with an empty line after it for the caret.
    expect(root.innerHTML).toBe(
      '<p>Hello</p><span class="et-rte-image-upload" contenteditable="false" role="img" ' +
        'aria-label="Uploading…" data-state="uploading"></span><p><br></p>',
    );

    const range = doc.getSelection()!.getRangeAt(0);

    expect((range.startContainer as HTMLElement).tagName).toBe('P');
    expect(range.startContainer).toBe(root.lastElementChild);
    // And still nothing of it in the value.
    expect(htmlToMarkdown(root.innerHTML)).toBe('Hello');
  });

  it('reuses the empty line the caret is on instead of stranding it above the image', () => {
    const { root, dom } = setup('<p>Hello</p><p><br></p>');
    caretIn(root.lastElementChild!, 0);

    const placeholder = ops.insertPlaceholder(dom, 'Uploading…')!;
    ops.replacePlaceholderWithImage({ dom, placeholder, image: { src: 'https://example.com/a.png', alt: '' } });

    expect(root.innerHTML).toBe(
      '<p>Hello</p><p contenteditable="false"><img src="https://example.com/a.png" alt=""></p><p><br></p>',
    );
  });

  it('swaps the placeholder for an atomic, block-level image in its place', () => {
    const { root, dom } = setup('<p>Hello</p>');
    caretIn(root.firstChild!.firstChild!, 5);
    const placeholder = ops.insertPlaceholder(dom, 'Uploading…')!;

    const image = ops.replacePlaceholderWithImage({
      dom,
      placeholder,
      image: { src: 'https://example.com/a.png', alt: 'A' },
    });

    expect(image).not.toBeNull();
    // `contenteditable="false"` is what keeps the caret from landing beside the image.
    expect(root.innerHTML).toBe(
      '<p>Hello</p><p contenteditable="false"><img src="https://example.com/a.png" alt="A"></p><p><br></p>',
    );
    // Neither the attribute nor the trailing empty line reaches the value.
    expect(htmlToMarkdown(root.innerHTML)).toBe('Hello\n\n![A](https://example.com/a.png)');
  });

  describe('normalizeImages', () => {
    it('makes a rendered image block atomic and keeps a line after a trailing image', () => {
      const { root } = setup('<p>Text</p><p><img src="https://example.com/a.png" alt=""></p>');

      ops.normalizeImages(root);

      expect(root.innerHTML).toBe(
        '<p>Text</p><p contenteditable="false"><img src="https://example.com/a.png" alt=""></p><p><br></p>',
      );
      expect(htmlToMarkdown(root.innerHTML)).toBe('Text\n\n![](https://example.com/a.png)');
    });

    it('leaves an image among text editable — that is prose, not an atom', () => {
      const { root } = setup('<p>See <img src="https://example.com/a.png" alt=""> here</p>');

      ops.normalizeImages(root);

      expect(root.innerHTML).toBe('<p>See <img src="https://example.com/a.png" alt=""> here</p>');
    });

    it('is idempotent', () => {
      const { root } = setup('<p><img src="https://example.com/a.png" alt=""></p>');

      ops.normalizeImages(root);
      const once = root.innerHTML;
      ops.normalizeImages(root);

      expect(root.innerHTML).toBe(once);
    });
  });

  it('refuses to place an image once the placeholder is gone', () => {
    const { root, dom } = setup('<p>Hello</p>');
    caretIn(root.firstChild!.firstChild!, 5);
    const placeholder = ops.insertPlaceholder(dom, 'Uploading…')!;

    ops.removePlaceholder(placeholder);

    expect(
      ops.replacePlaceholderWithImage({ dom, placeholder, image: { src: 'https://example.com/a.png', alt: '' } }),
    ).toBeNull();
    // The line the caret was moved to stays — the user has been typing on it since.
    expect(root.innerHTML).toBe('<p>Hello</p><p><br></p>');
  });

  it('reads the image a selection sits on, and edits its alt text', () => {
    const { root, dom } = setup('<p><img src="https://example.com/a.png" alt="Before"></p>');
    const paragraph = root.firstChild as HTMLElement;
    const selection = doc.getSelection();
    const range = doc.createRange();
    // A clicked image is selected as a whole node — the shape `readActiveImage` has to recognize.
    range.selectNode(paragraph.firstChild!);
    selection?.removeAllRanges();
    selection?.addRange(range);

    const active = ops.readActiveImage(dom);

    expect(active?.src).toBe('https://example.com/a.png');
    expect(active?.alt).toBe('Before');

    ops.applyAlt(active!.element, 'After');

    expect(htmlToMarkdown(root.innerHTML)).toBe('![After](https://example.com/a.png)');
  });

  it('reports no active image when the caret is in plain text', () => {
    const { root, dom } = setup('<p>Hello</p>');
    caretIn(root.firstChild!.firstChild!, 2);

    expect(ops.readActiveImage(dom)).toBeNull();
  });

  it('removes an image together with the paragraph it was alone in', () => {
    const { root, dom } = setup('<p>Text</p><p><img src="https://example.com/a.png" alt=""></p>');
    const image = root.querySelectorAll('img')[0] as HTMLImageElement;

    ops.removeImage(dom, image);

    expect(root.innerHTML).toBe('<p>Text</p>');
  });

  it('keeps a paragraph that holds more than the removed image', () => {
    const { root, dom } = setup('<p>Text <img src="https://example.com/a.png" alt=""></p>');
    const image = root.querySelectorAll('img')[0] as HTMLImageElement;

    ops.removeImage(dom, image);

    expect(root.innerHTML).toBe('<p>Text </p>');
  });
});
