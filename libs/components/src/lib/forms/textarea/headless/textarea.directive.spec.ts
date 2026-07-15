import { Component, DebugElement, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../../test-helpers';
import { FormFieldDirective, LabelDirective } from '../../form-field/headless';
import { TextareaDirective } from './textarea.directive';

@Component({
  template: `
    <div etFormField>
      <et-label>Message</et-label>
      <textarea etTextarea placeholder="Your message"></textarea>
    </div>
  `,
  imports: [TextareaDirective, FormFieldDirective, LabelDirective],
})
class TextareaInFormFieldTestHost {}

@Component({
  template: `<textarea [autosize]="autosize()" [rows]="rows()" etTextarea></textarea>`,
  imports: [TextareaDirective],
})
class StandaloneTextareaTestHost {
  autosize = signal(true);
  rows = signal(3);
}

describe('TextareaDirective', () => {
  describe('inside form field', () => {
    let fixture: ComponentFixture<TextareaInFormFieldTestHost>;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [TextareaInFormFieldTestHost] });
      fixture = TestBed.createComponent(TextareaInFormFieldTestHost);
      fixture.detectChanges();
    });

    it('should register with parent form field', () => {
      const formFieldDir = (fixture.debugElement.children[0] as DebugElement).injector.get(FormFieldDirective);
      expect(formFieldDir.registeredControl()).toBeTruthy();
    });

    it('should compute labelId from registered label', () => {
      const textareaDir = (fixture.debugElement.children[0] as DebugElement)
        .query((el) => el.nativeElement.matches('[etTextarea]'))
        .injector.get(TextareaDirective);

      expect(textareaDir.labelId()).toMatch(/^et-label-\d+$/);
    });
  });

  describe('value and state', () => {
    let fixture: ComponentFixture<StandaloneTextareaTestHost>;
    let textareaDir: TextareaDirective;
    let nativeTextarea: HTMLTextAreaElement;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [StandaloneTextareaTestHost] });
      fixture = TestBed.createComponent(StandaloneTextareaTestHost);
      fixture.detectChanges();
      textareaDir = (fixture.debugElement.children[0] as DebugElement).injector.get(TextareaDirective);
      nativeTextarea = fixture.nativeElement.querySelector('[etTextarea]');
    });

    it('should have empty value by default', () => {
      expect(textareaDir.value()).toBe('');
      expect(textareaDir.hasValue()).toBe(false);
    });

    it('should expose the host textarea as nativeControl', () => {
      expect(textareaDir.nativeControl()).toBe(nativeTextarea);
    });

    it('should report resize none while autosizing', () => {
      expect(textareaDir.effectiveResize()).toBe('none');
    });

    it('should honor the resize input when autosize is off', () => {
      fixture.componentInstance.autosize.set(false);
      fixture.detectChanges();

      expect(textareaDir.effectiveResize()).toBe('vertical');
    });

    it('should clear the inline block-size when autosize is turned off', () => {
      fixture.componentInstance.autosize.set(false);
      fixture.detectChanges();

      expect(nativeTextarea.style.blockSize).toBe('');
    });

    it('should not display error when not touched', () => {
      expect(textareaDir.shouldDisplayError()).toBe(false);
    });
  });
});
