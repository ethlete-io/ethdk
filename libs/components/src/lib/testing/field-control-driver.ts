import { Provider, Type } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { ControlDriverOptions, createControlDriver, mountControl } from './control-driver';
import { blurField, focusField, pointerEvent, pressKey, setInputValue, typeChars } from './driver-core';

export type FieldControlDriverOptions = ControlDriverOptions & {
  /** Matches the editable field, when it is not the host's only `input`. */
  fieldSelector?: string;
};

/**
 * The plumbing every text-field form control driver needs: the host component, the directive, the
 * native field, and the value / focus / key events a user produces on it.
 */
export const createFieldControlDriver = <T, D>(
  fixture: ComponentFixture<T>,
  directiveType: Type<D>,
  { fieldSelector = 'input', ...controlOptions }: FieldControlDriverOptions = {},
) => {
  const base = createControlDriver(fixture, directiveType, controlOptions);

  const field = () => base.query<HTMLInputElement>(fieldSelector)!;

  return {
    ...base,

    field,
    fieldValue: () => field().value,
    placeholder: () => field().placeholder,

    type: (text: string) => setInputValue(field(), text),
    /** Types one character at a time - what a keyboard produces, unlike `type`'s single event. */
    typeChars: (text: string) => typeChars(field(), text),
    typeAndBlur: (text: string) => {
      setInputValue(field(), text);
      blurField(field());
    },
    focus: () => focusField(field()),
    blur: () => blurField(field()),

    press: (key: string, init: KeyboardEventInit = {}) => pressKey(field(), key, init),
    pointer: pointerEvent,
  };
};

export type FieldControlDriver<T, D> = ReturnType<typeof createFieldControlDriver<T, D>>;

export const mountFieldControl = <T, D>(
  component: Type<T>,
  directiveType: Type<D>,
  options: FieldControlDriverOptions = {},
  providers: Provider[] = [],
) => createFieldControlDriver(mountControl(component, providers), directiveType, options);
