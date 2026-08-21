import { Component, DebugElement, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../../test-helpers';
import { FormFieldDirective, LabelDirective } from '../../form-field/headless';
import { describeMixedStateContract } from '../../testing/mixed-state-contract';
import { TEXTAREA_IMPORTS } from '../textarea.imports';
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
  template: `
    <textarea [autosize]="autosize()" [rows]="rows()" [minRows]="minRows()" [maxRows]="maxRows()" etTextarea></textarea>
  `,
  imports: [TextareaDirective],
})
class StandaloneTextareaTestHost {
  autosize = signal(true);
  rows = signal(3);
  minRows = signal<number | null>(null);
  maxRows = signal<number | null>(null);
}

@Component({
  template: `
    <et-textarea
      [value]="value()"
      [mixed]="mixed()"
      (valueChange)="value.set($event)"
      (mixedChange)="mixed.set($event)"
      mixedLabel="Mixed values"
      placeholder="Write here"
    />
  `,
  imports: [TEXTAREA_IMPORTS],
})
class MixedTextareaTestHost {
  value = signal('');
  mixed = signal(false);
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

    describe('native autosize hooks', () => {
      it('should mark the textarea and derive the row floor from rows', () => {
        expect(nativeTextarea.hasAttribute('data-et-textarea-autosize')).toBe(true);
        expect(nativeTextarea.style.getPropertyValue('--et-textarea-min-rows')).toBe('3');
      });

      it('should prefer minRows over rows for the row floor', () => {
        fixture.componentInstance.minRows.set(5);
        fixture.detectChanges();

        expect(nativeTextarea.style.getPropertyValue('--et-textarea-min-rows')).toBe('5');
      });

      it('should set no upper bound while maxRows is null', () => {
        expect(nativeTextarea.style.getPropertyValue('--et-textarea-max-block-size')).toBe('');
      });

      it('should turn maxRows into a line-based upper bound', () => {
        fixture.componentInstance.maxRows.set(6);
        fixture.detectChanges();

        expect(nativeTextarea.style.getPropertyValue('--et-textarea-max-block-size')).toBe('calc(6 * 1lh)');
      });

      it('should remove every hook when autosize is turned off', () => {
        fixture.componentInstance.maxRows.set(6);
        fixture.detectChanges();
        fixture.componentInstance.autosize.set(false);
        fixture.detectChanges();

        expect(nativeTextarea.hasAttribute('data-et-textarea-autosize')).toBe(false);
        expect(nativeTextarea.style.getPropertyValue('--et-textarea-min-rows')).toBe('');
        expect(nativeTextarea.style.getPropertyValue('--et-textarea-max-block-size')).toBe('');
      });
    });
  });

  describe('mixed state', () => {
    const setup = () => {
      TestBed.configureTestingModule({ imports: [MixedTextareaTestHost] });

      const fixture = TestBed.createComponent(MixedTextareaTestHost);

      fixture.detectChanges();

      const host = fixture.componentInstance;
      const nativeTextarea = () => fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
      const typeInto = (text: string) => {
        const textareaElement = nativeTextarea();

        textareaElement.value = text;
        textareaElement.dispatchEvent(new InputEvent('input', { bubbles: true }));
        fixture.detectChanges();
      };
      const enterMixed = (rawValue: string) => {
        host.value.set(rawValue);
        host.mixed.set(true);
        fixture.detectChanges();
      };

      return { fixture, host, nativeTextarea, typeInto, enterMixed };
    };

    describeMixedStateContract(() => {
      const { fixture, host, nativeTextarea, typeInto, enterMixed } = setup();

      return {
        enterMixed: () => enterMixed('hidden raw\nsecond line'),
        rawValue: () => 'hidden raw\nsecond line',
        value: () => host.value(),
        mixed: () => host.mixed(),
        hostElement: () => fixture.nativeElement.querySelector('et-textarea') as HTMLElement,
        writeValueExternally: () => {
          host.value.set('server write');
          fixture.detectChanges();
        },
        externallyWrittenValue: () => 'server write',
        commit: () => typeInto('typed over'),
        committedValue: () => 'typed over',
        assertMasked: () => {
          expect(nativeTextarea().value).toBe('');
          expect(nativeTextarea().placeholder).toBe('Mixed values');
        },
      };
    });

    it('masks via the placeholder and restores the consumer placeholder after the commit', () => {
      const { nativeTextarea, typeInto, enterMixed } = setup();

      enterMixed('secret');

      expect(nativeTextarea().value).toBe('');
      expect(nativeTextarea().placeholder).toBe('Mixed values');

      typeInto('new text');

      expect(nativeTextarea().value).toBe('new text');
      expect(nativeTextarea().placeholder).toBe('Write here');
    });

    it('keeps mixed and the raw value when an edit produces no content', () => {
      const { host, typeInto, enterMixed } = setup();

      enterMixed('secret');
      typeInto('');

      expect(host.mixed()).toBe(true);
      expect(host.value()).toBe('secret');
    });
  });
});
