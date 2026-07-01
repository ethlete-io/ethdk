import { Component, DebugElement } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../../test-helpers';
import { FORM_FIELD_CONTROL_TYPES, FormFieldDirective, LabelDirective } from '../../form-field/headless';
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
        dir.setLink('https://example.com');
      }).not.toThrow();
    });
  });
});
