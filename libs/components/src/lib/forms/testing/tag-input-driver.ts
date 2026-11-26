import { Provider, Type } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { mountControl } from '../../testing/control-driver';
import { pasteInto, setInputValue, textOf } from '../../testing/driver-core';
import { createFieldControlDriver, FieldControlDriverOptions } from '../../testing/field-control-driver';
import { TagInputDirective } from '../tag-input/headless/tag-input.directive';

export const createTagInputDriver = <T>(fixture: ComponentFixture<T>, options: FieldControlDriverOptions = {}) => {
  const base = createFieldControlDriver(fixture, TagInputDirective, {
    fieldSelector: '.et-tag-input-field',
    ...options,
  });

  const chips = () => base.queryAll('et-chip');

  return {
    ...base,
    tagInput: base.control,

    chips,
    chipLabels: () => base.queryAll('et-chip .et-chip-label').map(textOf),
    removeChip: (index: number) => base.click(base.queryAll('.et-chip-remove-button')[index]!),

    /** Types the text, then presses the key that commits it - Enter, Tab or a separator. */
    typeAndPress: (text: string, key: string) => {
      setInputValue(base.field(), text);
      base.press(key);
    },
    paste: (text: string) => pasteInto(base.field(), text),
    clearField: () => {
      base.field().value = '';
    },
  };
};

export type TagInputDriver<T> = ReturnType<typeof createTagInputDriver<T>>;

export const mountTagInput = <T>(
  component: Type<T>,
  options: FieldControlDriverOptions = {},
  providers: Provider[] = [],
) => createTagInputDriver(mountControl(component, providers), options);
