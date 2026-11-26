import { Provider, Type } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { mountControl } from '../../testing/control-driver';
import { createFieldControlDriver, FieldControlDriverOptions } from '../../testing/field-control-driver';
import { InputDirective } from '../input/headless/input.directive';

/** Driver for the plain `et-input` / `[etInput]` text-field shell - the base every other text field builds on. */
export const createInputDriver = <T>(fixture: ComponentFixture<T>, options: FieldControlDriverOptions = {}) => {
  const base = createFieldControlDriver(fixture, InputDirective, options);

  return {
    ...base,
    input: base.control,
  };
};

export type InputDriver<T> = ReturnType<typeof createInputDriver<T>>;

export const mountInput = <T>(
  component: Type<T>,
  options: FieldControlDriverOptions = {},
  providers: Provider[] = [],
) => createInputDriver(mountControl(component, providers), options);
