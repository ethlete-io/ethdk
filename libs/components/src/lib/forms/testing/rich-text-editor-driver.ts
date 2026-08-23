import { Provider, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ControlDriverOptions, createControlDriver, mountControl } from '../../testing/control-driver';
import { pressKey, tick } from '../../testing/driver-core';
import {
  injectRichTextEditorDom,
  provideRichTextEditorDom,
  RichTextEditorDom,
} from '../rich-text-editor/headless/internals/rich-text-editor-dom';
import { RichTextEditorDirective } from '../rich-text-editor/headless/rich-text-editor.directive';

const liveSelection = () => {
  const selection = document.getSelection();

  if (!selection) throw new Error('The document has no selection.');

  return selection;
};

/** Selects `start`..`end` across the given nodes, replacing whatever was selected before. */
export const selectRange = (start: Node, startOffset: number, end: Node, endOffset: number) => {
  const range = document.createRange();

  range.setStart(start, startOffset);
  range.setEnd(end, endOffset);

  const selection = liveSelection();

  selection.removeAllRanges();
  selection.addRange(range);

  return range;
};

/** Collapsed caret inside one node. */
export const caretIn = (node: Node, offset: number) => selectRange(node, offset, node, offset);

/** Collapsed caret after the last character of `node`. */
export const caretAtEndOf = (node: Node) => caretIn(node, (node.textContent ?? '').length);

/** Selects everything inside `node` - what Ctrl+A within one block produces. */
export const selectContents = (node: Node) => {
  const range = document.createRange();

  range.selectNodeContents(node);

  const selection = liveSelection();

  selection.removeAllRanges();
  selection.addRange(range);

  return range;
};

const resolveTextPoint = (root: HTMLElement, offset: number) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let position = 0;
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const text = node as Text;

    if (position + text.data.length >= offset) return { node: text, offset: offset - position };

    position += text.data.length;
  }

  throw new Error(`No text at offset ${offset} of "${root.textContent ?? ''}" (${position} characters).`);
};

/**
 * Selects `start`..`end` by plain-text character offsets over `root`, however many elements the text
 * is split across - what a user re-dragging a selection over already-formatted content produces.
 * An offset past the end of the content throws, and the applied selection is read back, so an
 * offset that selects nothing fails the test instead of leaving the previous selection in place.
 */
export const selectText = (root: HTMLElement, start: number, end = start) => {
  const from = resolveTextPoint(root, start);
  const to = resolveTextPoint(root, end);

  selectRange(from.node, from.offset, to.node, to.offset);

  const live = liveSelection().getRangeAt(0);

  if (live.startContainer !== from.node || live.startOffset !== from.offset) {
    throw new Error(`The selection did not start at offset ${start}.`);
  }

  if (live.endContainer !== to.node || live.endOffset !== to.offset) {
    throw new Error(`The selection did not end at offset ${end}.`);
  }

  return live;
};

/** Collapsed caret at a plain-text character offset over `root`. See {@link selectText}. */
export const caretAt = (root: HTMLElement, offset: number) => selectText(root, offset, offset);

/**
 * A `contenteditable` element in the document, removed (with any selection it holds) when the test
 * finishes. `tabindex` makes it focusable, which jsdom requires before `focus()` moves the caret
 * into it.
 */
export const attachEditable = (html = '') => {
  const root = document.createElement('div');

  root.contentEditable = 'true';
  root.tabIndex = 0;
  root.innerHTML = html;
  document.body.appendChild(root);

  onTestFinished(() => {
    root.remove();
    document.getSelection()?.removeAllRanges();
  });

  return root;
};

export type RichTextEditorDomHarness = { root: HTMLElement; dom: RichTextEditorDom };

/**
 * Configures a testing module for the editor's DOM layer and returns the `setup(html)` a test calls
 * to get a `contenteditable` root wired to a fresh {@link RichTextEditorDom}. Call this from a
 * `beforeEach` and `setup` from inside the test - the root cleans itself up per test.
 */
export const richTextEditorDomHarness = (providers: Provider[] = []) => {
  TestBed.configureTestingModule({ providers: [provideRichTextEditorDom(), ...providers] });

  return {
    setup: (html: string): RichTextEditorDomHarness => {
      const root = attachEditable(html);
      const dom = TestBed.runInInjectionContext(() => injectRichTextEditorDom());

      dom.root.set(root);

      return { root, dom };
    },
  };
};

export type RichTextEditorDriverOptions = ControlDriverOptions & {
  /** Matches the `contenteditable` element. Defaults to the one `et-rich-text-editor` renders. */
  editableSelector?: string;
  /**
   * Attaches an editable element and hands it to the directive - what a bare `[etRichTextEditor]`
   * host needs, since only the `et-rich-text-editor` component renders one of its own.
   */
  attachEditable?: boolean;
};

/**
 * The editor, its editable element, and the caret / typing / clipboard operations a user performs
 * in it. jsdom implements no editing behaviour for `contenteditable`, so `type` applies the
 * insertion a browser would - unless the editor claims the keystroke first (autoformat, a pending
 * stored mark), in which case it made the edit itself.
 */
export const createRichTextEditorDriver = <T>(
  fixture: ComponentFixture<T>,
  {
    editableSelector = '[role="textbox"]',
    attachEditable: attach = false,
    ...controlOptions
  }: RichTextEditorDriverOptions = {},
) => {
  const base = createControlDriver(fixture, RichTextEditorDirective, controlOptions);

  if (attach) base.control.editorDom.root.set(attachEditable());

  tick();

  const editable = () => {
    const element = attach ? base.control.editorDom.root() : base.query(editableSelector);

    if (!element) throw new Error('The editor has no editable element.');

    return element;
  };

  const insertAtCaret = (text: string) => {
    const root = editable();
    const selection = liveSelection();

    if (!selection.rangeCount) throw new Error('Nothing is selected - place the caret first.');

    const range = selection.getRangeAt(0);

    if (!root.contains(range.startContainer)) throw new Error('The caret is outside the editor.');

    range.deleteContents();

    const container = range.startContainer;

    if (container.nodeType === Node.TEXT_NODE) {
      const node = container as Text;
      const offset = range.startOffset;

      node.insertData(offset, text);
      caretIn(node, offset + text.length);

      return;
    }

    const node = document.createTextNode(text);

    range.insertNode(node);
    caretIn(node, text.length);
  };

  const typeChar = (char: string) => {
    const target = editable();
    const beforeInput = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: char,
    });

    target.dispatchEvent(beforeInput);
    tick();

    if (beforeInput.defaultPrevented) return;

    insertAtCaret(char);
    target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: char }));
    tick();
  };

  return {
    ...base,
    editor: base.control,

    editable,
    html: () => editable().innerHTML,
    editableText: () => editable().textContent ?? '',
    value: () => base.control.value(),

    caretAt: (offset: number) => caretAt(editable(), offset),
    /** Collapsed caret before any content - the only caret an empty editor has. */
    caretAtStart: () => caretIn(editable(), 0),
    caretAtEnd: () => {
      const root = editable();
      const text = root.textContent ?? '';

      return text.length ? caretAt(root, text.length) : caretIn(root, root.childNodes.length);
    },
    selectText: (start: number, end?: number) => selectText(editable(), start, end),
    selectAll: () => selectContents(editable()),

    setHtml: (html: string) => {
      editable().innerHTML = html;
      tick();
    },

    type: (text: string) => {
      for (const char of text) typeChar(char);
    },

    press: (key: string, init: KeyboardEventInit = {}) => pressKey(editable(), key, init),

    /** jsdom has no `DataTransfer`, so the clipboard payload is faked onto the event. */
    paste: ({ html, text }: { html?: string; text?: string }) => {
      const event = new Event('paste', { bubbles: true, cancelable: true });

      Object.defineProperty(event, 'clipboardData', {
        value: {
          files: [],
          getData: (type: string) => (type === 'text/html' ? (html ?? '') : (text ?? '')),
        },
      });

      editable().dispatchEvent(event);
      tick();

      return event;
    },

    focus: () => {
      const element = editable();

      element.focus();
      tick();

      if (document.activeElement !== element) throw new Error('The editor did not take focus.');
    },
    blur: () => {
      const element = editable();

      if (document.activeElement !== element) throw new Error('The editor is not focused.');

      element.blur();
      tick();

      if (document.activeElement === element) throw new Error('The editor kept focus.');
    },

    /** jsdom fires no `selectionchange`, so the editor's own listener never runs after a caret move. */
    refreshMarks: () => {
      base.control.refreshActiveMarks();
      tick();
    },
  };
};

export type RichTextEditorDriver<T> = ReturnType<typeof createRichTextEditorDriver<T>>;

export const mountRichTextEditor = <T>(
  component: Type<T>,
  options: RichTextEditorDriverOptions = {},
  providers: Provider[] = [],
) => createRichTextEditorDriver(mountControl(component, providers), options);
