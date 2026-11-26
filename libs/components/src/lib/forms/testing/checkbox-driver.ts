import { Provider, Type } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { ControlDriverOptions, createControlDriver, mountControl } from '../../testing/control-driver';
import { focusEvent } from '../../testing/driver-core';
import { CheckboxDirective } from '../checkbox/headless';

const CHECKBOX = '[etCheckbox]';

export const createCheckboxDriver = <T>(fixture: ComponentFixture<T>, options: ControlDriverOptions = {}) => {
  const base = createControlDriver(fixture, CheckboxDirective, { directiveSelector: CHECKBOX, ...options });

  const checkboxEl = () => base.query(CHECKBOX)!;

  return {
    ...base,
    checkbox: base.control,

    checkboxEl,
    attr: (name: string) => checkboxEl().getAttribute(name),
    toggle: () => base.click(checkboxEl()),
    blur: () => focusEvent(checkboxEl(), 'blur'),
  };
};

export type CheckboxDriver<T> = ReturnType<typeof createCheckboxDriver<T>>;

export const mountCheckbox = <T>(component: Type<T>, options: ControlDriverOptions = {}, providers: Provider[] = []) =>
  createCheckboxDriver(mountControl(component, providers), options);
