import { Component } from '@angular/core';
import '../../../../test-helpers';
import {
  caretIn,
  mountRichTextEditor,
  RichTextEditorDriver,
  selectContents,
} from '../../testing/rich-text-editor-driver';
import { FORM_FIELD_CONTROL_TYPES, FormFieldDirective, LabelDirective } from '../../form-field/headless';
import { RICH_TEXT_EDITOR_ERROR_CODES } from '../rich-text-editor-errors';
import { RichTextEditorTrigger, RichTextEditorTriggerItem } from '../rich-text-editor-trigger';
import { provideRichTextEditorDefaultTools } from '../tools/rich-text-editor-default-tools.provider';
import { createRichTextEditorTokenCodec } from './internals/rich-text-editor-token';
import { RichTextEditorDirective } from './rich-text-editor.directive';

@Component({
  template: `
    <div etFormField>
      <et-label>Description</et-label>
      <div etRichTextEditor placeholder="Write something…"></div>
    </div>
  `,
  imports: [RichTextEditorDirective, FormFieldDirective, LabelDirective],
})
class EditorInFormFieldTestHost {}

@Component({
  template: `<div etRichTextEditor placeholder="standalone"></div>`,
  imports: [RichTextEditorDirective],
  providers: [provideRichTextEditorDefaultTools()],
})
class StandaloneEditorTestHost {}

/** No opt-in DOM domain at all - the floor a marks-and-lists editor ships. */
@Component({
  template: `<div etRichTextEditor placeholder="minimal"></div>`,
  imports: [RichTextEditorDirective],
})
class MinimalEditorTestHost {}

describe('RichTextEditorDirective', () => {
  describe('inside form field', () => {
    let formFieldDir: FormFieldDirective;

    beforeEach(() => {
      formFieldDir = mountRichTextEditor(EditorInFormFieldTestHost, {
        directiveSelector: '[etRichTextEditor]',
      }).directive(FormFieldDirective);
    });

    it('should register with the parent form field', () => {
      expect(formFieldDir.registeredControl()).toBeTruthy();
    });

    it('should report the rich-text control type', () => {
      expect(formFieldDir.controlType()).toBe(FORM_FIELD_CONTROL_TYPES.RICH_TEXT);
      expect(formFieldDir.usesTextFieldShell()).toBe(true);
    });
  });

  describe('standalone', () => {
    let dir: RichTextEditorDirective;

    beforeEach(() => {
      dir = mountRichTextEditor(StandaloneEditorTestHost).editor;
    });

    it('should have an empty markdown value by default', () => {
      expect(dir.value()).toBe('');
    });

    it('should not display an error when untouched', () => {
      expect(dir.shouldDisplayError()).toBe(false);
    });

    it('should expose inactive marks by default', () => {
      dir.refreshActiveMarks();
      expect(dir.boldActive()).toBe(false);
      expect(dir.italicActive()).toBe(false);
      expect(dir.linkActive()).toBe(false);
    });

    it('should not throw when commands run without an editable element', () => {
      expect(() => {
        dir.toggleBold();
        dir.toggleItalic();
        dir.toggleStrikethrough();
        dir.toggleUnorderedList();
        dir.toggleOrderedList();
        dir.toggleHeading(1);
        dir.toggleHeading(2);
        dir.applyLink('https://example.com');
      }).not.toThrow();
    });

    it('reports no active heading by default', () => {
      dir.refreshActiveMarks();
      expect(dir.headingLevel()).toBeNull();
    });
  });

  describe('without the opt-in DOM domains', () => {
    let dir: RichTextEditorDirective;

    beforeEach(() => {
      dir = mountRichTextEditor(MinimalEditorTestHost).editor;
    });

    it('leaves the marks and lists working', () => {
      expect(() => {
        dir.toggleBold();
        dir.toggleUnorderedList();
        dir.toggleOrderedList();
      }).not.toThrow();
    });

    it('names the missing provider when a domain command is called', () => {
      expect(() => dir.toggleBlockquote()).toThrow(/provideRichTextEditorBlockquoteTool/);
      expect(() => dir.toggleCodeBlock()).toThrow(/provideRichTextEditorCodeBlockTool/);
      expect(() => dir.toggleHeading(1)).toThrow(/provideRichTextEditorHeadingTool/);
      expect(() => dir.applyLink('https://example.com')).toThrow(/provideRichTextEditorLinkTool/);
      expect(() => dir.removeLink()).toThrow(/provideRichTextEditorLinkTool/);
    });

    it('silently skips autoformat rather than failing on every keystroke', () => {
      expect(dir.handleAutoformat(' ')).toBe(false);
      expect(dir.handleAutoformat('*')).toBe(false);
    });
  });

  describe('pasteHtml', () => {
    let driver: RichTextEditorDriver<StandaloneEditorTestHost>;
    let dir: RichTextEditorDirective;
    let editable: HTMLElement;

    beforeEach(() => {
      driver = mountRichTextEditor(StandaloneEditorTestHost, { attachEditable: true });
      dir = driver.editor;
      editable = driver.editable();
      driver.caretAtStart();
    });

    it('reduces foreign markup to the editor schema and syncs the value', () => {
      const handled = dir.pasteHtml('<div style="color: red"><span class="x">hello <b>world</b></span></div>');

      expect(handled).toBe(true);
      expect(dir.value()).toBe('hello **world**');
      expect(editable.innerHTML).not.toContain('style=');
      expect(editable.innerHTML).toContain('<strong>world</strong>');
    });

    it('drops style and script elements including their text content', () => {
      dir.pasteHtml('<style>.x { color: red; }</style><script>evil()</script><p>hi</p>');

      expect(dir.value()).toBe('hi');
      expect(editable.textContent).not.toContain('color: red');
    });

    it('returns false when the clipboard html has no meaningful content', () => {
      expect(dir.pasteHtml('<div>   </div>')).toBe(false);
      expect(dir.value()).toBe('');
    });

    it('does nothing without an editable element', () => {
      dir.editorDom.root.set(null);

      expect(dir.pasteHtml('<p>hi</p>')).toBe(false);
      expect(dir.value()).toBe('');
    });

    it('locks the heading tool inside lists and table cells, but not in plain paragraphs', () => {
      driver.setHtml('<p>plain</p><ul><li>item</li></ul><table><tbody><tr><td>cell</td></tr></tbody></table>');

      const caretInside = (selector: string) => {
        const target = editable.querySelector(selector)?.firstChild;

        if (!target) throw new Error(`no text node for ${selector}`);

        caretIn(target, 1);
        driver.refreshMarks();
      };

      caretInside('p');
      expect(dir.headingToolDisabled()).toBe(false);

      caretInside('li');
      expect(dir.headingToolDisabled()).toBe(true);

      caretInside('td');
      expect(dir.headingToolDisabled()).toBe(true);
    });
  });

  describe('history', () => {
    let driver: RichTextEditorDriver<StandaloneEditorTestHost>;
    let dir: RichTextEditorDirective;
    let editable: HTMLElement;

    /** Stands in for typing: rewrite the content, park the caret in it, then commit like the
     *  editor's own `input` handler does. */
    const write = (html: string, opts: { boundary?: boolean; caretAt?: number } = {}) => {
      driver.setHtml(html);

      const text = editable.querySelector('p')?.firstChild;

      if (text) caretIn(text, opts.caretAt ?? (text.textContent ?? '').length);

      dir.syncFromDom(opts.boundary ? { boundary: true } : undefined);
    };

    beforeEach(() => {
      driver = mountRichTextEditor(StandaloneEditorTestHost, { attachEditable: true });
      dir = driver.editor;
      editable = driver.editable();
    });

    it('has nothing to undo or redo before the first edit', () => {
      expect(dir.canUndo()).toBe(false);
      expect(dir.canRedo()).toBe(false);
    });

    it('takes a typing burst back as one step, breaking at word boundaries', () => {
      write('<p>hel</p>');
      write('<p>hello</p>');
      write('<p>hello w</p>');
      write('<p>hello world</p>');

      dir.undo();
      expect(dir.value()).toBe('hello');

      dir.undo();
      expect(dir.value()).toBe('');
      expect(dir.canUndo()).toBe(false);

      dir.redo();
      expect(dir.value()).toBe('hello');
      expect(editable.textContent).toBe('hello');
    });

    it('takes a normalized paste back in a single step', () => {
      write('<p>start </p>');
      dir.pasteHtml('<div style="color: red">pasted <b>bold</b></div>');

      expect(dir.value()).toContain('**bold**');

      dir.undo();
      expect(dir.value()).toBe('start');
      expect(editable.innerHTML).not.toContain('bold');

      dir.redo();
      expect(dir.value()).toContain('**bold**');
    });

    it('takes a command back in a single step', () => {
      write('<p>hello</p>');

      selectContents(editable.querySelector('p')!);

      dir.toggleBold();

      expect(dir.value()).toBe('**hello**');

      dir.undo();
      expect(dir.value()).toBe('hello');
    });

    it('restores the caret along with the value', () => {
      write('<p>hello</p>');
      write('<p>hello there</p>', { boundary: true, caretAt: 5 });

      dir.undo();

      const range = document.getSelection()?.getRangeAt(0);
      expect(dir.value()).toBe('hello');
      expect(range?.startContainer.textContent).toBe('hello');
      expect(range?.startOffset).toBe(5);
    });

    it('starts a fresh history for a value the editor did not produce', () => {
      write('<p>typed</p>');
      expect(dir.canUndo()).toBe(true);

      dir.renderExternalValue('replaced');

      expect(dir.canUndo()).toBe(false);
      expect(dir.canRedo()).toBe(false);
      expect(editable.textContent).toBe('replaced');
    });

    it('does nothing at the ends of the stack', () => {
      write('<p>only</p>');
      dir.undo();
      dir.undo();
      expect(dir.value()).toBe('');

      dir.redo();
      dir.redo();
      expect(dir.value()).toBe('only');
    });

    it('does not throw without an editable element', () => {
      dir.editorDom.root.set(null);

      expect(() => {
        dir.undo();
        dir.redo();
        dir.recordHistorySelection();
        dir.renderExternalValue('x');
      }).not.toThrow();
    });
  });

  describe('markdown value', () => {
    let driver: RichTextEditorDriver<StandaloneEditorTestHost>;

    beforeEach(() => {
      driver = mountRichTextEditor(StandaloneEditorTestHost, { attachEditable: true });
    });

    it('drops an empty inline mark of any tag instead of leaking it as raw html', () => {
      driver.setHtml('<p><strong></strong>a<em></em>b<del></del>c<u></u>d<code></code>e<a href="#"></a></p>');

      driver.editor.syncFromDom();

      expect(driver.value()).toBe('abcde');
    });

    it('serializes only the marked span when a selection is taken by text offsets', () => {
      driver.setHtml('<p>alpha beta</p>');
      driver.selectText(6, 10);

      driver.editor.toggleBold();

      expect(driver.value()).toBe('alpha **beta**');
      expect(driver.html()).toContain('<strong>beta</strong>');
    });

    it('re-selects across an existing mark by text offsets and stacks the second mark', () => {
      driver.setHtml('<p>alpha <strong>beta</strong></p>');
      driver.selectText(6, 10);

      driver.editor.toggleItalic();

      expect(driver.value()).toBe('alpha ***beta***');
    });
  });

  describe('insertToken', () => {
    let driver: RichTextEditorDriver<StandaloneEditorTestHost>;
    let dir: RichTextEditorDirective;
    let editable: HTMLElement;

    const MERGE_FIELDS: RichTextEditorTriggerItem[] = [
      { id: 'firstName', label: 'First name' },
      { id: 'company', label: 'Company' },
    ];
    const TRIGGERS: RichTextEditorTrigger[] = [
      {
        char: '#',
        type: 'block',
        items: MERGE_FIELDS,
        resolveItem: (id) => MERGE_FIELDS.find((item) => item.id === id) ?? null,
      },
    ];

    const placeCaretAtStart = () => driver.caretAtStart();

    beforeEach(() => {
      driver = mountRichTextEditor(StandaloneEditorTestHost, { attachEditable: true });
      dir = driver.editor;
      editable = driver.editable();
      dir.tokenCodec.set(createRichTextEditorTokenCodec(() => TRIGGERS));
    });

    it('inserts a chip at the caret and serializes it to token markdown', () => {
      placeCaretAtStart();

      dir.insertToken('block', 'firstName');

      const chip = editable.querySelector('[data-et-token]');
      expect(chip?.getAttribute('data-token-type')).toBe('block');
      expect(chip?.getAttribute('data-token-id')).toBe('firstName');
      // label resolved synchronously via the trigger's resolveItem
      expect(chip?.textContent).toContain('First name');
      expect(dir.value()).toContain('{{block:firstName}}');
    });

    it('uses the caller-provided label for insertTokenItem without re-resolving', () => {
      placeCaretAtStart();

      dir.insertTokenItem('block', { id: 'company', label: 'Acme Corp' });

      const chip = editable.querySelector('[data-et-token]');
      expect(chip?.getAttribute('data-token-id')).toBe('company');
      expect(chip?.textContent).toContain('Acme Corp');
      expect(dir.value()).toContain('{{block:company}}');
    });

    it('appends at the end when the editor is not focused (no selection inside it)', () => {
      driver.setHtml('<p>Hello</p>');
      document.getSelection()?.removeAllRanges();

      dir.insertToken('block', 'company');

      // chip landed after the existing content, not before it
      const chip = editable.querySelector('[data-et-token]');
      const paragraph = editable.querySelector('p');
      expect(chip).not.toBeNull();
      expect(paragraph).not.toBeNull();
      expect(paragraph!.compareDocumentPosition(chip as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
      expect(dir.value()).toContain('Hello');
      expect(dir.value()).toContain('{{block:company}}');
    });

    it('throws in dev when no token codec is installed', () => {
      dir.tokenCodec.set(null);
      placeCaretAtStart();

      expect(() => dir.insertToken('block', 'firstName')).toThrowError(/token codec/);
    });

    it('throws in dev for an invalid token type or id', () => {
      placeCaretAtStart();

      expect(() => dir.insertToken('Block', 'firstName')).toThrow(
        `ET${RICH_TEXT_EDITOR_ERROR_CODES.INVALID_TOKEN_TYPE}`,
      );
      expect(() => dir.insertToken('block', 'has space')).toThrow(`ET${RICH_TEXT_EDITOR_ERROR_CODES.INVALID_TOKEN_ID}`);
    });

    it('does nothing without an editable element', () => {
      dir.editorDom.root.set(null);

      expect(() => dir.insertToken('block', 'firstName')).not.toThrow();
      expect(dir.value()).toBe('');
    });
  });
});
