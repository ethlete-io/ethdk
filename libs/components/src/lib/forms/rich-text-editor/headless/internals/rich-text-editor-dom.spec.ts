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

  describe('insertInlineText (stored marks)', () => {
    it('breaks out of a mark at a collapsed caret so the inserted text is unformatted', () => {
      const { root, dom } = setup('<strong>abc</strong>');
      const strong = root.firstChild as HTMLElement;
      const text = strong.firstChild as Node;
      select(text, 3, text, 3); // collapsed caret at the end, inside <strong>

      dom.insertInlineText('x', []);

      expect(root.innerHTML).toBe('<strong>abc</strong>x');
    });

    it('splits a mark and inserts unformatted text mid-word', () => {
      const { root, dom } = setup('<strong>abcd</strong>');
      const text = (root.firstChild as HTMLElement).firstChild as Node;
      select(text, 2, text, 2);

      dom.insertInlineText('X', []);

      expect(root.innerHTML).toBe('<strong>ab</strong>X<strong>cd</strong>');
    });

    it('wraps inserted text in the given marks at a plain collapsed caret', () => {
      const { root, dom } = setup('hi');
      const text = root.firstChild as Node;
      select(text, 2, text, 2);

      dom.insertInlineText('Q', ['strong']);

      expect(root.innerHTML).toBe('hi<strong>Q</strong>');
    });

    it('inserts a line-ending space as nbsp so the next keystroke cannot collapse it away', () => {
      // A plain trailing space at line end is CSS-collapsed and Chrome drops it on the next
      // keystroke, snapping the caret back inside the mark — the toggle-off would silently undo.
      const { root, dom } = setup('one <strong>two</strong>');
      const text = (root.querySelector('strong') as HTMLElement).firstChild as Node;
      select(text, 3, text, 3); // collapsed caret at the end, inside <strong>

      dom.insertInlineText(' ', []);

      expect(root.innerHTML).toBe('one <strong>two</strong>&nbsp;');
    });

    it('keeps a mid-line inserted space as a plain space', () => {
      const { root, dom } = setup('<strong>two</strong>rest');
      const text = (root.querySelector('strong') as HTMLElement).firstChild as Node;
      select(text, 3, text, 3);

      dom.insertInlineText(' ', []);

      expect(root.innerHTML).toBe('<strong>two</strong> rest');
    });

    it('reports the inline marks wrapping the caret', () => {
      const { root, dom } = setup('<strong><em>x</em></strong>');
      const text = (root.querySelector('em') as HTMLElement).firstChild as Node;
      select(text, 1, text, 1);

      expect(dom.activeInlineTags().sort()).toEqual(['em', 'strong']);
    });
  });

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

  describe('toggleInline across blocks', () => {
    it('wraps each list item slice separately when the selection spans items', () => {
      const { root, dom } = setup('<ul><li>one</li><li>two</li></ul>');
      const [li1, li2] = Array.from(root.querySelectorAll('li'));
      select(li1?.firstChild as Node, 0, li2?.firstChild as Node, 3);

      dom.toggleInline('em');

      expect(root.innerHTML).toBe('<ul><li><em>one</em></li><li><em>two</em></li></ul>');
    });

    it('does not create list items when the selection sweeps up an empty item', () => {
      const { root, dom } = setup('<ol><li><br></li><li>two</li><li>three</li></ol>');
      const [li1, li2] = Array.from(root.querySelectorAll('li'));
      select(li1 as Node, 0, li2?.firstChild as Node, 3);

      dom.toggleInline('em');

      expect(root.innerHTML).toBe('<ol><li><br></li><li><em>two</em></li><li>three</li></ol>');
    });

    it('reports the mark as active right after wrapping across items', () => {
      const { root, dom } = setup('<ol><li><br></li><li>two</li><li>three</li></ol>');
      const [li1, li3] = [root.querySelectorAll('li')[0], root.querySelectorAll('li')[2]];
      select(li1 as Node, 0, li3?.firstChild as Node, 5);

      dom.toggleInline('em');

      expect(dom.markStates()?.italic).toBe(true);
    });

    it('keeps reporting earlier marks after stacking a second mark across items', () => {
      const { root, dom } = setup('<ul><li>one</li><li>two</li></ul>');
      const [li1, li2] = Array.from(root.querySelectorAll('li'));
      select(li1?.firstChild as Node, 0, li2?.firstChild as Node, 3);

      dom.toggleInline('strong');
      dom.toggleInline('em');

      expect(root.innerHTML).toBe(
        '<ul><li><em><strong>one</strong></em></li><li><em><strong>two</strong></em></li></ul>',
      );
      expect(dom.markStates()?.bold).toBe(true);
      expect(dom.markStates()?.italic).toBe(true);
    });

    it('wraps each paragraph slice separately when the selection spans paragraphs', () => {
      const { root, dom } = setup('<p>one</p><p>two</p>');
      const [p1, p2] = Array.from(root.children);
      select(p1?.firstChild as Node, 0, p2?.firstChild as Node, 3);

      dom.toggleInline('strong');

      expect(root.innerHTML).toBe('<p><strong>one</strong></p><p><strong>two</strong></p>');
    });
  });

  describe('codeExit', () => {
    it('moves the caret out of inline code on ArrowRight at its end', () => {
      const { root, dom } = setup('<code>ab</code>');
      const text = root.querySelector('code')?.firstChild as Node;
      select(text, 2, text, 2); // collapsed at end, inside <code>

      expect(dom.codeExit('ArrowRight')).toBe(true);
      // caret now sits outside the code, in a following text node
      const range = doc.getSelection()!.getRangeAt(0);
      expect(dom.closestWithin(range.startContainer, 'code')).toBeNull();
    });

    it('is a no-op when the caret is not at a code boundary', () => {
      const { root, dom } = setup('<code>abc</code>');
      const text = root.querySelector('code')?.firstChild as Node;
      select(text, 1, text, 1); // middle of the code

      expect(dom.codeExit('ArrowRight')).toBe(false);
    });
  });

  describe('toggleInline across table cells', () => {
    it('wraps each cell within itself instead of tearing the table apart', () => {
      const { root, dom } = setup('<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>');
      selectByTextOffsets(root, 0, 2); // across both cells

      dom.toggleInline('strong');

      expect(root.innerHTML).toBe(
        '<table><tbody><tr><td><strong>a</strong></td><td><strong>b</strong></td></tr></tbody></table>',
      );
    });
  });

  describe('toggleHeading', () => {
    it('wraps bare inline content in the heading, preserving the mark, and a single toggle still removes it', () => {
      // bold-then-heading on unwrapped text: the <strong> must be moved INTO the <h2>, not
      // re-tagged into it (which dropped the mark), and the mark stays detectable so one toggle removes it
      const { root, dom } = setup('<strong>hello</strong>');
      const strong = root.firstChild as Node;
      select(strong.firstChild as Node, 0, strong.firstChild as Node, 5);

      dom.toggleHeading('h2');
      expect(root.innerHTML).toBe('<h2><strong>hello</strong></h2>');

      // toggleHeading left the selection on the heading's contents (block-level range); a single
      // toggleInline must still detect the nested mark and remove it
      dom.toggleInline('strong');
      expect(root.innerHTML).toBe('<h2>hello</h2>');
    });

    it('is a no-op when the caret is inside a table (never wraps the table in a heading)', () => {
      const { root, dom } = setup('<table><tbody><tr><td>x</td></tr></tbody></table>');
      const cellText = root.querySelector('td')?.firstChild as Node;
      select(cellText, 0, cellText, 1);

      dom.toggleHeading('h2');

      expect(root.innerHTML).toBe('<table><tbody><tr><td>x</td></tr></tbody></table>');
    });

    it('keeps the block alignment when re-tagging between paragraph and heading', () => {
      const { root, dom } = setup('<p style="text-align: center">middle</p>');
      const text = (root.firstChild as HTMLElement).firstChild as Node;
      select(text, 0, text, 0);

      dom.toggleHeading('h2');
      expect(root.innerHTML).toBe('<h2 style="text-align: center;">middle</h2>');

      dom.toggleHeading('h2');
      expect(root.innerHTML).toBe('<p style="text-align: center;">middle</p>');
    });

    it('re-tags an existing paragraph in place, keeping its inline children', () => {
      const { root, dom } = setup('<p>a <strong>b</strong> c</p>');
      selectByTextOffsets(root, 0, 5);

      dom.toggleHeading('h2');
      expect(root.innerHTML).toBe('<h2>a <strong>b</strong> c</h2>');
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

    it('starts a list with one empty item when the editor is empty', () => {
      const { root, dom } = setup('');
      select(root, 0, root, 0);

      dom.toggleList('ul');

      expect(root.innerHTML).toBe('<ul><li><br></li></ul>');

      const li = root.querySelector('li') as HTMLElement;
      const range = doc.getSelection()?.getRangeAt(0);
      expect(range?.collapsed).toBe(true);
      expect(li.contains(range?.startContainer ?? null)).toBe(true);
    });

    it('converts a list to the other type instead of nesting it', () => {
      const { root, dom } = setup('<ul><li>one</li><li>two</li></ul>');
      const li = root.querySelector('li') as HTMLElement;
      select(li.firstChild as Node, 0, li.firstChild as Node, 3);

      dom.toggleList('ol');

      expect(root.innerHTML).toBe('<ol><li>one</li><li>two</li></ol>');
    });

    it('toggles an empty-editor list back and forth without nesting items', () => {
      const { root, dom } = setup('');
      select(root, 0, root, 0);

      dom.toggleList('ul');
      dom.toggleList('ol');
      dom.toggleList('ul');

      expect(root.innerHTML).toBe('<ul><li><br></li></ul>');
    });

    it('hoists the items of a covered list when the selection also spans a paragraph', () => {
      const { root, dom } = setup('<p>one</p><ol><li>two</li></ol>');
      const p = root.querySelector('p') as HTMLElement;
      const li = root.querySelector('li') as HTMLElement;
      select(p.firstChild as Node, 0, li.firstChild as Node, 3);

      dom.toggleList('ul');

      expect(root.innerHTML).toBe('<ul><li>one</li><li>two</li></ul>');
    });

    it('is a no-op when the caret is inside a table (never nests the table in a list)', () => {
      const html = '<table><tbody><tr><td>cell</td></tr></tbody></table>';
      const { root, dom } = setup(html);
      const cellText = (root.querySelector('td') as HTMLElement).firstChild as Node;
      select(cellText, 1, cellText, 1);

      dom.toggleList('ul');

      expect(root.innerHTML).toBe(html);
    });

    it('marks the list state active after starting a list in an empty editor', () => {
      const { root, dom } = setup('');
      select(root, 0, root, 0);

      dom.toggleList('ol');

      expect(dom.markStates()?.orderedList).toBe(true);
    });
  });

  describe('toggleBlockquote', () => {
    it('quotes the covered paragraphs as one quote, a line each', () => {
      const { root, dom } = setup('<p>one</p><p>two</p>');
      const [p1, p2] = Array.from(root.children);
      select(p1?.firstChild as Node, 0, p2?.firstChild as Node, 3);

      dom.toggleBlockquote();

      expect(root.innerHTML).toBe('<blockquote>one<br>two</blockquote>');
    });

    it('lifts a quote back to paragraphs when toggled again, splitting on its line breaks', () => {
      const { root, dom } = setup('<blockquote>one<br>two</blockquote>');
      const quote = root.firstChild as HTMLElement;
      select(quote.firstChild as Node, 0, quote.firstChild as Node, 3);

      dom.toggleBlockquote();

      expect(root.innerHTML).toBe('<p>one</p><p>two</p>');
    });

    it('starts an empty quote with a line box when the editor is empty', () => {
      const { root, dom } = setup('');
      select(root, 0, root, 0);

      dom.toggleBlockquote();

      expect(root.innerHTML).toBe('<blockquote><br></blockquote>');
    });

    it('leaves a list or table alone', () => {
      const { root, dom } = setup('<ul><li>one</li></ul>');
      const li = root.querySelector('li') as HTMLElement;
      select(li.firstChild as Node, 0, li.firstChild as Node, 3);

      dom.toggleBlockquote();

      expect(root.innerHTML).toBe('<ul><li>one</li></ul>');
    });

    it('nests and un-nests a quote with indent/outdent', () => {
      const { root, dom } = setup('<blockquote>one</blockquote>');
      const quote = root.firstChild as HTMLElement;
      select(quote.firstChild as Node, 1, quote.firstChild as Node, 1);

      expect(dom.indentBlockquote()).toBe(true);
      expect(root.innerHTML).toBe('<blockquote><blockquote>one</blockquote></blockquote>');

      expect(dom.outdentBlockquote()).toBe(true);
      expect(root.innerHTML).toBe('<blockquote>one</blockquote>');
    });

    it('outdents out of the quote entirely at the top level', () => {
      const { root, dom } = setup('<blockquote>one</blockquote>');
      const quote = root.firstChild as HTMLElement;
      select(quote.firstChild as Node, 1, quote.firstChild as Node, 1);

      expect(dom.outdentBlockquote()).toBe(true);
      expect(root.innerHTML).toBe('<p>one</p>');
    });

    it('keeps the lines above when lifting a nested quote', () => {
      const { root, dom } = setup('<blockquote>one<br><blockquote>two</blockquote></blockquote>');
      const inner = root.querySelector('blockquote blockquote') as HTMLElement;
      select(inner.firstChild as Node, 1, inner.firstChild as Node, 1);

      expect(dom.outdentBlockquote()).toBe(true);
      expect(root.innerHTML).toBe('<blockquote>one<br>two</blockquote>');
    });

    it('breaks the line inside the quote on Enter instead of splitting it in two', () => {
      const { root, dom } = setup('<blockquote>one</blockquote>');
      const quote = root.firstChild as HTMLElement;
      select(quote.firstChild as Node, 2, quote.firstChild as Node, 2);

      expect(dom.handleEnter()).toBe(true);
      expect(root.innerHTML).toBe('<blockquote>on<br>e</blockquote>');
      expect(root.querySelectorAll('blockquote').length).toBe(1);
    });

    it('leaves the quote on a second Enter, once the last line is empty', () => {
      const { root, dom } = setup('<blockquote>one</blockquote>');
      const quote = root.firstChild as HTMLElement;
      select(quote.firstChild as Node, 3, quote.firstChild as Node, 3);

      // the first Enter opens an empty last line (with the trailing break that gives it a line box)
      expect(dom.handleEnter()).toBe(true);
      expect(root.innerHTML).toBe('<blockquote>one<br><br></blockquote>');

      expect(dom.handleEnter()).toBe(true);
      expect(root.innerHTML).toBe('<blockquote>one</blockquote><p><br></p>');
    });

    it('takes an emptied quote with it when leaving', () => {
      const { root, dom } = setup('<blockquote><br></blockquote>');
      const quote = root.firstChild as HTMLElement;
      select(quote, 0, quote, 0);

      expect(dom.handleEnter()).toBe(true);
      expect(root.innerHTML).toBe('<p><br></p>');
    });

    it('turns a code block the browser emptied back into a paragraph', () => {
      // what Chrome leaves behind when the whole content of a code block is selected and deleted
      const { root, dom } = setup('<pre><br></pre>');
      const pre = root.firstChild as HTMLElement;
      select(pre, 0, pre, 0);

      expect(dom.repairCodeBlock()).toBe(true);
      expect(root.innerHTML).toBe('<p><br></p>');
    });
  });

  describe('toggleCodeBlock', () => {
    it('turns the covered blocks into one fenced block of plain text', () => {
      const { root, dom } = setup('<p>one</p><p><strong>two</strong></p>');
      const [p1, p2] = Array.from(root.children);
      select(p1?.firstChild as Node, 0, p2?.firstChild as Node, 1);

      dom.toggleCodeBlock();

      expect(root.innerHTML).toBe('<pre><code>one\ntwo</code></pre>');
    });

    it('turns a code block back into a paragraph per line', () => {
      const { root, dom } = setup('<pre><code>one\ntwo</code></pre>');
      const code = root.querySelector('code') as HTMLElement;
      select(code.firstChild as Node, 0, code.firstChild as Node, 3);

      dom.toggleCodeBlock();

      expect(root.innerHTML).toBe('<p>one</p><p>two</p>');
    });

    it('starts an empty code block with a newline so the caret has a line', () => {
      const { root, dom } = setup('');
      select(root, 0, root, 0);

      dom.toggleCodeBlock();

      expect(root.innerHTML).toBe('<pre><code>\n</code></pre>');
    });

    it('inserts a newline on Enter instead of a new block', () => {
      const { root, dom } = setup('<pre><code>one</code></pre>');
      const code = root.querySelector('code') as HTMLElement;
      select(code.firstChild as Node, 3, code.firstChild as Node, 3);

      expect(dom.handleEnter()).toBe(true);
      expect((root.querySelector('code') as HTMLElement).textContent).toBe('one\n\n');
      expect(root.querySelector('p')).toBeNull();
    });

    it('leaves the code block on Enter when the last line is already empty', () => {
      const { root, dom } = setup('<pre><code>one\n\n</code></pre>');
      const code = root.querySelector('code') as HTMLElement;
      select(code.firstChild as Node, 5, code.firstChild as Node, 5);

      expect(dom.handleEnter()).toBe(true);
      expect(root.innerHTML).toBe('<pre><code>one</code></pre><p><br></p>');
    });

    it('leaves the code block on a second Enter, from where the first one left the caret', () => {
      const { root, dom } = setup('<pre><code>one</code></pre>');
      const code = root.querySelector('code') as HTMLElement;
      select(code.firstChild as Node, 3, code.firstChild as Node, 3);

      // the first Enter opens the empty last line; the caret sits *between* the two newlines, since
      // the trailing one is what gives that line a line box
      expect(dom.handleEnter()).toBe(true);

      expect(dom.handleEnter()).toBe(true);
      expect(root.innerHTML).toBe('<pre><code>one</code></pre><p><br></p>');
    });

    it('creates a paragraph on ArrowDown off the last line of a trailing code block', () => {
      const { root, dom } = setup('<pre><code>one\ntwo</code></pre>');
      const code = root.querySelector('code') as HTMLElement;
      select(code.firstChild as Node, 7, code.firstChild as Node, 7);

      expect(dom.codeBlockArrowDown()).toBe(true);
      expect(root.innerHTML).toBe('<pre><code>one\ntwo</code></pre><p><br></p>');
    });

    it('leaves ArrowDown alone above the last line, or with a block already after', () => {
      const { root, dom } = setup('<pre><code>one\ntwo</code></pre>');
      const code = root.querySelector('code') as HTMLElement;
      select(code.firstChild as Node, 3, code.firstChild as Node, 3);

      expect(dom.codeBlockArrowDown()).toBe(false);

      const { root: root2, dom: dom2 } = setup('<pre><code>one</code></pre><p>after</p>');
      const code2 = root2.querySelector('code') as HTMLElement;
      select(code2.firstChild as Node, 3, code2.firstChild as Node, 3);

      expect(dom2.codeBlockArrowDown()).toBe(false);
      expect(root.querySelectorAll('p').length).toBe(0);
    });

    it('removes an empty code block on Backspace', () => {
      const { root, dom } = setup('<pre><code>\n</code></pre>');
      const code = root.querySelector('code') as HTMLElement;
      select(code.firstChild as Node, 0, code.firstChild as Node, 0);

      expect(dom.handleBackspace()).toBe(true);
      expect(root.innerHTML).toBe('<p><br></p>');
    });

    it('exits to a paragraph after the block', () => {
      const { root, dom } = setup('<pre><code>one</code></pre>');
      const code = root.querySelector('code') as HTMLElement;
      select(code.firstChild as Node, 1, code.firstChild as Node, 1);

      expect(dom.exitCodeBlock()).toBe(true);
      expect(root.innerHTML).toBe('<pre><code>one</code></pre><p><br></p>');
    });

    it('reports the code-block context without reporting inline code', () => {
      const { root, dom } = setup('<pre><code>one</code></pre>');
      const code = root.querySelector('code') as HTMLElement;
      select(code.firstChild as Node, 1, code.firstChild as Node, 1);

      expect(dom.markStates()?.codeBlock).toBe(true);
      expect(dom.markStates()?.code).toBe(false);
      expect(root.querySelector('pre')).not.toBeNull();
    });
  });

  describe('applyLink / removeLink', () => {
    it('wraps the selection in an anchor', () => {
      const { root, dom } = setup('hello');
      select(root.firstChild as Node, 0, root.firstChild as Node, 5);

      dom.applyLink('https://example.com');

      // a link that ends the line gets a trailing space so the caret can continue after it — a
      // no-break one, since a plain space at line end is CSS-collapsed and Chrome drops it from
      // the text node on the next keystroke
      expect(root.innerHTML).toBe('<a href="https://example.com">hello</a>&nbsp;');
    });

    it('does not add a trailing space when the link is mid-line', () => {
      const { root, dom } = setup('one two three');
      const text = root.firstChild as Node;
      // select "two"
      select(text, 4, text, 7);

      dom.applyLink('https://example.com');

      expect(root.innerHTML).toBe('one <a href="https://example.com">two</a> three');
    });

    it('keeps whitespace at the selection edges outside the anchor', () => {
      const { root, dom } = setup('hello world');
      const text = root.firstChild as Node;
      // select "hello " — a word selection often includes the trailing space
      select(text, 0, text, 6);

      dom.applyLink('https://example.com');

      expect(root.innerHTML).toBe('<a href="https://example.com">hello</a> world');
    });

    it('keeps whitespace outside the anchor when the popover provides a trimmed label', () => {
      const { root, dom } = setup('hello world');
      const text = root.firstChild as Node;
      select(text, 0, text, 6); // "hello " — the link editor trims the label it emits

      dom.applyLink('https://example.com', { text: 'hello' });

      expect(root.innerHTML).toBe('<a href="https://example.com">hello</a> world');
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

      expect(root.innerHTML).toBe('<a href="dddddd">test link</a>&nbsp;');
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

    it('reports whether the caret sits inside a table cell', () => {
      const { root, dom } = setup('<p>out</p><table><tbody><tr><td>in</td></tr></tbody></table>');
      const cellText = (root.querySelector('td') as HTMLElement).firstChild as Node;

      select(cellText, 1, cellText, 1);
      expect(dom.markStates()?.tableCell).toBe(true);

      const paragraphText = (root.firstChild as HTMLElement).firstChild as Node;

      select(paragraphText, 1, paragraphText, 1);
      expect(dom.markStates()?.tableCell).toBe(false);
    });
  });

  describe('handleEnter on a heading', () => {
    it('starts a paragraph after the heading when the caret is at its end', () => {
      const { root, dom } = setup('<h2>title</h2>');
      const text = (root.firstChild as HTMLElement).firstChild as Node;
      select(text, 5, text, 5);

      expect(dom.handleEnter()).toBe(true);
      expect(root.innerHTML).toBe('<h2>title</h2><p><br></p>');

      const range = doc.getSelection()?.getRangeAt(0);
      expect(dom.closestWithin(range?.startContainer ?? null, 'p')).not.toBeNull();
    });

    it('inserts an empty paragraph above when the caret is at the heading start', () => {
      const { root, dom } = setup('<h2>title</h2>');
      const text = (root.firstChild as HTMLElement).firstChild as Node;
      select(text, 0, text, 0);

      expect(dom.handleEnter()).toBe(true);
      expect(root.innerHTML).toBe('<p><br></p><h2>title</h2>');
    });

    it('lets the browser split the heading on a mid-heading Enter', () => {
      const { root, dom } = setup('<h2>title</h2>');
      const text = (root.firstChild as HTMLElement).firstChild as Node;
      select(text, 2, text, 2);

      expect(dom.handleEnter()).toBe(false);
      expect(root.innerHTML).toBe('<h2>title</h2>');
    });

    it('treats the end of a marked run inside the heading as the heading end', () => {
      const { root, dom } = setup('<h2>a <strong>b</strong></h2>');
      const strongText = (root.querySelector('strong') as HTMLElement).firstChild as Node;
      select(strongText, 1, strongText, 1);

      expect(dom.handleEnter()).toBe(true);
      expect(root.innerHTML).toBe('<h2>a <strong>b</strong></h2><p><br></p>');
    });
  });

  describe('applyBlockAutoformat', () => {
    const noneReserved = () => false;

    const caretAtEndOf = (node: Node) => {
      const text = node.textContent ?? '';
      select(node, text.length, node, text.length);
    };

    it('converts "- " at a line start into a bulleted list', () => {
      const { root, dom } = setup('<p>-</p>');
      caretAtEndOf((root.firstChild as HTMLElement).firstChild as Node);

      expect(dom.applyBlockAutoformat(noneReserved)).toBe(true);
      expect(root.innerHTML).toBe('<ul><li><br></li></ul>');
    });

    it('converts "1. " into a numbered list', () => {
      const { root, dom } = setup('<p>1.</p>');
      caretAtEndOf((root.firstChild as HTMLElement).firstChild as Node);

      expect(dom.applyBlockAutoformat(noneReserved)).toBe(true);
      expect(root.innerHTML).toBe('<ol><li><br></li></ol>');
    });

    it('converts "## " into a heading of that level', () => {
      const { root, dom } = setup('<p>##</p>');
      caretAtEndOf((root.firstChild as HTMLElement).firstChild as Node);

      expect(dom.applyBlockAutoformat(noneReserved)).toBe(true);
      expect(root.innerHTML).toBe('<h2><br></h2>');
    });

    it('converts "> " into a block quote, but not inside one', () => {
      const { root, dom } = setup('<p>&gt;</p>');
      caretAtEndOf((root.firstChild as HTMLElement).firstChild as Node);

      expect(dom.applyBlockAutoformat(noneReserved)).toBe(true);
      expect(root.innerHTML).toBe('<blockquote><br></blockquote>');

      const quote = root.firstChild as HTMLElement;
      quote.innerHTML = '&gt;';
      caretAtEndOf(quote.firstChild as Node);

      expect(dom.applyBlockAutoformat(noneReserved)).toBe(false);
    });

    it('converts "``` " into a fenced code block', () => {
      const { root, dom } = setup('<p>```</p>');
      caretAtEndOf((root.firstChild as HTMLElement).firstChild as Node);

      expect(dom.applyBlockAutoformat(noneReserved)).toBe(true);
      expect(root.innerHTML).toBe('<pre><code>\n</code></pre>');
    });

    it('keeps existing text after the prefix as the converted block content', () => {
      const { root, dom } = setup('<p>-hello</p>');
      const text = (root.firstChild as HTMLElement).firstChild as Node;
      select(text, 1, text, 1); // caret right after the '-'

      expect(dom.applyBlockAutoformat(noneReserved)).toBe(true);
      expect(root.innerHTML).toBe('<ul><li>hello</li></ul>');
    });

    it('converts the loose first line of an empty editor', () => {
      const { root, dom } = setup('-');
      caretAtEndOf(root.firstChild as Node);

      expect(dom.applyBlockAutoformat(noneReserved)).toBe(true);
      expect(root.innerHTML).toBe('<ul><li><br></li></ul>');
    });

    it('converts a browser-created div line (Chrome inserts divs on Enter)', () => {
      const { root, dom } = setup('first line<div>-</div>');
      caretAtEndOf((root.querySelector('div') as HTMLElement).firstChild as Node);

      expect(dom.applyBlockAutoformat(noneReserved)).toBe(true);
      expect(root.innerHTML).toBe('first line<ul><li><br></li></ul>');
    });

    it('does not fire mid-line', () => {
      const { root, dom } = setup('<p>a #</p>');
      caretAtEndOf((root.firstChild as HTMLElement).firstChild as Node);

      expect(dom.applyBlockAutoformat(noneReserved)).toBe(false);
      expect(root.innerHTML).toBe('<p>a #</p>');
    });

    it('does not fire for a reserved trigger char', () => {
      const { root, dom } = setup('<p>#</p>');
      caretAtEndOf((root.firstChild as HTMLElement).firstChild as Node);

      expect(dom.applyBlockAutoformat((char) => char === '#')).toBe(false);
      expect(root.innerHTML).toBe('<p>#</p>');
    });

    it('does not fire inside a list item or table cell', () => {
      const inList = setup('<ul><li>-</li></ul>');
      caretAtEndOf(inList.root.querySelector('li')?.firstChild as Node);
      expect(inList.dom.applyBlockAutoformat(noneReserved)).toBe(false);

      const inCell = setup('<table><tbody><tr><td>#</td></tr></tbody></table>');
      caretAtEndOf(inCell.root.querySelector('td')?.firstChild as Node);
      expect(inCell.dom.applyBlockAutoformat(noneReserved)).toBe(false);
    });
  });

  describe('applyInlineAutoformat', () => {
    const noneReserved = () => false;

    const caretAtEndOf = (node: Node) => {
      const text = node.textContent ?? '';
      select(node, text.length, node, text.length);
    };

    it('converts **bold** when the closing star is typed', () => {
      const { root, dom } = setup('<p>see **bold*</p>');
      caretAtEndOf((root.firstChild as HTMLElement).firstChild as Node);

      expect(dom.applyInlineAutoformat('*', noneReserved)).toBe(true);
      expect(root.innerHTML.replace(/\u200b/g, '')).toBe('<p>see <strong>bold</strong></p>');
    });

    it('does not convert *italic yet* while it may still become bold', () => {
      const { root, dom } = setup('<p>**bold</p>');
      caretAtEndOf((root.firstChild as HTMLElement).firstChild as Node);

      // first closing star: `**bold*` — must wait for the second one
      expect(dom.applyInlineAutoformat('*', noneReserved)).toBe(false);
    });

    it('converts *italic*, `code` and ~~strike~~', () => {
      const em = setup('<p>an *i</p>');
      caretAtEndOf((em.root.firstChild as HTMLElement).firstChild as Node);
      expect(em.dom.applyInlineAutoformat('*', noneReserved)).toBe(true);
      expect(em.root.innerHTML.replace(/\u200b/g, '')).toBe('<p>an <em>i</em></p>');

      const code = setup('<p>`x</p>');
      caretAtEndOf((code.root.firstChild as HTMLElement).firstChild as Node);
      expect(code.dom.applyInlineAutoformat('`', noneReserved)).toBe(true);
      expect(code.root.innerHTML.replace(/\u200b/g, '')).toBe('<p><code>x</code></p>');

      const del = setup('<p>~~s~</p>');
      caretAtEndOf((del.root.firstChild as HTMLElement).firstChild as Node);
      expect(del.dom.applyInlineAutoformat('~', noneReserved)).toBe(true);
      expect(del.root.innerHTML.replace(/\u200b/g, '')).toBe('<p><del>s</del></p>');
    });

    it('places the caret after the mark so typing continues unformatted', () => {
      const { root, dom } = setup('<p>*i</p>');
      caretAtEndOf((root.firstChild as HTMLElement).firstChild as Node);

      dom.applyInlineAutoformat('*', noneReserved);

      const range = doc.getSelection()?.getRangeAt(0);

      expect(range?.collapsed).toBe(true);
      expect(dom.closestWithin(range?.startContainer ?? null, 'em')).toBeNull();
      expect(root.querySelector('em')).not.toBeNull();
    });

    it('does not fire inside a word for underscores', () => {
      const { dom, root } = setup('<p>snake_case</p>');
      caretAtEndOf((root.firstChild as HTMLElement).firstChild as Node);

      expect(dom.applyInlineAutoformat('_', noneReserved)).toBe(false);
    });

    it('does not fire for a reserved char or inside code', () => {
      const reserved = setup('<p>*i</p>');
      caretAtEndOf((reserved.root.firstChild as HTMLElement).firstChild as Node);
      expect(reserved.dom.applyInlineAutoformat('*', (char) => char === '*')).toBe(false);

      const inCode = setup('<p><code>a *b</code></p>');
      caretAtEndOf(inCode.root.querySelector('code')?.firstChild as Node);
      expect(inCode.dom.applyInlineAutoformat('*', noneReserved)).toBe(false);
    });
  });

  describe('insertNormalizedHtml', () => {
    it('splices a single paragraph inline into the caret block', () => {
      const { root, dom } = setup('<p>ab</p>');
      const text = (root.firstChild as HTMLElement).firstChild as Node;
      select(text, 1, text, 1);

      dom.insertNormalizedHtml('<p>X <strong>y</strong></p>');

      expect(root.innerHTML).toBe('<p>aX <strong>y</strong>b</p>');
    });

    it('replaces a non-collapsed selection with the pasted content', () => {
      const { root, dom } = setup('<p>hello</p>');
      const text = (root.firstChild as HTMLElement).firstChild as Node;
      select(text, 1, text, 4);

      dom.insertNormalizedHtml('<p>X</p>');

      expect(root.innerHTML).toBe('<p>hXo</p>');
    });

    it('inserts multi-block content after the caret block instead of nesting it', () => {
      const { root, dom } = setup('<p>ab</p><p>cd</p>');
      const text = (root.firstChild as HTMLElement).firstChild as Node;
      select(text, 2, text, 2);

      dom.insertNormalizedHtml('<p>one</p><ul><li>two</li></ul>');

      expect(root.innerHTML).toBe('<p>ab</p><p>one</p><ul><li>two</li></ul><p>cd</p>');
    });

    it('appends blocks to an empty editor', () => {
      const { root, dom } = setup('');
      select(root, 0, root, 0);

      dom.insertNormalizedHtml('<h2>title</h2><p>body</p>');

      expect(root.innerHTML).toBe('<h2>title</h2><p>body</p>');
    });

    it('places the caret at the end of the inserted content', () => {
      const { root, dom } = setup('<p>ab</p>');
      const text = (root.firstChild as HTMLElement).firstChild as Node;
      select(text, 1, text, 1);

      dom.insertNormalizedHtml('<p>XY</p>');

      const range = doc.getSelection()?.getRangeAt(0);

      expect(range?.collapsed).toBe(true);
      expect(range?.startContainer.textContent).toBe('aXYb');
      expect(range?.startOffset).toBe(3);
    });
  });
});
