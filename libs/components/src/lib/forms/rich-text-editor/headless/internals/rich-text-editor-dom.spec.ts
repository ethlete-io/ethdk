import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { injectRenderer } from '@ethlete/core';
import '../../../../../test-helpers';
import { injectRichTextEditorDom, provideRichTextEditorDom, RichTextEditorDom } from './rich-text-editor-dom';

describe('RichTextEditorDom', () => {
  let renderer: NonNullable<ReturnType<typeof injectRenderer>>;
  let doc: Document;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRichTextEditorDom()] });
    renderer = TestBed.runInInjectionContext(() => injectRenderer());
    doc = TestBed.inject(DOCUMENT);
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

  const select = (start: Node, startOffset: number, end: Node, endOffset: number) => {
    const selection = doc.getSelection();
    const range = doc.createRange();
    range.setStart(start, startOffset);
    range.setEnd(end, endOffset);
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  // Selects by plain-text character offsets regardless of how many marks currently wrap the
  // text — approximates a user re-dragging a selection over content that already has formatting.
  const selectByTextOffsets = (root: HTMLElement, startOffset: number, endOffset: number) => {
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let pos = 0;
    let startNode: Node | null = null;
    let startNodeOffset = 0;
    let endNode: Node | null = null;
    let endNodeOffset = 0;
    let node: Node | null;

    while ((node = walker.nextNode())) {
      const len = (node.textContent ?? '').length;

      if (!startNode && pos + len >= startOffset) {
        startNode = node;
        startNodeOffset = startOffset - pos;
      }

      if (!endNode && pos + len >= endOffset) {
        endNode = node;
        endNodeOffset = endOffset - pos;
      }

      pos += len;
    }

    if (startNode && endNode) {
      select(startNode, startNodeOffset, endNode, endNodeOffset);
    }
  };

  describe('toggleInline', () => {
    it('wraps a plain selection in the tag', () => {
      const { root, dom } = setup('hello world');
      select(root.firstChild as Node, 0, root.firstChild as Node, 5);

      dom.toggleInline('strong');

      expect(root.innerHTML).toBe('<strong>hello</strong> world');
    });

    it('uses em and del for italic and strikethrough', () => {
      const italic = setup('hello');
      select(italic.root.firstChild as Node, 0, italic.root.firstChild as Node, 5);
      italic.dom.toggleInline('em');
      expect(italic.root.innerHTML).toBe('<em>hello</em>');

      const strike = setup('bye');
      select(strike.root.firstChild as Node, 0, strike.root.firstChild as Node, 3);
      strike.dom.toggleInline('del');
      expect(strike.root.innerHTML).toBe('<del>bye</del>');
    });

    it('unwraps when the whole selection is already marked', () => {
      const { root, dom } = setup('<strong>hello</strong> world');
      const strong = root.firstChild as Node;
      select(strong.firstChild as Node, 0, strong.firstChild as Node, 5);

      dom.toggleInline('strong');

      expect(root.innerHTML).not.toContain('<strong>');
      expect(root.textContent).toBe('hello world');
    });

    it('unwraps only the selected portion of a marked element', () => {
      const { root, dom } = setup('<strong>hello</strong> world');
      const strong = root.firstChild as Node;
      select(strong.firstChild as Node, 0, strong.firstChild as Node, 2);

      dom.toggleInline('strong');

      expect(root.innerHTML).toBe('he<strong>llo</strong> world');
    });

    it('is a no-op for a collapsed selection', () => {
      const { root, dom } = setup('hello');
      select(root.firstChild as Node, 2, root.firstChild as Node, 2);

      dom.toggleInline('em');

      expect(root.innerHTML).toBe('hello');
    });

    it('keeps nested marks when the outermost mark is toggled off', () => {
      const { root, dom } = setup('<strong><em><del>First item</del></em></strong>');
      const del = root.querySelector('del') as HTMLElement;
      const text = del.firstChild as Text;

      select(text, 0, text, text.length);

      dom.toggleInline('strong');

      expect(root.innerHTML).toBe('<em><del>First item</del></em>');
    });

    it('preserves nested marks in the untouched before/after portions when unwrapping partially', () => {
      const { root, dom } = setup('<strong><em>abc def</em></strong>');
      const text = (root.querySelector('em') as HTMLElement).firstChild as Node;

      select(text, 4, text, 7);

      dom.toggleInline('strong');

      expect(root.innerHTML).toBe('<strong><em>abc </em></strong><em>def</em>');
    });

    it('does not strand an empty ancestor shell when a wrap range starts at the edge of another mark', () => {
      // Range.extractContents() leaves the original ancestor in place (now empty) whenever the
      // range fully drains its content — here the range starts exactly at the beginning of
      // <strong>'s text, so wrapping in <em> triggers that fallback and used to leave `<strong></strong>`.
      const { root, dom } = setup('<strong>ab</strong>cd');
      const strongText = (root.querySelector('strong') as HTMLElement).firstChild as Node;
      const cd = root.lastChild as Node;

      select(strongText, 0, cd, 1);

      dom.toggleInline('em');

      expect(root.innerHTML).toBe('<em><strong>ab</strong>c</em>d');
    });

    it('excludes trailing whitespace from a new mark', () => {
      const { root, dom } = setup('A short intro');

      // Selects "A short " — including the space before "intro" as the last character.
      select(root.firstChild as Node, 0, root.firstChild as Node, 8);

      dom.toggleInline('strong');

      expect(root.innerHTML).toBe('<strong>A short</strong> intro');
    });

    it('excludes leading whitespace from a new mark', () => {
      const { root, dom } = setup('intro A short');

      // Selects " A short" — including the space after "intro" as the first character.
      select(root.firstChild as Node, 5, root.firstChild as Node, 13);

      dom.toggleInline('strong');

      expect(root.innerHTML).toBe('intro <strong>A short</strong>');
    });

    it('is a no-op when the selection is only whitespace', () => {
      const { root, dom } = setup('A  short');
      const text = root.firstChild as Node;

      select(text, 1, text, 3);

      dom.toggleInline('strong');

      expect(root.innerHTML).toBe('A  short');
    });

    it('does not leave a whitespace-only mark behind when unwrapping a partial selection', () => {
      const { root, dom } = setup('A short intro');

      // Bold "A short " including the trailing space, exactly like a real drag selection would.
      select(root.firstChild as Node, 0, root.firstChild as Node, 8);
      dom.toggleInline('strong');
      expect(root.innerHTML).toBe('<strong>A short</strong> intro');

      // Now select just "A short" (excluding the space, which was never marked to begin with —
      // trimming above already dropped it) and remove bold.
      const strongText = (root.querySelector('strong') as HTMLElement).firstChild as Node;
      select(strongText, 0, strongText, 7);
      dom.toggleInline('strong');

      expect(root.innerHTML).toBe('A short intro');
      expect(root.innerHTML).not.toContain('<strong>');
    });

    it('drops a pre-existing trailing whitespace-only mark segment when splitting instead of re-wrapping it', () => {
      // A mark already containing trailing whitespace (e.g. from data authored elsewhere) — the
      // split for a partial unwrap must not preserve that whitespace inside its own <strong>.
      const { root, dom } = setup('<strong>A short </strong>intro');
      const text = (root.querySelector('strong') as HTMLElement).firstChild as Node;

      select(text, 0, text, 7);

      dom.toggleInline('strong');

      expect(root.innerHTML).toBe('A short intro');
    });

    it('produces clean markup with no empty shells across bold → italic → strike → remove-bold with an imprecise first selection', () => {
      const { root, dom } = setup('A short');

      // Bold only "A shor", leaving the trailing "t" out — mimics a real, slightly-off drag
      // selection — then re-select the full word (now split across the <strong> boundary) for
      // each subsequent toggle, as a user re-dragging over the already-formatted text would.
      selectByTextOffsets(root, 0, 6);
      dom.toggleInline('strong');

      selectByTextOffsets(root, 0, 7);
      dom.toggleInline('em');

      selectByTextOffsets(root, 0, 7);
      dom.toggleInline('del');

      // The trailing "t" was never bolded above, so this selection is only partially marked —
      // toggling applies the mark to the whole selection rather than removing it, per existing
      // toggle semantics. What matters here is that no empty shells or duplicate marks survive.
      selectByTextOffsets(root, 0, 7);
      dom.toggleInline('strong');

      expect(root.innerHTML).toBe('<em><del><strong>A short</strong></del></em>');
    });

    it('merges into a single element when the selection extends partway into an already-marked word', () => {
      const { root, dom } = setup('A <strong>short</strong>');
      const textA = root.firstChild as Node;
      const strongText = (root.lastChild as HTMLElement).firstChild as Node;

      // Selects "A shor", leaving the trailing "t" of the already-bold word outside the selection.
      select(textA, 0, strongText, 4);

      dom.toggleInline('strong');

      expect(root.innerHTML).toBe('<strong>A short</strong>');
    });
  });

  describe('toggleList', () => {
    it('wraps the covered paragraphs into a list', () => {
      const { root, dom } = setup('<p>one</p><p>two</p>');
      const [p1, p2] = Array.from(root.children);
      select(p1?.firstChild as Node, 0, p2?.firstChild as Node, 3);

      dom.toggleList('ul');

      expect(root.innerHTML).toBe('<ul><li>one</li><li>two</li></ul>');
    });

    it('unwraps a list back to paragraphs when toggled again', () => {
      const { root, dom } = setup('<ul><li>one</li></ul>');
      const li = (root.firstChild as Node).firstChild as Node;
      select(li.firstChild as Node, 0, li.firstChild as Node, 3);

      dom.toggleList('ul');

      expect(root.innerHTML).toBe('<p>one</p>');
    });

    it('creates an ordered list with ol', () => {
      const { root, dom } = setup('<p>one</p>');
      const p = root.firstChild as Node;
      select(p.firstChild as Node, 0, p.firstChild as Node, 3);

      dom.toggleList('ol');

      expect(root.innerHTML).toBe('<ol><li>one</li></ol>');
    });
  });

  describe('applyLink / removeLink', () => {
    it('wraps the selection in an anchor', () => {
      const { root, dom } = setup('hello');
      select(root.firstChild as Node, 0, root.firstChild as Node, 5);

      dom.applyLink('https://example.com');

      expect(root.innerHTML).toBe('<a href="https://example.com">hello</a>');
    });

    it('updates the href when the caret is already in a link', () => {
      const { root, dom } = setup('<a href="https://old.com">hello</a>');
      const anchor = root.firstChild as Node;
      select(anchor.firstChild as Node, 1, anchor.firstChild as Node, 3);

      dom.applyLink('https://new.com');

      expect(root.innerHTML).toContain('href="https://new.com"');
    });

    it('removes the link but keeps the text', () => {
      const { root, dom } = setup('<a href="https://example.com">hello</a>');
      const anchor = root.firstChild as Node;
      select(anchor.firstChild as Node, 0, anchor.firstChild as Node, 5);

      dom.removeLink();

      expect(root.innerHTML).not.toContain('<a');
      expect(root.textContent).toBe('hello');
    });

    it('replaces an existing link cleanly when linking a selection that extends beyond it', () => {
      // Range.surroundContents() throws when the range starts before an existing <a> and ends
      // inside it, so this goes through the extract+insert fallback — which used to nest the old
      // <a> inside the new one and strand the drained original as an empty <a></a> shell.
      const { root, dom } = setup('test <a href="dddd">link</a>');
      const testText = root.firstChild as Node;
      const linkText = (root.querySelector('a') as HTMLElement).firstChild as Node;

      select(testText, 0, linkText, (linkText.textContent ?? '').length);

      dom.applyLink('dddddd');

      expect(root.innerHTML).toBe('<a href="dddddd">test link</a>');
    });
  });

  describe('handleBackspace', () => {
    it('exits the list when the caret is in an empty trailing item', () => {
      const { root, dom } = setup('<ul><li>one</li><li></li></ul>');
      const emptyLi = root.firstChild?.lastChild as Node;
      select(emptyLi, 0, emptyLi, 0);

      const handled = dom.handleBackspace();

      expect(handled).toBe(true);
      // A bare `<p></p>` has no line box in a real browser and can't hold a caret, which pushed
      // it into the following line — the replacement paragraph must carry a `<br>` like a
      // browser-created empty <li> would.
      expect(root.innerHTML).toBe('<ul><li>one</li></ul><p><br></p>');
    });

    it('removes the whole list when the only item is empty', () => {
      const { root, dom } = setup('<ul><li></li></ul>');
      const emptyLi = root.firstChild?.firstChild as Node;
      select(emptyLi, 0, emptyLi, 0);

      const handled = dom.handleBackspace();

      expect(handled).toBe(true);
      expect(root.innerHTML).toBe('<p><br></p>');
    });

    it('carries over an existing <br> instead of adding a second one', () => {
      const { root, dom } = setup('<ul><li>one</li><li><br></li></ul>');
      const emptyLi = root.firstChild?.lastChild as Node;
      select(emptyLi, 0, emptyLi, 0);

      dom.handleBackspace();

      expect(root.innerHTML).toBe('<ul><li>one</li></ul><p><br></p>');
    });

    it('splits the list when the empty item is in the middle', () => {
      const { root, dom } = setup('<ul><li>one</li><li></li><li>three</li></ul>');
      const emptyLi = root.firstChild?.childNodes[1] as Node;
      select(emptyLi, 0, emptyLi, 0);

      dom.handleBackspace();

      expect(root.innerHTML).toBe('<ul><li>one</li></ul><p><br></p><ul><li>three</li></ul>');
    });

    it('merges an empty paragraph into the previous list on the next backspace', () => {
      const { root, dom } = setup('<ul><li>one</li></ul><p></p>');
      const paragraph = root.lastChild as Node;
      select(paragraph, 0, paragraph, 0);

      const handled = dom.handleBackspace();

      expect(handled).toBe(true);
      expect(root.innerHTML).toBe('<ul><li>one</li></ul>');
    });

    it('does nothing for a non-empty list item', () => {
      const { root, dom } = setup('<ul><li>one</li></ul>');
      const li = root.firstChild?.firstChild as Node;
      select(li.firstChild as Node, 0, li.firstChild as Node, 0);

      expect(dom.handleBackspace()).toBe(false);
      expect(root.innerHTML).toBe('<ul><li>one</li></ul>');
    });
  });

  describe('markStates', () => {
    it('reflects the marks at the caret', () => {
      const { root, dom } = setup('<strong>hello</strong>');
      const strong = root.firstChild as Node;
      select(strong.firstChild as Node, 1, strong.firstChild as Node, 1);

      expect(dom.markStates()?.bold).toBe(true);
      expect(dom.markStates()?.italic).toBe(false);
    });
  });
});
