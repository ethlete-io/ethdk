import { Provider, Type } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { mountControl } from '../../testing/control-driver';
import { createFieldControlDriver, FieldControlDriverOptions } from '../../testing/field-control-driver';
import { textOf } from '../../testing/driver-core';
import { OtpInputDirective } from '../otp-input/headless';

const SEGMENT = '.et-otp-input-segment';

export const createOtpInputDriver = <T>(fixture: ComponentFixture<T>, options: FieldControlDriverOptions = {}) => {
  const base = createFieldControlDriver(fixture, OtpInputDirective, {
    fieldSelector: '.et-otp-input-native',
    ...options,
  });

  const segmentEls = () => base.queryAll(SEGMENT);

  return {
    ...base,

    attr: (name: string) => base.field().getAttribute(name),

    segmentCount: () => segmentEls().length,
    segmentTexts: () => segmentEls().map((segment) => textOf(segment) || null),
    segmentCarets: () => segmentEls().map((segment) => segment.hasAttribute('data-caret')),
  };
};

export type OtpInputDriver<T> = ReturnType<typeof createOtpInputDriver<T>>;

export const mountOtpInput = <T>(
  component: Type<T>,
  options: FieldControlDriverOptions = {},
  providers: Provider[] = [],
) => createOtpInputDriver(mountControl(component, providers), options);
