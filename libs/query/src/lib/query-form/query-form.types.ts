import { FormControl } from '@angular/forms';
import { QueryField } from './query-form';

export interface QueryFieldOptions<T = unknown> {
  /**
   * Debounce time in milliseconds.
   */
  debounce?: number;

  /**
   * The form control for the field.
   */
  control: FormControl<T | null>;

  /**
   * Append the field's value to the url.
   *
   * The field wont be appended to the url if one of the following is true:
   * - It is the default value
   * - It is an empty string
   * - It is `null`
   * - It is `undefined`
   *
   * @default true
   */
  appendToUrl?: boolean;

  /**
   * Reset the field's value to the default value if one or more of the specified fields are changed.
   *
   * @example
   * // Given this field is a `page` field, the field will be reset if the `limit`, `query` or `search` fields are changed.
   * ['limit', 'query', 'search']
   */
  isResetBy?: string | string[];

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
export type QueryFormGroup<T extends Record<string, QueryField<any>>> = {
  [Property in keyof T]: T[Property]['control'];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type QueryFormValue<T extends Record<string, QueryField<any>>> = {
  [Property in keyof T]: T[Property]['control']['value'];
};

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
