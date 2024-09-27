import { FormControl, FormGroup } from '@angular/forms';
import { QueryField } from './query-form';

export interface QueryFieldOptions<T = unknown> {
  /**
   * The default value of the field.
   * Will be set to the initial value of the form control if not specified.
   */
  defaultValue?: T | null;

  /**
   * Debounce time in milliseconds.
   */
  debounce?: number;

  /**
   *  Whether the debounce should not be applied if the value is falsy.
   *  This is useful for fields that can be cleared like a search field.
   *
   *  @default false
   */
  disableDebounceIfFalsy?: boolean;

  /**
   * The form control for the field.
   */
  control: FormControl<T | null>;

  /**
   * Append the field's value to the url.
   *
   * The field wont be appended to the url if one of the following is true:
   * - It is the default value and `appendDefaultValueToUrl` is `false`
   * - It is an empty string
   * - It is `null`
   * - It is `undefined`
   *
   * @default true
   */
  appendToUrl?: boolean;

  /**
   * Append the field's value to the url even if it is the default value.
   * Will be ignored if `appendToUrl` is `false`.
   *
   * @default false
   */
  appendDefaultValueToUrl?: boolean;

  /**
   * Reset the field's value to the default value if one or more of the specified fields are changed.
   *
   * @example
   * // Given this field is a `page` field, the field will be reset if the `limit`, `query` or `search` fields are changed.
   * ['limit', 'query', 'search']
   */
  isResetBy?: string | string[];

  /**
   * Whether the field should change the count of current active filters.
   *
   * Will be `true` for these common fields:
   * - `page`
   * - `skip`
   * - `take`
   * - `limit`
   * - `sort`
   * - `sortBy`
   * - `sortOrder`
   * - `query`
   * - `search`
   * @default false
   */
  skipInFilterCount?: boolean;

  /**
   * By default, the field's string value is transformed to it's matching primitive type.
   * Meaning that a string `'true'` will be transformed to a boolean `true` and a string `'5'` will be transformed to a number `5`.
   * If this is set to `true`, the field's value will not be transformed.
   *
   * @default false
   */
  skipAutoTransform?: boolean;

  /**
   * A function that transforms the the value gotten from the url query params to a value required by the field.
   * E.g. for a number field, the value from the url query params is a string, but the field requires a number.
   *
   * The following common transformations are already implemented:
   * - `transformToString`
   * - `transformToStringArray`
   * - `transformToNumber`
   * - `transformToNumberArray`
   * - `transformToBoolean`
   * - `transformToBooleanArray`
   * - `transformToDate` (expects a string in the default js format)
   * - `transformToDateArray` (expects strings in the default js format)
   * - `transformToSort` (expects a string in the format `field:direction`)
   */
  queryParamToValueTransformFn?: (val: unknown) => T | null;

  /**
   * A function that transforms the value of the field to a value that can be appended to the url query params.
   *
   * The following common transformations are already implemented:
   * - `transformToSortQueryParam` (returns an object containing `field` and `direction` properties)
   */
  valueToQueryParamTransformFn?: (val: T | null) => unknown;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type QueryFormGroupControls<T extends Record<string, QueryField<any>>> = {
  [Property in keyof T]: T[Property]['control'];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type QueryFormValue<T extends Record<string, QueryField<any>>> = {
  [Property in keyof T]: T[Property]['control']['value'];
};

export type QueryFormOf<T extends FormGroup> = {
  [K in keyof T['controls']]: QueryField<T['controls'][K]['value']>;
};

export interface QueryFormGroup extends FormGroup {
  _setValue: FormGroup['setValue'];
  _patchValue: FormGroup['patchValue'];
  setValue(value: unknown, options?: QueryFormWriteOptions): void;
  patchValue(value: unknown, options?: QueryFormWriteOptions): void;
}

export interface QueryFormObserveOptions {
  /**
   * Whether the form value should be synced to the url query params.
   * @default true
   */
  writeToQueryParams?: boolean;

  /**
   * Whether the form value should be updated when the url query params change.
   * @default true
   */
  syncOnNavigation?: boolean;

  /**
   * If true, the navigation will not create a new entry in the browser's history.
   * @default false
   */
  replaceUrl?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface QueryFormValueEvent<T extends Record<string, QueryField<any>>> {
  previousValue: QueryFormValue<T> | null;
  currentValue: QueryFormValue<T>;
}

export interface QueryFormWriteOptions {
  /**
   * When true, each change only affects this control, and not its parent.
   * @default false
   */
  onlySelf?: boolean;

  /**
   * When true or not supplied (the default), both the `statusChanges` and `valueChanges`
   * observables emit events with the latest status and value when the control value is updated.
   * When false, no events are emitted.
   * @default true
   */
  emitEvent?: boolean;

  /**
   * When true, the `resetBy` conditions will be ignored for this write.
   * @default false
   */
  skipResets?: boolean;
}
