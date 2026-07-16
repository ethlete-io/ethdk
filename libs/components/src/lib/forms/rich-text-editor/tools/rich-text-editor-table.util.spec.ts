import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { injectRenderer } from '@ethlete/core';
import '../../../../test-helpers';
import {
  injectRichTextEditorDom,
  provideRichTextEditorDom,
  RichTextEditorDom,
} from '../headless/internals/rich-text-editor-dom';
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
