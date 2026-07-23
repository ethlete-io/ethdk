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
 * A debounced free-text search field. Debounces typing by 300ms but applies
 * clearing immediately (`disableDebounceIfFalsy`).
 */
export const searchQueryField = (config?: QueryFieldConfig<string | null>): QueryFieldDef<string | null> => ({
  defaultValue: null,
  debounce: 300,
  disableDebounceIfFalsy: true,
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

/** A single date field (expects an ISO/`Date`-parseable string in the URL). */
export const dateQueryField = (config?: QueryFieldConfig<Date | null>): QueryFieldDef<Date | null> => ({
  defaultValue: null,
  queryParamToValue: transformToDate,
  ...normalizeConfig(config),
});

/** A field holding a list of dates. */
export const dateArrayQueryField = (config?: QueryFieldConfig<Date[] | null>): QueryFieldDef<Date[] | null> => ({
  defaultValue: null,
  queryParamToValue: transformToDateArray,
  ...normalizeConfig(config),
});
