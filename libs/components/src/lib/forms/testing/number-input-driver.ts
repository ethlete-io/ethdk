import { Provider, Type } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { mountControl } from '../../testing/control-driver';
import { pointerEvent, tick } from '../../testing/driver-core';
import { createFieldControlDriver, FieldControlDriverOptions } from '../../testing/field-control-driver';
import { NumberInputDirective } from '../input/headless/number-input.directive';

export type ScrubOptions = {
  pointerType?: string;
  shiftKey?: boolean;
  release?: 'pointerup' | 'pointercancel';
};

const STEPPER_BUTTON = '.et-number-input-stepper-button';

export const createNumberInputDriver = <T>(fixture: ComponentFixture<T>, options: FieldControlDriverOptions = {}) => {
  const base = createFieldControlDriver(fixture, NumberInputDirective, options);

  const stepperButtons = () => base.queryAll<HTMLButtonElement>(STEPPER_BUTTON);
  const stepperButton = (index: number) => stepperButtons()[index]!;

  return {
    ...base,
    numberInput: base.control,

    stepperButtons,
    stepperButton,

    pressStepper: (index: number, modifiers: MouseEventInit = {}) => {
      const button = stepperButton(index);

      button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, ...modifiers }));
      button.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
      tick();
    },
    holdStepper: (index: number) =>
      stepperButton(index).dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })),
    releaseStepper: (index: number) =>
      stepperButton(index).dispatchEvent(new MouseEvent('pointerup', { bubbles: true })),

    /** Presses a stepper button, drags the pointer through `steps` px of travel, then releases. */
    scrub: (index: number, steps: number[], options: ScrubOptions = {}) => {
      const { pointerType = 'mouse', shiftKey = false, release = 'pointerup' } = options;

      pointerEvent(stepperButton(index), 'pointerdown', {
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        pointerType,
        shiftKey,
      });

      let x = 0;

      for (const step of steps) {
        x += step;
        document.dispatchEvent(
          new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: x, clientY: 0 }),
        );
      }

      tick();
      pointerEvent(document, release, { pointerId: 1, clientX: x, clientY: 0 });
    },
    dragPointer: (x: number) =>
      document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: x, clientY: 0 })),
  };
};

export type NumberInputDriver<T> = ReturnType<typeof createNumberInputDriver<T>>;

export const mountNumberInput = <T>(
  component: Type<T>,
  options: FieldControlDriverOptions = {},
  providers: Provider[] = [],
) => createNumberInputDriver(mountControl(component, providers), options);
