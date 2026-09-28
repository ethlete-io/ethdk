import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { injectRenderer } from '@ethlete/core';
import '../../../../test-helpers';
import {
  injectRichTextEditorDom,
  provideRichTextEditorDom,
  RichTextEditorDom,
} from '../headless/internals/rich-text-editor-dom';
import { RichTextEditorDirective } from '../headless/rich-text-editor.directive';
import { RICH_TEXT_EDITOR_TOOL, RichTextEditorToolDefinition } from '../rich-text-editor-tools';
import { provideRichTextEditorTableTool } from './rich-text-editor-table.provider';
import { createTableNav } from './rich-text-editor-table.util';

const TABLE = '<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>C</td><td>D</td></tr></tbody></table>';

describe('createTableNav tab', () => {
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

  const setup = (
    html: string,
  ): { root: HTMLElement; dom: RichTextEditorDom; nav: ReturnType<typeof createTableNav> } => {
    const root = renderer.createElement('div');
    root.contentEditable = 'true';
    root.innerHTML = html;
    renderer.appendChild(doc.body, root);

    const dom = TestBed.runInInjectionContext(() => injectRichTextEditorDom());
    dom.root.set(root);

    return { root, dom, nav: createTableNav(renderer) };
  };

  const caretIn = (node: Node) => {
    const selection = doc.getSelection();
    const range = doc.createRange();
    range.setStart(node, 0);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  const caretCell = (root: HTMLElement): string | null => {
    const container = doc.getSelection()?.getRangeAt(0).startContainer ?? null;
    let el: HTMLElement | null = container instanceof HTMLElement ? container : (container?.parentElement ?? null);

    while (el && el !== root && !(el instanceof HTMLTableCellElement)) el = el.parentElement;

    return el instanceof HTMLTableCellElement ? el.textContent : null;
  };

  const tabEvent = (shiftKey = false) => new KeyboardEvent('keydown', { key: 'Tab', shiftKey });

  it('moves to the next cell on Tab, row-major across the header/body boundary', () => {
    const { root, dom, nav } = setup(TABLE);
    caretIn(root.querySelector('th') as Node);

    expect(nav.tab(dom, tabEvent())).toBe(true);
    expect(caretCell(root)).toBe('B');

    expect(nav.tab(dom, tabEvent())).toBe(true);
    expect(caretCell(root)).toBe('C');
  });

  it('moves to the previous cell on Shift+Tab', () => {
    const { root, dom, nav } = setup(TABLE);
    caretIn(root.querySelectorAll('td')[0] as Node);

    expect(nav.tab(dom, tabEvent(true))).toBe(true);
    expect(caretCell(root)).toBe('B');
  });

  it('steps out past the last cell, creating a paragraph when the table ends the document', () => {
    const { root, dom, nav } = setup(TABLE);
    caretIn(root.querySelectorAll('td')[1] as Node);

    expect(nav.tab(dom, tabEvent())).toBe(true);
    expect(caretCell(root)).toBeNull();
    expect(root.lastElementChild?.tagName).toBe('P');
  });

  it('steps out before the table on Shift+Tab from the first cell', () => {
    const { root, dom, nav } = setup(`<p>before</p>${TABLE}`);
    caretIn(root.querySelector('th') as Node);

    expect(nav.tab(dom, tabEvent(true))).toBe(true);
    expect(caretCell(root)).toBeNull();
    expect(doc.getSelection()?.getRangeAt(0).startContainer.textContent).toContain('before');
  });

  it('ignores Tab outside a table', () => {
    const { root, dom, nav } = setup('<p>plain</p>');
    caretIn(root.querySelector('p') as Node);

    expect(nav.tab(dom, tabEvent())).toBe(false);
  });
});

describe('table tool arrow keys', () => {
  let renderer: NonNullable<ReturnType<typeof injectRenderer>>;
  let doc: Document;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRichTextEditorDom(), provideRichTextEditorTableTool()] });
    renderer = TestBed.runInInjectionContext(() => injectRenderer());
    doc = TestBed.inject(DOCUMENT);
  });

  afterEach(() => {
    doc.body.innerHTML = '';
    doc.getSelection()?.removeAllRanges();
  });

  const setup = (html: string) => {
    const root = renderer.createElement('div') as HTMLElement;
    root.contentEditable = 'true';
    root.innerHTML = html;
    renderer.appendChild(doc.body, root);

    const dom = TestBed.runInInjectionContext(() => injectRichTextEditorDom());
    dom.root.set(root);

    const tool = (TestBed.inject(RICH_TEXT_EDITOR_TOOL) as unknown as RichTextEditorToolDefinition[]).find(
      (definition) => definition.token === 'table',
    );
    const editor = { editorDom: dom } as unknown as RichTextEditorDirective;
    const keydown = (event: KeyboardEvent) => tool?.keydown?.(editor, event) ?? false;

    return { root, keydown };
  };

  const caretAt = (node: Node, offset: number) => {
    const range = doc.createRange();
    range.setStart(node, offset);
    range.collapse(true);
    doc.getSelection()?.removeAllRanges();
    doc.getSelection()?.addRange(range);
  };

  const caretBlock = (root: HTMLElement) => {
    let node: Node | null = doc.getSelection()?.getRangeAt(0).startContainer ?? null;

    while (node && node.parentNode !== root) node = node.parentNode;

    return node as HTMLElement | null;
  };

  const arrow = (key: string, init: KeyboardEventInit = {}) => new KeyboardEvent('keydown', { key, ...init });

  it.each([
    ['shiftKey', { shiftKey: true }],
    ['altKey', { altKey: true }],
    ['ctrlKey', { ctrlKey: true }],
    ['metaKey', { metaKey: true }],
    ['isComposing', { isComposing: true }],
  ])('leaves an arrow key with %s to the browser', (_, init) => {
    const { root, keydown } = setup(`<p>before</p>${TABLE}<p>after</p>`);
    const lastCell = root.querySelectorAll('td')[1] as HTMLElement;
    caretAt(lastCell.firstChild as Node, 1);

    expect(keydown(arrow('ArrowDown', init))).toBe(false);
    expect(keydown(arrow('ArrowRight', init))).toBe(false);

    caretAt(root.querySelector('p')?.firstChild as Node, 6);

    expect(keydown(arrow('ArrowRight', init))).toBe(false);
    expect(caretBlock(root)?.tagName).toBe('P');
  });

  it('steps out of the last row into the next paragraph on a plain ArrowDown', () => {
    const { root, keydown } = setup(`${TABLE}<p>after</p>`);
    caretAt(root.querySelectorAll('td')[0]?.firstChild as Node, 0);

    expect(keydown(arrow('ArrowDown'))).toBe(true);
    expect(caretBlock(root)?.textContent).toBe('after');
  });

  it('enters the first cell from the paragraph before the table on a plain ArrowRight', () => {
    const { root, keydown } = setup(`<p>before</p>${TABLE}`);
    caretAt(root.querySelector('p')?.firstChild as Node, 6);

    expect(keydown(arrow('ArrowRight'))).toBe(true);
    expect(doc.getSelection()?.getRangeAt(0).startContainer).toBe(root.querySelector('th'));
  });

  it('puts a paragraph between the table and an image block instead of landing in the image', () => {
    const { root, keydown } = setup(
      `${TABLE}<p contenteditable="false"><img src="https://example.com/a.png" alt=""></p>`,
    );
    caretAt(root.querySelectorAll('td')[1]?.firstChild as Node, 1);

    expect(keydown(arrow('ArrowDown'))).toBe(true);

    const block = caretBlock(root);

    expect(block?.tagName).toBe('P');
    expect(block?.getAttribute('contenteditable')).toBeNull();
    expect(block?.nextElementSibling?.getAttribute('contenteditable')).toBe('false');
  });

  it('puts a paragraph between two adjacent tables instead of landing between their cells', () => {
    const { root, keydown } = setup(`${TABLE}${TABLE}`);
    caretAt(root.querySelectorAll('td')[1]?.firstChild as Node, 1);

    expect(keydown(arrow('ArrowDown'))).toBe(true);
    expect(caretBlock(root)?.tagName).toBe('P');
    expect(root.children[1]?.tagName).toBe('P');
  });

  it('lands in the last list item when stepping up into a list', () => {
    const { root, keydown } = setup(`<ul><li>one</li><li>two</li></ul>${TABLE}`);
    caretAt(root.querySelector('th')?.firstChild as Node, 0);

    expect(keydown(arrow('ArrowUp'))).toBe(true);

    const container = doc.getSelection()?.getRangeAt(0).startContainer;

    expect(
      container === root.querySelectorAll('li')[1] || container?.parentNode === root.querySelectorAll('li')[1],
    ).toBe(true);
  });

  it('lands in the first list item when stepping down into a list', () => {
    const { root, keydown } = setup(`${TABLE}<ol><li>one</li><li>two</li></ol>`);
    caretAt(root.querySelectorAll('td')[1]?.firstChild as Node, 1);

    expect(keydown(arrow('ArrowDown'))).toBe(true);
    expect(doc.getSelection()?.getRangeAt(0).startContainer).toBe(root.querySelector('li'));
  });

  it('enters the last cell at its end from the paragraph after the table on a plain ArrowLeft', () => {
    const { root, keydown } = setup(`${TABLE}<p>after</p>`);
    caretAt(root.querySelector('p')?.firstChild as Node, 0);

    expect(keydown(arrow('ArrowLeft'))).toBe(true);

    const range = doc.getSelection()?.getRangeAt(0);
    const lastCell = root.querySelectorAll('td')[1];

    expect(range?.startContainer).toBe(lastCell);
    expect(range?.startOffset).toBe(lastCell?.childNodes.length);
  });

  it('follows the text direction for ArrowLeft and ArrowRight in RTL content', () => {
    const { root, keydown } = setup(
      `<p style="direction: rtl">before</p>${TABLE.replace('<table>', '<table style="direction: rtl">').replaceAll('<td>', '<td style="direction: rtl">')}<p>after</p>`,
    );
    const lastCell = root.querySelectorAll('td')[1] as HTMLElement;

    caretAt(lastCell.firstChild as Node, 1);

    expect(keydown(arrow('ArrowRight'))).toBe(false);
    expect(keydown(arrow('ArrowLeft'))).toBe(true);
    expect(caretBlock(root)?.textContent).toBe('after');

    caretAt(root.querySelector('p')?.firstChild as Node, 6);

    expect(keydown(arrow('ArrowRight'))).toBe(false);
    expect(keydown(arrow('ArrowLeft'))).toBe(true);
    expect(doc.getSelection()?.getRangeAt(0).startContainer).toBe(root.querySelector('th'));
  });
});
