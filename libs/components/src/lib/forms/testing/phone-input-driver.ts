import { Provider, Type } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { mountControl } from '../../testing/control-driver';
import { createFieldControlDriver, FieldControlDriverOptions } from '../../testing/field-control-driver';
import { PhoneInputDirective } from '../phone-input/headless';

const FIELD = '.et-phone-input-field';

export const createPhoneInputDriver = <T>(fixture: ComponentFixture<T>, options: FieldControlDriverOptions = {}) => {
  const base = createFieldControlDriver(fixture, PhoneInputDirective, { fieldSelector: FIELD, ...options });

  return {
    ...base,
    phone: base.control,

    hostEl: () => base.query('et-phone-input')!,
    clearButton: () => base.query<HTMLButtonElement>('.et-input-clear'),

    selectCountry: (iso2: string) => {
      base.control.selectCountry(iso2);
      base.tick();
    },
    clearValue: () => {
      base.control.clearValue();
      base.tick();
    },
  };
};

export type PhoneInputDriver<T> = ReturnType<typeof createPhoneInputDriver<T>>;

export const mountPhoneInput = <T>(
  component: Type<T>,
  options: FieldControlDriverOptions = {},
  providers: Provider[] = [],
) => createPhoneInputDriver(mountControl(component, providers), options);
