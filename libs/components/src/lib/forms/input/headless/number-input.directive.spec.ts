import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { mountNumberInput, NumberInputDriver } from '../../testing/number-input-driver';
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
      (valueChange)="value.set($event)"
      stepper
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
      (valueChange)="value.set($event)"
      (mixedChange)="mixed.set($event)"
      stepper
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
    let driver: NumberInputDriver<NumberInputInFormFieldTestHost>;

    beforeEach(() => {
      driver = mountNumberInput(NumberInputInFormFieldTestHost, { directiveSelector: '[etNumberInput]' });
    });

    it('should register with parent form field', () => {
      expect(driver.directive(FormFieldDirective).registeredControl()).toBeTruthy();
    });

    it('should compute labelId from registered label', () => {
      expect(driver.numberInput.labelId()).toMatch(/^et-label-\d+$/);
    });
  });

  describe('value and state', () => {
    let driver: NumberInputDriver<StandaloneNumberInputTestHost>;

    beforeEach(() => {
      driver = mountNumberInput(StandaloneNumberInputTestHost);
    });

    it('should have null value by default', () => {
      expect(driver.numberInput.value()).toBeNull();
      expect(driver.numberInput.hasValue()).toBe(false);
    });

    it('should sync a numeric native value', () => {
      driver.field().value = '42.5';
      driver.numberInput.syncFromNativeInput(driver.field());

      expect(driver.numberInput.value()).toBe(42.5);
      expect(driver.numberInput.hasValue()).toBe(true);
    });

    it('should sync an empty native value to null', () => {
      driver.field().value = '42';
      driver.numberInput.syncFromNativeInput(driver.field());
      driver.field().value = '';
      driver.numberInput.syncFromNativeInput(driver.field());

      expect(driver.numberInput.value()).toBeNull();
    });

    it('should expose the host input as nativeControl', () => {
      expect(driver.numberInput.nativeControl()).toBe(driver.field());
    });

    it('should not display error when not touched', () => {
      expect(driver.numberInput.shouldDisplayError()).toBe(false);
    });
  });

  describe('stepper', () => {
    let driver: NumberInputDriver<StepperTestHost>;

    beforeEach(() => {
      driver = mountNumberInput(StepperTestHost);
    });

    it('renders two out-of-tab-order stepper buttons', () => {
      expect(driver.stepperButtons().length).toBe(2);
      expect(driver.stepperButtons().every((button) => button.tabIndex === -1)).toBe(true);
    });

    it('steps up and down, starting an empty value from 0', () => {
      driver.pressStepper(1);
      expect(driver.host.value()).toBe(1);

      driver.pressStepper(1);
      expect(driver.host.value()).toBe(2);

      driver.pressStepper(0);
      expect(driver.host.value()).toBe(1);
    });

    it('clamps to the bounds and disables the exhausted button', () => {
      driver.host.max.set(2);
      driver.host.value.set(1);
      driver.tick();

      driver.pressStepper(1);
      expect(driver.host.value()).toBe(2);

      driver.tick();
      expect(driver.stepperButton(1).disabled).toBe(true);

      driver.pressStepper(1);
      expect(driver.host.value()).toBe(2);

      driver.host.min.set(0);
      driver.host.value.set(0);
      driver.tick();
      expect(driver.stepperButton(0).disabled).toBe(true);
    });

    it('steps fractional values without float noise', () => {
      driver.host.step.set(0.1);
      driver.host.value.set(0.2);
      driver.tick();

      driver.pressStepper(1);
      expect(driver.host.value()).toBe(0.3);
    });

    it('auto-repeats while held', () => {
      vi.useFakeTimers();

      try {
        driver.holdStepper(1);
        driver.tick();
        expect(driver.host.value()).toBe(1);

        // first repeat at the 400ms hold delay, then every 75ms
        vi.advanceTimersByTime(400);
        driver.tick();
        expect(driver.host.value()).toBe(2);

        vi.advanceTimersByTime(75 * 3);
        driver.tick();
        expect(driver.host.value()).toBe(5);

        driver.releaseStepper(1);
        vi.advanceTimersByTime(1000);
        driver.tick();
        expect(driver.host.value()).toBe(5);
      } finally {
        vi.useRealTimers();
      }
    });

    it('ignores stepping while disabled', () => {
      driver.host.disabled.set(true);
      driver.tick();

      driver.pressStepper(1);
      expect(driver.host.value()).toBeNull();
      expect(driver.stepperButtons().every((button) => button.disabled)).toBe(true);
    });
  });

  describe('coarse and fine stepping', () => {
    let driver: NumberInputDriver<StepperTestHost>;

    beforeEach(() => {
      driver = mountNumberInput(StepperTestHost);
      driver.host.value.set(0);
      driver.tick();
    });

    it('steps by one step on a plain arrow key', () => {
      const event = driver.press('ArrowUp');

      expect(driver.host.value()).toBe(1);
      // the browser would step the native input a second time on top of ours
      expect(event.defaultPrevented).toBe(true);

      driver.press('ArrowDown');
      expect(driver.host.value()).toBe(0);
    });

    it('steps 10x with shift and a tenth with alt', () => {
      driver.press('ArrowUp', { shiftKey: true });
      expect(driver.host.value()).toBe(10);

      driver.press('ArrowDown', { altKey: true });
      expect(driver.host.value()).toBe(9.9);
    });

    it('steps 100x on the page keys, whatever the modifiers', () => {
      driver.press('PageUp');
      expect(driver.host.value()).toBe(100);

      driver.press('PageDown', { shiftKey: true });
      expect(driver.host.value()).toBe(0);
    });

    it('multiplies a fractional step without float noise', () => {
      driver.host.step.set(0.1);
      driver.host.value.set(0.5);
      driver.tick();

      driver.press('ArrowUp', { altKey: true });
      expect(driver.host.value()).toBe(0.51);

      driver.press('ArrowUp', { shiftKey: true });
      expect(driver.host.value()).toBe(1.51);
    });

    it('clamps a multiplied step to the bounds', () => {
      driver.host.max.set(25);
      driver.tick();

      driver.press('ArrowUp', { shiftKey: true });
      driver.press('ArrowUp', { shiftKey: true });
      driver.press('ArrowUp', { shiftKey: true });

      expect(driver.host.value()).toBe(25);
    });

    it('leaves ctrl/cmd alone - it is a browser-zoom shortcut', () => {
      const event = driver.press('ArrowUp', { ctrlKey: true });

      expect(driver.host.value()).toBe(0);
      expect(event.defaultPrevented).toBe(false);
    });

    it('ignores keys it does not own', () => {
      const event = driver.press('ArrowLeft');

      expect(driver.host.value()).toBe(0);
      expect(event.defaultPrevented).toBe(false);
    });

    it('applies the modifier to a stepper button press too', () => {
      driver.pressStepper(1, { shiftKey: true });
      expect(driver.host.value()).toBe(10);

      driver.pressStepper(0, { altKey: true });
      expect(driver.host.value()).toBe(9.9);
    });
  });

  describe('drag to scrub', () => {
    let driver: NumberInputDriver<StepperTestHost>;

    beforeEach(() => {
      driver = mountNumberInput(StepperTestHost);
      driver.host.value.set(0);
      driver.tick();
    });

    it('runs the value while dragging sideways, one step per 4px past the commit threshold', () => {
      // the press steps once (1), the first 10px commits the drag and is swallowed as catch-up,
      // then 20px of travel is 5 steps
      driver.scrub(1, [10, 20]);

      expect(driver.host.value()).toBe(6);
    });

    it('scrubs down when dragged left, whichever button started it', () => {
      driver.scrub(1, [-10, -20]);

      expect(driver.host.value()).toBe(-4);
    });

    it('keeps the sub-step remainder so a slow drag still moves', () => {
      // three 3px moves are under one 4px step each, but 9px of travel is two steps
      driver.scrub(1, [10, 3, 3, 3]);

      expect(driver.host.value()).toBe(3);
    });

    it('does not commit a press that never crosses the threshold', () => {
      driver.scrub(1, [3]);

      expect(driver.host.value()).toBe(1);
    });

    it('carries the press-time modifier into the scrub', () => {
      driver.scrub(1, [10, 20], { shiftKey: true });

      expect(driver.host.value()).toBe(60);
    });

    it('marks touched once at the end of the gesture, not per step', () => {
      driver.pointer(driver.stepperButton(1), 'pointerdown', {
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        pointerType: 'mouse',
      });
      driver.numberInput.touched.set(false);

      driver.dragPointer(10);
      driver.dragPointer(30);
      driver.tick();

      expect(driver.numberInput.touched()).toBe(false);

      driver.pointer(document, 'pointerup', { pointerId: 1, clientX: 30, clientY: 0 });

      expect(driver.numberInput.touched()).toBe(true);
    });

    it('cancels the press-and-hold repeat once the drag commits', () => {
      vi.useFakeTimers();

      try {
        driver.pointer(driver.stepperButton(1), 'pointerdown', {
          pointerId: 1,
          clientX: 0,
          clientY: 0,
          pointerType: 'mouse',
        });

        driver.dragPointer(10);
        driver.tick();

        vi.advanceTimersByTime(400 + 75 * 10);
        driver.tick();

        // the one step from the press, and nothing from the repeat timer
        expect(driver.host.value()).toBe(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not scrub from a touch pointer', () => {
      driver.scrub(1, [10, 20], { pointerType: 'touch' });

      expect(driver.host.value()).toBe(1);
    });

    it('clears the document scrub cursor when the gesture is cancelled', () => {
      driver.scrub(1, [10, 20], { release: 'pointercancel' });

      expect(document.documentElement.classList.contains('et-number-input-scrubbing')).toBe(false);
    });
  });

  describe('mixed state', () => {
    const setup = () => {
      const driver = mountNumberInput(MixedNumberInputTestHost);

      return {
        driver,
        enterMixed: (rawValue: number) => {
          driver.host.value.set(rawValue);
          driver.host.mixed.set(true);
          driver.tick();
        },
      };
    };

    describeMixedStateContract(() => {
      const { driver, enterMixed } = setup();

      return {
        enterMixed: () => enterMixed(42),
        rawValue: () => 42,
        value: () => driver.host.value(),
        mixed: () => driver.host.mixed(),
        hostElement: () => driver.element(),
        writeValueExternally: () => {
          driver.host.value.set(7);
          driver.tick();
        },
        externallyWrittenValue: () => 7,
        resolveMixedFromConsumer: () => {
          driver.host.mixed.set(false);
          driver.tick();
        },
        mixedLabel: () => 'Mixed values',
        mixedDisplayText: () => driver.placeholder(),
        commit: () => driver.type('5'),
        committedValue: () => 5,
        assertMasked: () => {
          expect(driver.fieldValue()).toBe('');
          expect(driver.placeholder()).toBe('Mixed values');
        },
      };
    });

    it('steps from 0 over a mixed value and resolves it - never from the hidden raw value', () => {
      const { driver, enterMixed } = setup();

      enterMixed(42);
      driver.pressStepper(1);

      expect(driver.host.mixed()).toBe(false);
      expect(driver.host.value()).toBe(1);
    });

    it('keeps mixed and the raw value when an edit produces no content', () => {
      const { driver, enterMixed } = setup();

      enterMixed(42);
      driver.type('');

      expect(driver.host.mixed()).toBe(true);
      expect(driver.host.value()).toBe(42);
    });
  });
});
