import { Component, DebugElement } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../../test-helpers';
import { FORM_FIELD_CONTROL_TYPES, FormFieldDirective, LabelDirective } from '../../form-field/headless';
import { RichTextEditorTrigger, RichTextEditorTriggerItem } from '../rich-text-editor-trigger';
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
})
class StandaloneEditorTestHost {}

describe('RichTextEditorDirective', () => {
  describe('inside form field', () => {
    let fixture: ComponentFixture<EditorInFormFieldTestHost>;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [EditorInFormFieldTestHost] });
      fixture = TestBed.createComponent(EditorInFormFieldTestHost);
      fixture.detectChanges();
    });

    it('should register with the parent form field', () => {
      const formFieldDir = (fixture.debugElement.children[0] as DebugElement).injector.get(FormFieldDirective);
      expect(formFieldDir.registeredControl()).toBeTruthy();
    });

    it('should report the rich-text control type', () => {
      const formFieldDir = (fixture.debugElement.children[0] as DebugElement).injector.get(FormFieldDirective);
      expect(formFieldDir.controlType()).toBe(FORM_FIELD_CONTROL_TYPES.RICH_TEXT);
      expect(formFieldDir.usesTextFieldShell()).toBe(true);
    });
  });

  describe('standalone', () => {
    let fixture: ComponentFixture<StandaloneEditorTestHost>;
    let dir: RichTextEditorDirective;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [StandaloneEditorTestHost] });
      fixture = TestBed.createComponent(StandaloneEditorTestHost);
      fixture.detectChanges();
      dir = (fixture.debugElement.children[0] as DebugElement).injector.get(RichTextEditorDirective);
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

  describe('pasteHtml', () => {
    let fixture: ComponentFixture<StandaloneEditorTestHost>;
    let dir: RichTextEditorDirective;
    let editable: HTMLElement;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [StandaloneEditorTestHost] });
      fixture = TestBed.createComponent(StandaloneEditorTestHost);
      fixture.detectChanges();
      dir = (fixture.debugElement.children[0] as DebugElement).injector.get(RichTextEditorDirective);

      editable = document.createElement('div');
      editable.contentEditable = 'true';
      document.body.appendChild(editable);
      dir.editorDom.root.set(editable);

      const range = document.createRange();
      range.setStart(editable, 0);
      range.collapse(true);
      const selection = document.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });

    afterEach(() => {
      editable.remove();
      document.getSelection()?.removeAllRanges();
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
      editable.innerHTML = '<p>plain</p><ul><li>item</li></ul><table><tbody><tr><td>cell</td></tr></tbody></table>';

      const caretIn = (selector: string) => {
        const target = editable.querySelector(selector)?.firstChild;

        if (!target) throw new Error(`no text node for ${selector}`);

        const range = document.createRange();
        range.setStart(target, 1);
        range.collapse(true);
        const selection = document.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        dir.refreshActiveMarks();
      };

      caretIn('p');
      expect(dir.headingToolDisabled()).toBe(false);

      caretIn('li');
      expect(dir.headingToolDisabled()).toBe(true);

      caretIn('td');
      expect(dir.headingToolDisabled()).toBe(true);
    });
  });

  describe('history', () => {
    let fixture: ComponentFixture<StandaloneEditorTestHost>;
    let dir: RichTextEditorDirective;
    let editable: HTMLElement;

    /** Stands in for typing: rewrite the content, park the caret in it, then commit like the
     *  editor's own `input` handler does. */
    const write = (html: string, opts: { boundary?: boolean; caretAt?: number } = {}) => {
      editable.innerHTML = html;

      const text = editable.querySelector('p')?.firstChild;

      if (text) {
        const range = document.createRange();
        range.setStart(text, opts.caretAt ?? (text.textContent ?? '').length);
        range.collapse(true);
        const selection = document.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }

      dir.syncFromDom(opts.boundary ? { boundary: true } : undefined);
    };

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [StandaloneEditorTestHost] });
      fixture = TestBed.createComponent(StandaloneEditorTestHost);
      fixture.detectChanges();
      dir = (fixture.debugElement.children[0] as DebugElement).injector.get(RichTextEditorDirective);

      editable = document.createElement('div');
      editable.contentEditable = 'true';
      document.body.appendChild(editable);
      dir.editorDom.root.set(editable);
    });

    afterEach(() => {
      editable.remove();
      document.getSelection()?.removeAllRanges();
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

      const range = document.createRange();
      range.selectNodeContents(editable.querySelector('p') as HTMLElement);
      const selection = document.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

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

  describe('insertToken', () => {
    let fixture: ComponentFixture<StandaloneEditorTestHost>;
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

    const placeCaretAtStart = () => {
      const range = document.createRange();
      range.setStart(editable, 0);
      range.collapse(true);
      const selection = document.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    };

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [StandaloneEditorTestHost] });
      fixture = TestBed.createComponent(StandaloneEditorTestHost);
      fixture.detectChanges();
      dir = (fixture.debugElement.children[0] as DebugElement).injector.get(RichTextEditorDirective);

      editable = document.createElement('div');
      editable.contentEditable = 'true';
      document.body.appendChild(editable);
      dir.editorDom.root.set(editable);
      dir.tokenCodec.set(createRichTextEditorTokenCodec(() => TRIGGERS));
    });

    afterEach(() => {
      editable.remove();
      document.getSelection()?.removeAllRanges();
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
      editable.innerHTML = '<p>Hello</p>';
      document.getSelection()?.removeAllRanges();

      dir.insertToken('block', 'company');

      // chip landed after the existing content, not before it
      const chip = editable.querySelector('[data-et-token]');
      expect(chip).not.toBeNull();
      expect(
        editable.querySelector('p')?.compareDocumentPosition(chip as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
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

      expect(() => dir.insertToken('Block', 'firstName')).toThrow();
      expect(() => dir.insertToken('block', 'has space')).toThrow();
    });

    it('does nothing without an editable element', () => {
      dir.editorDom.root.set(null);

      expect(() => dir.insertToken('block', 'firstName')).not.toThrow();
      expect(dir.value()).toBe('');
    });
  });
});
