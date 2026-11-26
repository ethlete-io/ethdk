import { defineStaticRootProvider, toInjectFn, toProvideFn } from '@ethlete/core';
import { FormFieldAppearance, FormFieldFill, FormFieldLabelMode, FormFieldSize } from './form-field.variants';

export type FormFieldDefaults = {
  appearance: FormFieldAppearance;
  fill: FormFieldFill;
  labelMode: FormFieldLabelMode;
  /** Also the default `size` of `et-choice-field`, `et-checkbox-group`, `et-radio-group` and `et-segmented-button-group`. */
  size: FormFieldSize;
};

export const DEFAULT_FORM_FIELD_DEFAULTS: FormFieldDefaults = {
  appearance: 'box',
  fill: 'transparent',
  labelMode: 'static',
  size: 'md',
};

const FORM_FIELD_DEFAULTS_DEF = /* @__PURE__ */ defineStaticRootProvider(DEFAULT_FORM_FIELD_DEFAULTS, {
  name: 'FormFieldDefaults',
});

/**
 * Set the default `appearance`, `fill`, `labelMode` and `size` of every form field below this injector.
 * Partial - whatever you leave out or set to `undefined` keeps its {@link DEFAULT_FORM_FIELD_DEFAULTS} value, also when an outer
 * injector provides it. An input set on a field still wins.
 *
 * @example
 * provideFormFieldDefaults({ labelMode: 'floating-inside', fill: 'filled' });
 */
export const provideFormFieldDefaults = /* @__PURE__ */ toProvideFn(FORM_FIELD_DEFAULTS_DEF);
export const injectFormFieldDefaults = /* @__PURE__ */ toInjectFn(FORM_FIELD_DEFAULTS_DEF);
