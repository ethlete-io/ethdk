import {
  Sort,
  transformToBooleanArray,
  transformToDate,
  transformToDateArray,
  transformToNumberArray,
  transformToSort,
  transformToSortQueryParam,
  transformToStringArray,
} from '../query-form/query-form.utils';
import { QueryFieldConfig, QueryFieldDef } from './query-form-signals.types';

const normalizeConfig = <T>(config: QueryFieldConfig<T> | undefined): Partial<QueryFieldDef<T>> => {
  if (!config) return {};

  const { isResetBy, ...rest } = config;

  return {
    ...rest,
    isResetBy: isResetBy === undefined ? undefined : Array.isArray(isResetBy) ? isResetBy : [isResetBy],
  };
};

/**
 * A generic query-form field. Defaults to `null` and, unless a transform is
 * given, relies on the auto-coercion when reading back from the URL.
 *
 * @example
 * queryField<number>({ defaultValue: 1, isResetBy: ['search'] })
 */
export const queryField = <T = string>(config?: QueryFieldConfig<T | null>): QueryFieldDef<T | null> => ({
  defaultValue: null,
  ...normalizeConfig(config),
});

/**
 * A debounced free-text search field, typed `string` like every text control; `''` is empty and writes no
 * URL param. Debounces typing by 300ms but applies clearing immediately (`disableDebounceIfFalsy`).
 */
export const searchQueryField = (config?: QueryFieldConfig<string>): QueryFieldDef<string> => ({
  defaultValue: '',
  debounce: 300,
  disableDebounceIfFalsy: true,
  queryParamToValue: (raw) => (typeof raw === 'string' ? raw : ''),
  ...normalizeConfig(config),
});

/**
 * A sort field serialized as `"active:direction"` (e.g. `"name:asc"`). Matches
 * the wire format the table system's URL adapter uses, so the two interoperate.
 */
export const sortQueryField = (config?: QueryFieldConfig<Sort | null>): QueryFieldDef<Sort | null> => ({
  defaultValue: null,
  queryParamToValue: transformToSort,
  valueToQueryParam: transformToSortQueryParam,
  ...normalizeConfig(config),
});

/** A field holding a list of strings. */
export const stringArrayQueryField = (config?: QueryFieldConfig<string[] | null>): QueryFieldDef<string[] | null> => ({
  defaultValue: null,
  queryParamToValue: transformToStringArray,
  ...normalizeConfig(config),
});

/** A field holding a list of numbers. */
export const numberArrayQueryField = (config?: QueryFieldConfig<number[] | null>): QueryFieldDef<number[] | null> => ({
  defaultValue: null,
  queryParamToValue: transformToNumberArray,
  ...normalizeConfig(config),
});

/** A field holding a list of booleans. */
export const booleanArrayQueryField = (
  config?: QueryFieldConfig<boolean[] | null>,
): QueryFieldDef<boolean[] | null> => ({
  defaultValue: null,
  queryParamToValue: transformToBooleanArray,
  ...normalizeConfig(config),
});

/** Options of {@link dateQueryField}; `as: 'string'` keeps the control's wire string instead of a `Date`. */
export type DateQueryFieldConfig = QueryFieldConfig<Date | null> & { readonly as?: 'date' };

/** Options of {@link dateQueryField} with `as: 'string'`. */
export type DateStringQueryFieldConfig = QueryFieldConfig<string | null> & { readonly as: 'string' };

/**
 * A single date field. By default it holds a `Date` read from an ISO/`Date`-parseable string in the URL.
 * `as: 'string'` types it `string | null` like the `@ethlete/components` date and time controls, so
 * `[formField]` binds it to them; the URL then carries the control's `valueFormat` string verbatim.
 *
 * @example
 * dateQueryField({ as: 'string' }) // <et-date-input [formField]="qf.fields.from" valueFormat="yyyy-MM-dd" />
 */
export function dateQueryField(config: DateStringQueryFieldConfig): QueryFieldDef<string | null>;
export function dateQueryField(config?: DateQueryFieldConfig): QueryFieldDef<Date | null>;
export function dateQueryField(
  config?: DateQueryFieldConfig | DateStringQueryFieldConfig,
): QueryFieldDef<Date | null> | QueryFieldDef<string | null> {
  if (config?.as === 'string') {
    const { as: _as, ...rest } = config;

    return {
      defaultValue: null,
      queryParamToValue: (raw) => (typeof raw === 'string' && raw !== '' ? raw : null),
      ...normalizeConfig(rest),
    };
  }

  const { as: _as, ...rest } = config ?? {};

  return {
    defaultValue: null,
    queryParamToValue: transformToDate,
    ...normalizeConfig(rest),
  };
}

/** A field holding a list of dates. */
export const dateArrayQueryField = (config?: QueryFieldConfig<Date[] | null>): QueryFieldDef<Date[] | null> => ({
  defaultValue: null,
  queryParamToValue: transformToDateArray,
  ...normalizeConfig(config),
});
