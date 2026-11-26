import { Provider, Type } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { mountControl } from '../../testing/control-driver';
import { createFieldControlDriver, FieldControlDriverOptions } from '../../testing/field-control-driver';
import { DurationInputDirective } from '../date-time/duration-input/headless/duration-input.directive';

export const createDurationInputDriver = <T>(fixture: ComponentFixture<T>, options: FieldControlDriverOptions = {}) => {
  const base = createFieldControlDriver(fixture, DurationInputDirective, options);

  return {
    ...base,
    durationInput: base.control,

    enter: () => base.press('Enter'),
  };
};

export type DurationInputDriver<T> = ReturnType<typeof createDurationInputDriver<T>>;

export const mountDurationInput = <T>(
  component: Type<T>,
  options: FieldControlDriverOptions = {},
  providers: Provider[] = [],
) => createDurationInputDriver(mountControl(component, providers), options);
