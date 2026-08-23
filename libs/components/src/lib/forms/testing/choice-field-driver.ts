import { Provider, Type } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { ControlDriverOptions, createControlDriver, mountControl } from '../../testing/control-driver';
import { FormFieldDirective } from '../form-field/headless';

const CHOICE_FIELD = 'et-choice-field';

/** Driver for `et-choice-field`, the row shell that pairs a projected control with a label and support region. */
export const createChoiceFieldDriver = <T>(fixture: ComponentFixture<T>, options: ControlDriverOptions = {}) => {
  const base = createControlDriver(fixture, FormFieldDirective, { directiveSelector: CHOICE_FIELD, ...options });

  const choiceFieldEl = () => base.query(CHOICE_FIELD)!;

  return {
    ...base,
    formField: base.control,

    choiceFieldEl,
    attr: (name: string) => choiceFieldEl().getAttribute(name),
    controlSlot: () => base.query('.et-choice-field-control-slot')!,
    labelArea: () => base.query('.et-choice-field-label-area')!,
  };
};

export type ChoiceFieldDriver<T> = ReturnType<typeof createChoiceFieldDriver<T>>;

export const mountChoiceField = <T>(
  component: Type<T>,
  options: ControlDriverOptions = {},
  providers: Provider[] = [],
) => createChoiceFieldDriver(mountControl(component, providers), options);
