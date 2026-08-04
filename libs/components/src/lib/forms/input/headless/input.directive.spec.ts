import { Component, DebugElement, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form, FormField } from '@angular/forms/signals';
import '../../../../test-helpers';
import { FormFieldDirective, LabelDirective } from '../../form-field/headless';
import { MASKED_INPUT_IMPORTS } from '../../masked-input/masked-input.imports';
import { describeMixedStateContract } from '../../testing/mixed-state-contract';
import { INPUT_IMPORTS } from '../input.imports';
import { InputDirective } from './input.directive';

@Component({
  template: `
    <div etFormField>
      <et-label>Email</et-label>
      <input etInput type="email" placeholder="test@example.com" />
    </div>
  `,
  imports: [InputDirective, FormFieldDirective, LabelDirective],
})
class InputInFormFieldTestHost {}

@Component({
  template: `<input etInput type="text" placeholder="standalone" />`,
  imports: [InputDirective],
})
class StandaloneInputTestHost {}

@Component({
  template: `
    <et-input
      [value]="value()"
      [mixed]="mixed()"
      (valueChange)="value.set($event)"
      (mixedChange)="mixed.set($event)"
      mixedLabel="Mixed values"
      placeholder="Type here"
    />
  `,
  imports: [INPUT_IMPORTS],
})
class MixedInputTestHost {
  value = signal('');
  mixed = signal(false);
}

@Component({
  template: `
    <et-input
      [value]="value()"
      [mixed]="mixed()"
      (valueChange)="value.set($event)"
      (mixedChange)="mixed.set($event)"
      etInputMask="00-00"
      mixedLabel="Mixed values"
    />
  `,
  imports: [INPUT_IMPORTS, MASKED_INPUT_IMPORTS],
})
class MixedMaskedInputTestHost {
  value = signal('');
  mixed = signal(false);
}

@Component({
  template: `<et-input aria-label="Search products" />`,
  imports: [INPUT_IMPORTS],
})
class AriaLabelInputTestHost {}

@Component({
  template: `<input [formField]="searchForm.search" etInput />`,
  imports: [InputDirective, FormField],
})
class NullableFieldTestHost {
  // A nullable string field, e.g. the query form's search field while it is empty.
  public model = signal<{ search: string | null }>({ search: null });
  public searchForm = form(this.model);
}

@Component({
  template: `
    <div etFormField>
      <et-label>Projected label</et-label>
      <et-input aria-labelledby="external-label-id" />
    </div>
  `,
  imports: [INPUT_IMPORTS, FormFieldDirective, LabelDirective],
})
class AriaLabelledbyOverrideTestHost {}

describe('InputDirective', () => {
  describe('accessible name forwarding', () => {
    it('forwards a consumer aria-label onto the native input', () => {
      TestBed.configureTestingModule({ imports: [AriaLabelInputTestHost] });
      const fixture = TestBed.createComponent(AriaLabelInputTestHost);
      fixture.detectChanges();

      const native = fixture.nativeElement.querySelector('.et-input-native') as HTMLInputElement;
      expect(native.getAttribute('aria-label')).toBe('Search products');
    });

    it('lets a consumer aria-labelledby override the projected label id', () => {
      TestBed.configureTestingModule({ imports: [AriaLabelledbyOverrideTestHost] });
      const fixture = TestBed.createComponent(AriaLabelledbyOverrideTestHost);
      fixture.detectChanges();

      const native = fixture.nativeElement.querySelector('.et-input-native') as HTMLInputElement;
      expect(native.getAttribute('aria-labelledby')).toBe('external-label-id');
    });
  });

  describe('inside form field', () => {
    let fixture: ComponentFixture<InputInFormFieldTestHost>;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [InputInFormFieldTestHost] });
      fixture = TestBed.createComponent(InputInFormFieldTestHost);
      fixture.detectChanges();
    });

    it('should create', () => {
      const inputEl = fixture.nativeElement.querySelector('[etInput]');
      expect(inputEl).toBeTruthy();
    });

    it('should register with parent form field', () => {
      const formFieldDir = (fixture.debugElement.children[0] as DebugElement).injector.get(FormFieldDirective);
      expect(formFieldDir.registeredControl()).toBeTruthy();
    });

    it('should compute labelId from registered label', () => {
      const inputDir = (fixture.debugElement.children[0] as DebugElement)
        .query((el) => el.nativeElement.matches('[etInput]'))
        .injector.get(InputDirective);

      expect(inputDir.labelId()).toMatch(/^et-label-\d+$/);
    });

    it('should have null describedBy when no error or hint is present', () => {
      const inputDir = (fixture.debugElement.children[0] as DebugElement)
        .query((el) => el.nativeElement.matches('[etInput]'))
        .injector.get(InputDirective);

      // describedBy is only set by the form field when there is an active error or hint
      expect(inputDir.describedBy()).toBeNull();
    });
  });

  describe('standalone', () => {
    let fixture: ComponentFixture<StandaloneInputTestHost>;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [StandaloneInputTestHost] });
      fixture = TestBed.createComponent(StandaloneInputTestHost);
      fixture.detectChanges();
    });

    it('should create without a parent form field', () => {
      const inputEl = fixture.nativeElement.querySelector('[etInput]');
      expect(inputEl).toBeTruthy();
    });

    it('should have null labelId without parent', () => {
      const inputDir = (fixture.debugElement.children[0] as DebugElement).injector.get(InputDirective);
      expect(inputDir.labelId()).toBeNull();
    });

    it('should have null describedBy without parent', () => {
      const inputDir = (fixture.debugElement.children[0] as DebugElement).injector.get(InputDirective);
      expect(inputDir.describedBy()).toBeNull();
    });
  });

  describe('value and state', () => {
    let fixture: ComponentFixture<StandaloneInputTestHost>;
    let inputDir: InputDirective;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [StandaloneInputTestHost] });
      fixture = TestBed.createComponent(StandaloneInputTestHost);
      fixture.detectChanges();
      inputDir = (fixture.debugElement.children[0] as DebugElement).injector.get(InputDirective);
    });

    it('should have empty value by default', () => {
      expect(inputDir.value()).toBe('');
    });

    it('should not display error when not touched', () => {
      expect(inputDir.shouldDisplayError()).toBe(false);
    });

    it('should have text type by default', () => {
      expect(inputDir.type()).toBe('text');
    });
  });

  describe('nullable bound field', () => {
    let fixture: ComponentFixture<NullableFieldTestHost>;
    let inputDir: InputDirective;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [NullableFieldTestHost] });
      fixture = TestBed.createComponent(NullableFieldTestHost);
      fixture.detectChanges();
      inputDir = (fixture.debugElement.children[0] as DebugElement).injector.get(InputDirective);
    });

    it('reads a null value as empty', () => {
      expect(inputDir.hasValue()).toBe(false);
      expect(inputDir.displayValue()).toBe('');
    });

    it('reports a value once the field holds text', () => {
      fixture.componentInstance.model.set({ search: 'angular' });
      fixture.detectChanges();

      expect(inputDir.hasValue()).toBe(true);
      expect(inputDir.displayValue()).toBe('angular');
    });
  });

  describe('mixed state', () => {
    const setup = () => {
      TestBed.configureTestingModule({ imports: [MixedInputTestHost] });

      const fixture = TestBed.createComponent(MixedInputTestHost);

      fixture.detectChanges();

      const host = fixture.componentInstance;
      const nativeInput = () => fixture.nativeElement.querySelector('input') as HTMLInputElement;
      const typeInto = (text: string) => {
        const inputElement = nativeInput();

        inputElement.value = text;
        inputElement.dispatchEvent(new InputEvent('input', { bubbles: true }));
        fixture.detectChanges();
      };
      const enterMixed = (rawValue: string) => {
        host.value.set(rawValue);
        host.mixed.set(true);
        fixture.detectChanges();
      };

      return { fixture, host, nativeInput, typeInto, enterMixed };
    };

    describeMixedStateContract(() => {
      const { fixture, host, nativeInput, typeInto, enterMixed } = setup();

      return {
        enterMixed: () => enterMixed('hidden raw'),
        rawValue: () => 'hidden raw',
        value: () => host.value(),
        mixed: () => host.mixed(),
        hostElement: () => fixture.nativeElement.querySelector('et-input') as HTMLElement,
        writeValueExternally: () => {
          host.value.set('server write');
          fixture.detectChanges();
        },
        externallyWrittenValue: () => 'server write',
        commit: () => typeInto('typed over'),
        committedValue: () => 'typed over',
        assertMasked: () => {
          expect(nativeInput().value).toBe('');
          expect(nativeInput().placeholder).toBe('Mixed values');
        },
      };
    });

    it('masks via the placeholder and restores the consumer placeholder after the commit', () => {
      const { nativeInput, typeInto, enterMixed } = setup();

      enterMixed('secret');

      expect(nativeInput().value).toBe('');
      expect(nativeInput().placeholder).toBe('Mixed values');

      typeInto('new text');

      expect(nativeInput().value).toBe('new text');
      expect(nativeInput().placeholder).toBe('Type here');
    });

    it('keeps mixed and the raw value when an edit produces no content', () => {
      const { host, nativeInput, typeInto, enterMixed } = setup();

      enterMixed('secret');
      typeInto('');

      expect(host.mixed()).toBe(true);
      expect(host.value()).toBe('secret');
      expect(nativeInput().placeholder).toBe('Mixed values');
    });

    it('keeps an input mask from repainting the hidden raw value and commits typed content through it', async () => {
      TestBed.configureTestingModule({ imports: [MixedMaskedInputTestHost] });

      const fixture = TestBed.createComponent(MixedMaskedInputTestHost);

      fixture.detectChanges();
      await fixture.whenStable();

      const host = fixture.componentInstance;
      const inputElement = fixture.nativeElement.querySelector('input') as HTMLInputElement;

      host.value.set('1234');
      host.mixed.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      // the mask's display enforcement must not leak the masked raw value into the DOM
      expect(inputElement.value).toBe('');
      expect(inputElement.placeholder).toBe('Mixed values');
      expect(host.value()).toBe('1234');

      inputElement.value = '5';
      inputElement.setSelectionRange(1, 1);
      inputElement.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
      fixture.detectChanges();
      await fixture.whenStable();

      // replace semantics: the commit starts from an empty committed raw, not the hidden '1234'
      expect(host.mixed()).toBe(false);
      expect(host.value()).toBe('5');
      expect(inputElement.value).toBe('5');
    });

    it('exposes data-mixed on a standalone headless input host', () => {
      TestBed.configureTestingModule({ imports: [StandaloneInputTestHost] });

      const fixture = TestBed.createComponent(StandaloneInputTestHost);

      fixture.detectChanges();

      const inputDir = (fixture.debugElement.children[0] as DebugElement).injector.get(InputDirective);

      inputDir.mixed.set(true);
      fixture.detectChanges();

      const inputElement = fixture.nativeElement.querySelector('[etInput]') as HTMLInputElement;

      expect(inputElement.getAttribute('data-mixed')).toBe('true');
      expect(inputDir.hasValue()).toBe(true);
    });
  });
});
