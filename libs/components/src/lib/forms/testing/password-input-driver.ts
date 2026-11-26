import { Provider, Type } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { mountControl } from '../../testing/control-driver';
import { createFieldControlDriver, FieldControlDriverOptions } from '../../testing/field-control-driver';
import { PasswordInputDirective } from '../input/headless/password-input.directive';

export const createPasswordInputDriver = <T>(fixture: ComponentFixture<T>, options: FieldControlDriverOptions = {}) => {
  const base = createFieldControlDriver(fixture, PasswordInputDirective, options);

  const revealButton = () => base.query<HTMLButtonElement>('.et-password-input-reveal');

  return {
    ...base,
    passwordInput: base.control,

    fieldType: () => base.field().type,
    revealButton,
    capsWarning: () => base.query('.et-password-input-caps-warning'),

    clickReveal: () => base.click(revealButton()!),
    pressWithCapsLock: (capsLock: boolean, key = 'a') => base.press(key, { modifierCapsLock: capsLock }),
  };
};

export type PasswordInputDriver<T> = ReturnType<typeof createPasswordInputDriver<T>>;

export const mountPasswordInput = <T>(
  component: Type<T>,
  options: FieldControlDriverOptions = {},
  providers: Provider[] = [],
) => createPasswordInputDriver(mountControl(component, providers), options);
