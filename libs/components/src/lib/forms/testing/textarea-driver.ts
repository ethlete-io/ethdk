import { Provider, Type } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { createFieldControlDriver, FieldControlDriverOptions } from '../../testing/field-control-driver';
import { mountControl } from '../../testing/control-driver';
import { TextareaDirective } from '../textarea/headless';

export const createTextareaDriver = <T>(fixture: ComponentFixture<T>, options: FieldControlDriverOptions = {}) => {
  const base = createFieldControlDriver(fixture, TextareaDirective, { fieldSelector: 'textarea', ...options });

  return {
    ...base,
    textarea: base.control,

    hostEl: () => base.query('et-textarea')!,
    hasAttr: (name: string) => base.field().hasAttribute(name),
    cssVar: (name: string) => base.field().style.getPropertyValue(name),
    blockSize: () => base.field().style.blockSize,
  };
};

export type TextareaDriver<T> = ReturnType<typeof createTextareaDriver<T>>;

export const mountTextarea = <T>(
  component: Type<T>,
  options: FieldControlDriverOptions = {},
  providers: Provider[] = [],
) => createTextareaDriver(mountControl(component, providers), options);
