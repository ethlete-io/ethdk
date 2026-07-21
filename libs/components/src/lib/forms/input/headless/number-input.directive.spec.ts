import { Component, DebugElement, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../../test-helpers';
import { FormFieldDirective, LabelDirective } from '../../form-field/headless';
import { describeMixedStateContract } from '../../testing/mixed-state-contract';
import { NUMBER_INPUT_IMPORTS } from '../input.imports';
import { NumberInputDirective } from './number-input.directive';

@Component({
  template: `
    <div etFormField>
      <et-label>Amount</et-label>
      <input etNumberInput type="number" placeholder="0" />
    </div>
  `,
  imports: [NumberInputDirective, FormFieldDirective, LabelDirective],
})
class NumberInputInFormFieldTestHost {}

@Component({
  template: `<input etNumberInput type="number" placeholder="standalone" />`,
  imports: [NumberInputDirective],
})
class StandaloneNumberInputTestHost {}

@Component({
  template: `
    <et-number-input
      [value]="value()"
      [min]="min()"
      [max]="max()"
      [step]="step()"
      [disabled]="disabled()"
      [stepper]="true"
      (valueChange)="value.set($event)"
    />
  `,
  imports: [NUMBER_INPUT_IMPORTS],
})
class StepperTestHost {
  value = signal<number | null>(null);
  min = signal<number | undefined>(undefined);
  max = signal<number | undefined>(undefined);
  step = signal<number | null>(null);
  disabled = signal(false);
}

@Component({
  template: `
    <et-number-input
      [value]="value()"
      [mixed]="mixed()"
      [stepper]="true"
      (valueChange)="value.set($event)"
      (mixedChange)="mixed.set($event)"
      mixedLabel="Mixed values"
      placeholder="Amount"
    />
  `,
  imports: [NUMBER_INPUT_IMPORTS],
})
class MixedNumberInputTestHost {
  value = signal<number | null>(null);
  mixed = signal(false);
}

describe('NumberInputDirective', () => {
  describe('inside form field', () => {
    let fixture: ComponentFixture<NumberInputInFormFieldTestHost>;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [NumberInputInFormFieldTestHost] });
      fixture = TestBed.createComponent(NumberInputInFormFieldTestHost);
      fixture.detectChanges();
    });

    it('should register with parent form field', () => {
      const formFieldDir = (fixture.debugElement.children[0] as DebugElement).injector.get(FormFieldDirective);
      expect(formFieldDir.registeredControl()).toBeTruthy();
    });

    it('should compute labelId from registered label', () => {
      const numberInputDir = (fixture.debugElement.children[0] as DebugElement)
        .query((el) => el.nativeElement.matches('[etNumberInput]'))
        .injector.get(NumberInputDirective);

      expect(numberInputDir.labelId()).toMatch(/^et-label-\d+$/);
    });
  });

  describe('value and state', () => {
    let fixture: ComponentFixture<StandaloneNumberInputTestHost>;
    let numberInputDir: NumberInputDirective;
    let nativeInput: HTMLInputElement;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [StandaloneNumberInputTestHost] });
      fixture = TestBed.createComponent(StandaloneNumberInputTestHost);
      fixture.detectChanges();
      numberInputDir = (fixture.debugElement.children[0] as DebugElement).injector.get(NumberInputDirective);
      nativeInput = fixture.nativeElement.querySelector('[etNumberInput]');
    });

    it('should have null value by default', () => {
      expect(numberInputDir.value()).toBeNull();
      expect(numberInputDir.hasValue()).toBe(false);
    });

    it('should sync a numeric native value', () => {
      nativeInput.value = '42.5';
      numberInputDir.syncFromNativeInput(nativeInput);

      expect(numberInputDir.value()).toBe(42.5);
      expect(numberInputDir.hasValue()).toBe(true);
    });

    it('should sync an empty native value to null', () => {
      nativeInput.value = '42';
      numberInputDir.syncFromNativeInput(nativeInput);
      nativeInput.value = '';
      numberInputDir.syncFromNativeInput(nativeInput);

      expect(numberInputDir.value()).toBeNull();
    });

    it('should expose the host input as nativeControl', () => {
      expect(numberInputDir.nativeControl()).toBe(nativeInput);
    });

    it('should not display error when not touched', () => {
      expect(numberInputDir.shouldDisplayError()).toBe(false);
    });
  });

  describe('stepper', () => {
    let fixture: ComponentFixture<StepperTestHost>;

    const buttons = () =>
      Array.from(fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.et-number-input-stepper-button'));

    const press = (index: number) => {
      const button = buttons()[index]!;

      button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      button.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
      fixture.detectChanges();
    };

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [StepperTestHost] });
      fixture = TestBed.createComponent(StepperTestHost);
      fixture.detectChanges();
    });

    it('renders two out-of-tab-order stepper buttons', () => {
      expect(buttons().length).toBe(2);
      expect(buttons().every((button) => button.tabIndex === -1)).toBe(true);
    });

    it('steps up and down, starting an empty value from 0', () => {
      press(1);
      expect(fixture.componentInstance.value()).toBe(1);

      press(1);
      expect(fixture.componentInstance.value()).toBe(2);

      press(0);
      expect(fixture.componentInstance.value()).toBe(1);
    });

    it('clamps to the bounds and disables the exhausted button', () => {
      fixture.componentInstance.max.set(2);
      fixture.componentInstance.value.set(1);
      fixture.detectChanges();

      press(1);
      expect(fixture.componentInstance.value()).toBe(2);

      fixture.detectChanges();
      expect(buttons()[1]!.disabled).toBe(true);

      press(1);
      expect(fixture.componentInstance.value()).toBe(2);

      fixture.componentInstance.min.set(0);
      fixture.componentInstance.value.set(0);
      fixture.detectChanges();
      expect(buttons()[0]!.disabled).toBe(true);
    });

    it('steps fractional values without float noise', () => {
      fixture.componentInstance.step.set(0.1);
      fixture.componentInstance.value.set(0.2);
      fixture.detectChanges();

      press(1);
      expect(fixture.componentInstance.value()).toBe(0.3);
    });

    it('auto-repeats while held', () => {
      vi.useFakeTimers();

      try {
        const button = buttons()[1]!;

        button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        fixture.detectChanges();
        expect(fixture.componentInstance.value()).toBe(1);

        // first repeat at the 400ms hold delay, then every 75ms
        vi.advanceTimersByTime(400);
        fixture.detectChanges();
        expect(fixture.componentInstance.value()).toBe(2);

        vi.advanceTimersByTime(75 * 3);
        fixture.detectChanges();
        expect(fixture.componentInstance.value()).toBe(5);

        button.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
        vi.advanceTimersByTime(1000);
        fixture.detectChanges();
        expect(fixture.componentInstance.value()).toBe(5);
      } finally {
        vi.useRealTimers();
      }
    });

    it('ignores stepping while disabled', () => {
      fixture.componentInstance.disabled.set(true);
      fixture.detectChanges();

      press(1);
      expect(fixture.componentInstance.value()).toBeNull();
      expect(buttons().every((button) => button.disabled)).toBe(true);
    });
  });

  describe('mixed state', () => {
    const setup = () => {
      TestBed.configureTestingModule({ imports: [MixedNumberInputTestHost] });

      const fixture = TestBed.createComponent(MixedNumberInputTestHost);

      fixture.detectChanges();

      const host = fixture.componentInstance;
      const nativeInput = () => fixture.nativeElement.querySelector('input') as HTMLInputElement;
      const typeInto = (text: string) => {
        const inputElement = nativeInput();

        inputElement.value = text;
        inputElement.dispatchEvent(new InputEvent('input', { bubbles: true }));
        fixture.detectChanges();
      };
      const enterMixed = (rawValue: number) => {
        host.value.set(rawValue);
        host.mixed.set(true);
        fixture.detectChanges();
      };
      const press = (index: number) => {
        const button = fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.et-number-input-stepper-button')[
          index
        ]!;

        button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        button.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
        fixture.detectChanges();
      };

      return { fixture, host, nativeInput, typeInto, enterMixed, press };
    };

    describeMixedStateContract(() => {
      const { fixture, host, nativeInput, typeInto, enterMixed } = setup();

      return {
        enterMixed: () => enterMixed(42),
        rawValue: () => 42,
        value: () => host.value(),
        mixed: () => host.mixed(),
        hostElement: () => fixture.nativeElement.querySelector('et-number-input') as HTMLElement,
        writeValueExternally: () => {
          host.value.set(7);
          fixture.detectChanges();
        },
        externallyWrittenValue: () => 7,
        commit: () => typeInto('5'),
        committedValue: () => 5,
        assertMasked: () => {
          expect(nativeInput().value).toBe('');
          expect(nativeInput().placeholder).toBe('Mixed values');
        },
      };
    });

    it('steps from 0 over a mixed value and resolves it — never from the hidden raw value', () => {
      const { host, enterMixed, press } = setup();

      enterMixed(42);
      press(1);

      expect(host.mixed()).toBe(false);
      expect(host.value()).toBe(1);
    });

    it('keeps mixed and the raw value when an edit produces no content', () => {
      const { host, typeInto, enterMixed } = setup();

      enterMixed(42);
      typeInto('');

      expect(host.mixed()).toBe(true);
      expect(host.value()).toBe(42);
    });
  });
});
