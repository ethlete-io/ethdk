import { Provider, Type } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { blurField, focusField, pressKey, textOf, tick, typeChars, typeInField } from '../../testing/driver-core';
import { createOverlayControlDriver, mountControl } from '../../testing/overlay-control-driver';

/**
 * Types masked date/time text one character at a time, with the caret tracking the insertion -
 * what `InputMaskDirective`'s live reformatting needs, unlike a whole-string {@link typeInField}.
 * Every date/time mask spec re-implemented this loop; this is the one copy.
 */
export const typeMasked = (field: HTMLInputElement, text: string) => typeChars(field, text);

/**
 * Driver for every date-time control that pairs text fields with a picker overlay: date, date
 * range, date-time, time and time range. The picker trigger is matched by its directive, so a test
 * host can put it on any element; the fields are matched by CSS, defaulting to the only `input`.
 */
export const createDatePickerDriver = <T, D extends { closePicker: () => void }>(
  fixture: ComponentFixture<T>,
  directiveType: Type<D>,
) => {
  const base = createOverlayControlDriver(fixture, directiveType, {
    triggerSelector: '[etdatepickertrigger]',
    hide: (control) => control.closePicker(),
  });

  const dayCell = (label: string) =>
    base
      .paneEls<HTMLButtonElement>('.et-calendar-cell')
      .find((cell) => textOf(cell) === label && !cell.hasAttribute('data-outside-month')) ?? null;

  const field = (selector = 'input') => base.query<HTMLInputElement>(selector)!;

  return {
    ...base,
    dayCell,
    clickDayCell: (label: string) => {
      dayCell(label)!.click();
      tick();
    },
    field,
    fields: () => base.queryAll<HTMLInputElement>('input'),
    type: (text: string, selector?: string) => typeInField(field(selector), text),
    typeMasked: (text: string, selector?: string) => typeMasked(field(selector), text),
    typeAndBlur: (text: string, selector?: string) => {
      typeInField(field(selector), text);
      blurField(field(selector));
    },
    focusField: (selector?: string) => focusField(field(selector)),
    blurField: (selector?: string) => blurField(field(selector)),
    pressInField: (key: string, selector?: string) => pressKey(field(selector), key),
  };
};

export type DatePickerDriver<T, D extends { closePicker: () => void }> = ReturnType<
  typeof createDatePickerDriver<T, D>
>;

export const mountDatePicker = <T, D extends { closePicker: () => void }>(
  component: Type<T>,
  directiveType: Type<D>,
  providers: Provider[] = [],
) => createDatePickerDriver(mountControl(component, providers), directiveType);
