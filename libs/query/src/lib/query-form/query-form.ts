import { DestroyRef, NgZone, assertInInjectionContext, inject, isDevMode } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup } from '@angular/forms';
import { NavigationExtras, Router, UrlTree } from '@angular/router';
import {
  ET_PROPERTY_REMOVED,
  clone,
  createDestroy,
  equal,
  injectQueryParamChanges,
  injectQueryParams,
} from '@ethlete/core';
import { BehaviorSubject, Subject, debounceTime, filter, map, merge, of, switchMap, takeUntil, tap, timer } from 'rxjs';
import {
  OptionalQueryFieldOptions,
  QueryFieldOptions,
  QueryFormGroup,
  QueryFormGroupControls,
  QueryFormObserveOptions,
  QueryFormValue,
  QueryFormValueEvent,
  QueryFormWriteOptions,
} from './query-form.types';
import {
  Sort,
  transformToBoolean,
  transformToBooleanArray,
  transformToDate,
  transformToDateArray,
  transformToNumber,
  transformToNumberArray,
  transformToSort,
  transformToSortQueryParam,
  transformToStringArray,
} from './query-form.utils';

const ET_ARR_PREFIX = 'ET_ARR__';
const ET_OBJ_PREFIX = 'ET_OBJ__';
const ET_DATE_PREFIX = 'ET_DATE__';
const ET_PROP_NULL_VALUE = 'ET_NULL__';

/** @deprecated Use `queryField` with `defineQueryForm`. */
export class QueryField<T> {
  constructor(public data: QueryFieldOptions<T>) {}
  get control() {
    return this.data.control;
  }
}

/** @deprecated Use `searchQueryField` with `defineQueryForm`. */
export class SearchQueryField {
  data: QueryFieldOptions<string | null>;

  constructor(public _data?: OptionalQueryFieldOptions<string | null>) {
    this.data = {
      control: _data?.control ?? new FormControl<string | null>(null),
      debounce: 300,
      disableDebounceIfFalsy: true,
      ...(_data ?? {}),
    };
  }
  get control() {
    return this.data.control;
  }
}

/** @deprecated Use `sortQueryField` with `defineQueryForm`. */
export class SortQueryField {
  data: QueryFieldOptions<Sort | null>;

  constructor(public _data?: OptionalQueryFieldOptions<Sort | null>) {
    this.data = {
      control: _data?.control ?? new FormControl<Sort | null>(null),
      queryParamToValueTransformFn: transformToSort,
      valueToQueryParamTransformFn: transformToSortQueryParam,
      ...(_data ?? {}),
    };
  }
  get control() {
    return this.data.control;
  }
}

/** @deprecated Use `stringArrayQueryField` with `defineQueryForm`. */
export class StringArrayQueryField<T extends string[]> {
  data: QueryFieldOptions<T | null>;

  constructor(public _data?: OptionalQueryFieldOptions<T | null>) {
    this.data = {
      control: _data?.control ?? new FormControl<T | null>(null),
      queryParamToValueTransformFn: transformToStringArray as (val: unknown) => T | null,
      ...(_data ?? {}),
    };
  }
  get control() {
    return this.data.control;
  }
}

/** @deprecated Use `booleanArrayQueryField` with `defineQueryForm`. */
export class BooleanArrayQueryField {
  data: QueryFieldOptions<boolean[] | null>;

  constructor(public _data?: OptionalQueryFieldOptions<boolean[] | null>) {
    this.data = {
      control: _data?.control ?? new FormControl<boolean[] | null>(null),
      queryParamToValueTransformFn: transformToBooleanArray,
      ...(_data ?? {}),
    };
  }
  get control() {
    return this.data.control;
  }
}

/** @deprecated Use `numberArrayQueryField` with `defineQueryForm`. */
export class NumberArrayQueryField {
  data: QueryFieldOptions<number[] | null>;

  constructor(public _data?: OptionalQueryFieldOptions<number[] | null>) {
    this.data = {
      control: _data?.control ?? new FormControl<number[] | null>(null),
      queryParamToValueTransformFn: transformToNumberArray,
      ...(_data ?? {}),
    };
  }
  get control() {
    return this.data.control;
  }
}

/** @deprecated Use `dateQueryField` with `defineQueryForm`. */
export class DateQueryField {
  data: QueryFieldOptions<Date | null>;

  constructor(public _data?: OptionalQueryFieldOptions<Date | null>) {
    this.data = {
      control: _data?.control ?? new FormControl<Date | null>(null),
      queryParamToValueTransformFn: transformToDate,
      ...(_data ?? {}),
    };
  }
  get control() {
    return this.data.control;
  }
}

/** @deprecated Use `dateArrayQueryField` with `defineQueryForm`. */
export class DateArrayQueryField {
  data: QueryFieldOptions<Date[] | null>;

  constructor(public _data?: OptionalQueryFieldOptions<Date[] | null>) {
    this.data = {
      control: _data?.control ?? new FormControl<Date[] | null>(null),
      queryParamToValueTransformFn: transformToDateArray,
      ...(_data ?? {}),
    };
  }
  get control() {
    return this.data.control;
  }
}

const IGNORED_FILTER_COUNT_FIELDS = ['page', 'skip', 'take', 'limit', 'sort', 'sortBy', 'sortOrder', 'query', 'search'];

export type QueryFormOptions = {
  /**
   * A prefix to use for the query parameters. This is useful when you have multiple query forms on the same page.
   */
  queryParamPrefix?: string | (() => string);
};

/** @deprecated Use `defineQueryForm`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyQueryForm = QueryForm<any>;

/** @deprecated Use `defineQueryForm`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class QueryForm<T extends Record<string, QueryField<any>>> {
  private router = inject(Router);
  private zone = inject(NgZone);
  private queryParams = injectQueryParams();
  private readonly destroy$ = createDestroy();
  private readonly unobserveTrigger$ = new Subject<boolean>();
  private readonly defaultValues = this.extractDefaultValues();
  private readonly didValueChanges$ = new Subject<boolean>();

  private isObserving = false;
  private removeQueryParamsOnCleanup = true;
  private skipNextResets = false;
  private urlWriteVersion = 0;
  private readonly urlNavigationMarker = {};

  private queryParamChanges$ = toObservable(injectQueryParamChanges());

  /**
   * The angular form group that contains all the fields.
   *
   * **Do not** use any of the following methods on this form group:
   * - `setValue`: Use `QueryForm.setValue` instead.
   * - `patchValue`: Use `QueryForm.patchValue` instead.
   * - `valueChanges`: Use `QueryForm.changes$` instead.
   * - `value`: Use `QueryForm.value` instead.
   * - `controls`: Use `QueryForm.controls` instead.
   */
  readonly form = this.setupFormGroup();

  private readonly lastFormValue$ = new BehaviorSubject<QueryFormValue<T> | null>(null);
  private readonly currentFormValue$ = new BehaviorSubject<QueryFormValue<T>>(this.formValue);

  private readonly _changes$ = new BehaviorSubject<QueryFormValueEvent<T>>({
    previousValue: null,
    currentValue: this.form.getRawValue() as QueryFormValue<T>,
  });

  readonly changes$ = this._changes$.asObservable();
  readonly currentValue$ = this._changes$.pipe(map(({ currentValue }) => currentValue));
  readonly previousValue$ = this._changes$.pipe(map(({ previousValue }) => previousValue));

  changes = toSignal(this.changes$);
  currentValue = toSignal(this.currentValue$);
  previousValue = toSignal(this.previousValue$);

  /**
   * The number of active filters.
   *
   * Excludes the following fields by default:
   * - `page`
   * - `skip`
   * - `take`
   * - `limit`
   * - `sort`
   * - `sortBy`
   * - `sortOrder`
   * - `query`
   * - `search`
   */
  readonly activeFilterCount$ = this.changes$.pipe(
    map(
      ({ currentValue }) =>
        Object.entries(currentValue)
          .map(([key, value]) => {
            if (IGNORED_FILTER_COUNT_FIELDS.includes(key) || this._fields[key]?.data.skipInFilterCount) {
              return true;
            }

            return this.isDefaultValue(key, value);
          })
          .filter((v) => v === false).length,
    ),
  );

  // with prefix eg. page should become ${prefix}-page
  constructor(
    private _fields: T,
    private _options?: QueryFormOptions,
  ) {
    assertInInjectionContext(QueryForm);

    inject(DestroyRef).onDestroy(() => this.cleanup(false));

    merge(...Object.values(this._fields).map((field) => field.control.valueChanges))
      .pipe(
        filter(() => !this.isObserving),
        debounceTime(0),
        tap(() => this.handleFormChange()),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  get controls() {
    return this.form.controls;
  }

  get value() {
    return this._changes$.value.currentValue;
  }

  get defaultFormValue() {
    return Object.entries(this.defaultValues).reduce((acc, [key]) => {
      acc[key as keyof QueryFormValue<T>] = this.getDefaultValue(key);

      return acc;
    }, {} as QueryFormValue<T>);
  }

  observe(options?: QueryFormObserveOptions) {
    if (this.isObserving) {
      if (isDevMode()) {
        console.warn('QueryForm.observe() was called multiple times. This is not supported.');
      }

      return this;
    }

    this.isObserving = true;
    this.removeQueryParamsOnCleanup = options?.writeToQueryParams !== false;

    if (options?.syncOnNavigation !== false) {
      const didChanges = this.setFormValueFromUrlQueryParams({
        queryParams: this.queryParams(),
      });

      if (didChanges) {
        this.handleFormChange(true);
      }
    }

    merge(...Object.values(this._fields).map((field) => field.control.valueChanges), this.didValueChanges$)
      .pipe(
        debounceTime(0),
        tap(() => {
          this.handleFormChange();
        }),
        takeUntil(this.destroy$),
        takeUntil(this.unobserveTrigger$),
      )
      .subscribe();

    let changedFieldsInLastResetLoop: string[] = [];
    let currentUniqueChangedFields: string[] = [];

    this.currentFormValue$
      .pipe(
        map((currentValue) => {
          return {
            previousValue: clone(this.lastFormValue$.value),
            currentValue: clone(currentValue),
          };
        }),
        tap(({ currentValue, previousValue }) => {
          if (options?.writeToQueryParams !== false) {
            this._syncViaUrlQueryParams(currentValue, options?.replaceUrl);
          }

          const didResetValues = this.skipNextResets
            ? false
            : this._handleQueryFormResets(previousValue ?? null, currentValue);

          this.skipNextResets = false;

          const changedFields = Object.keys(currentValue).filter(
            (key) => !equal(previousValue?.[key], currentValue[key]),
          );

          if (changedFieldsInLastResetLoop.length) {
            changedFields.push(...changedFieldsInLastResetLoop);
            changedFieldsInLastResetLoop = [];
          }

          if (didResetValues) {
            this.didValueChanges$.next(true);
            changedFieldsInLastResetLoop = changedFields;
          }

          currentUniqueChangedFields = [...new Set(changedFields)];
        }),
        switchMap(({ currentValue, previousValue }) => {
          if (changedFieldsInLastResetLoop.length) return of(null).pipe(map(() => ({ currentValue, previousValue })));

          const debounceValues = currentUniqueChangedFields.map((key) => {
            const field = this._fields[key];

            if (!field) return null;

            if (field.data.disableDebounceIfFalsy === true && !currentValue[key]) {
              return null;
            }

            return field.data.debounce ?? null;
          });

          currentUniqueChangedFields = [];

          if (debounceValues.some((v) => v === null) || !debounceValues.length) {
            return of(null).pipe(map(() => ({ currentValue, previousValue })));
          }

          const shortestDebounceTime = Math.min(...debounceValues.filter((v): v is number => v !== null));

          return timer(shortestDebounceTime).pipe(map(() => ({ currentValue, previousValue })));
        }),
        tap(({ currentValue, previousValue }) => {
          if (changedFieldsInLastResetLoop.length) return;

          this._changes$.next({
            previousValue: previousValue ?? null,
            currentValue: currentValue,
          });
        }),
        takeUntil(this.destroy$),
        takeUntil(this.unobserveTrigger$),
      )
      .subscribe();

    if (options?.syncOnNavigation !== false) {
      this.queryParamChanges$
        .pipe(
          takeUntil(this.destroy$),
          takeUntil(this.unobserveTrigger$),
          tap((changes) => {
            const info = this.router.lastSuccessfulNavigation()?.extras.info as
              { queryForm?: object; version?: number } | undefined;
            if (info?.queryForm === this.urlNavigationMarker && (info.version ?? 0) < this.urlWriteVersion) return;

            const didValueChanges = this.setFormValueFromUrlQueryParams({ queryParams: changes });

            if (didValueChanges) {
              this.didValueChanges$.next(true);
            }
          }),
        )
        .subscribe();
    }

    return this;
  }

  unobserve() {
    this.unobserveTrigger$.next(true);
    this.cleanup();
  }

  setFormValueFromUrlQueryParams(options: { queryParams: Record<string, unknown> }) {
    let didValueChanges = false;

    for (const [key, field] of Object.entries(this._fields)) {
      const value = options.queryParams[this.transformKeyToQueryParam(key)];

      const valueDoesNotExist = value === undefined;

      if (valueDoesNotExist) continue;

      const valueGotRemoved = value === ET_PROPERTY_REMOVED;

      if (valueGotRemoved) {
        const defaultValue = this.getDefaultValue(key);
        if (!equal(field.control.value, defaultValue)) {
          field.control.setValue(defaultValue, { emitEvent: false });
          didValueChanges = true;
        }

        continue;
      }
      let deserializedValue = value;

      if (field.data.queryParamToValueTransformFn) {
        deserializedValue = field.data.queryParamToValueTransformFn(value);
      } else if (!field.data.skipAutoTransform) {
        const defaultIsNum = typeof this.getDefaultValue(key) === 'number';
        const valueIsNum = !isNaN(Number(value));
        const valueContainsWhitespace = typeof value === 'string' && value.trim() !== value;
        const valueHasLeadingZero = typeof value === 'string' && value.startsWith('0');
        const valueEndsWithDot = typeof value === 'string' && value.endsWith('.');

        const defaultIsBool = typeof this.getDefaultValue(key) === 'boolean';
        const valueIsBool = value === 'true' || value === 'false';

        if (value === ET_PROP_NULL_VALUE) {
          deserializedValue = null;
        } else if (
          defaultIsNum ||
          (valueIsNum && !valueContainsWhitespace && !valueHasLeadingZero && !valueEndsWithDot)
        ) {
          deserializedValue = transformToNumber(value);
        } else if (defaultIsBool || valueIsBool) {
          deserializedValue = transformToBoolean(value);
        }
      }

      const valueIsEqualToCurrent = equal(deserializedValue, field.control.value);

      if (valueIsEqualToCurrent) continue;

      field.control.setValue(deserializedValue, { emitEvent: false });
      didValueChanges = true;
    }

    return didValueChanges;
  }

  setValue(value: QueryFormValue<T>, options?: QueryFormWriteOptions) {
    if (options?.skipResets) {
      this.skipNextResets = true;
    }

    this._form._setValue(value, options);

    if (!this.isObserving) this.handleFormChange(true);
  }

  patchValue(value: Partial<QueryFormValue<T>>, options?: QueryFormWriteOptions) {
    if (options?.skipResets) {
      this.skipNextResets = true;
    }

    this._form._patchValue(value, options);

    if (!this.isObserving) this.handleFormChange(true);
  }

  resetFieldToDefault(key: keyof QueryFormValue<T>, options?: QueryFormWriteOptions) {
    const defaultValue = this.getDefaultValue(key as string);

    this.form.controls[key].setValue(defaultValue);

    if (options?.skipResets) {
      this.skipNextResets = true;
    }
  }

  resetFieldsToDefault(keys: (keyof QueryFormValue<T>)[], options?: QueryFormWriteOptions) {
    const defaults = keys.reduce(
      (acc, key) => {
        acc[key] = this.getDefaultValue(key as string);

        return acc;
      },
      {} as Partial<QueryFormValue<T>>,
    );

    this.patchValue(defaults);

    if (options?.skipResets) {
      this.skipNextResets = true;
    }
  }

  resetAllFieldsToDefault(options?: QueryFormWriteOptions & { skipFields?: (keyof QueryFormValue<T>)[] }) {
    const keys = Object.keys(this._fields) as (keyof QueryFormValue<T>)[];

    if (options?.skipFields) {
      for (const key of options.skipFields) {
        const index = keys.indexOf(key);

        if (index !== -1) {
          keys.splice(index, 1);
        }
      }
    }

    this.resetFieldsToDefault(keys, options);
  }

  private get formValue() {
    return this.form.getRawValue() as QueryFormValue<T>;
  }

  private get _form() {
    return this.form as unknown as QueryFormGroup;
  }

  private _handleQueryFormResets(previousValue: QueryFormValue<T> | null, currentValue: QueryFormValue<T>) {
    let didResetValues = false;

    for (const formFieldKey in this._fields) {
      const field = this._fields[formFieldKey];

      if (!field) continue;

      const resets = field.data.isResetBy;

      if (!resets) continue;

      const resetConditionKeys = Array.isArray(resets) ? resets : [resets];

      for (const resetConditionKey of resetConditionKeys) {
        if (!(resetConditionKey in this._fields)) {
          if (isDevMode()) {
            console.warn(`The field "${resetConditionKey}" is not defined in the QueryForm. Is it a typo?`, this);
          }

          continue;
        }

        if (
          previousValue &&
          currentValue &&
          !equal(previousValue[resetConditionKey], currentValue[resetConditionKey])
        ) {
          const defaultValueForKeyToReset = this.getDefaultValue(formFieldKey);
          const currentValueForKeyToReset = currentValue[formFieldKey];

          if (equal(defaultValueForKeyToReset, currentValueForKeyToReset)) {
            continue;
          }

          this.form.controls[formFieldKey].setValue(defaultValueForKeyToReset);

          didResetValues = true;

          break;
        }
      }
    }

    return didResetValues;
  }

  private getDefaultValue(key: string) {
    const val = this.defaultValues[key];

    if (typeof val === 'string' && val.startsWith(ET_ARR_PREFIX)) {
      return JSON.parse(val.slice(ET_ARR_PREFIX.length));
    } else if (typeof val === 'string' && val.startsWith(ET_OBJ_PREFIX)) {
      return JSON.parse(val.slice(ET_OBJ_PREFIX.length));
    } else if (typeof val === 'string' && val.startsWith(ET_DATE_PREFIX)) {
      return new Date(val.slice(ET_DATE_PREFIX.length));
    } else if (typeof val === 'function') {
      return val();
    } else if (val === ET_PROP_NULL_VALUE) {
      return null;
    }

    return val ?? null;
  }

  private transformKeyToQueryParam(key: string) {
    if (!this._options?.queryParamPrefix) return key;

    const prefix =
      typeof this._options?.queryParamPrefix === 'string'
        ? this._options.queryParamPrefix
        : this._options.queryParamPrefix();

    return `${prefix}-${key}`;
  }

  private isDefaultValue(key: string, value: unknown) {
    const normalizedValue = Array.isArray(value)
      ? `${ET_ARR_PREFIX}${JSON.stringify(value)}`
      : value instanceof Date
        ? `${ET_DATE_PREFIX}${value.toISOString()}`
        : typeof value === 'object' && value !== null
          ? `${ET_OBJ_PREFIX}${JSON.stringify(value)}`
          : value === null
            ? ET_PROP_NULL_VALUE
            : value;

    return this.defaultValues[key] === normalizedValue;
  }

  private setupFormGroup() {
    const group = new FormGroup({} as QueryFormGroupControls<T>) as unknown as QueryFormGroup;

    for (const [key, field] of Object.entries(this._fields)) {
      group.addControl(key, field.control);
    }

    group._patchValue = group.patchValue;
    group._setValue = group.setValue;

    group.patchValue = this.patchValue.bind(this);
    group.setValue = this.setValue.bind(this);

    return group as unknown as FormGroup<QueryFormGroupControls<T>>;
  }

  private extractDefaultValues() {
    const defaultValues: Record<string, unknown> = {};

    for (const [key, field] of Object.entries(this._fields)) {
      const value = field.data.defaultValue !== undefined ? field.data.defaultValue : field.control.value;

      if (Array.isArray(value)) {
        defaultValues[key] = `${ET_ARR_PREFIX}${JSON.stringify(value)}`;
      } else if (value instanceof Date) {
        defaultValues[key] = `${ET_DATE_PREFIX}${value.toISOString()}`;
      } else if (typeof value === 'object' && value !== null) {
        defaultValues[key] = `${ET_OBJ_PREFIX}${JSON.stringify(value)}`;
      } else if (value === null) {
        defaultValues[key] = ET_PROP_NULL_VALUE;
      } else {
        defaultValues[key] = value;
      }
    }

    return defaultValues;
  }

  private _syncViaUrlQueryParams(values: QueryFormValue<T>, replaceUrl?: boolean) {
    const queryParams: Record<string, unknown> = {};
    const version = ++this.urlWriteVersion;

    for (const [key, value] of Object.entries(values)) {
      const queryParamKey = this.transformKeyToQueryParam(key);
      const field = this._fields[key];

      if (!field) {
        continue;
      }

      const isDefault = this.isDefaultValue(key, value);
      const writeDefaultToUrl = field.data.appendDefaultValueToUrl === true;
      const writeToUrl = field.data.appendToUrl !== false;

      if (!writeToUrl || (isDefault && !writeDefaultToUrl)) {
        queryParams[queryParamKey] = undefined;
      } else {
        queryParams[queryParamKey] = field.data.valueToQueryParamTransformFn
          ? field.data.valueToQueryParamTransformFn?.(value)
          : value === null
            ? ET_PROP_NULL_VALUE
            : value;
      }
    }

    this.navigateWithParams(
      queryParams,
      {
        replaceUrl,
        info: { queryForm: this.urlNavigationMarker, version },
      },
      true,
    );
  }

  private handleFormChange(forceOverwrite = false) {
    // Normalize values that have a valueToQueryParamTransformFn returning null/undefined to their
    // field default before capturing the new value. This prevents intermediate "empty object" states
    // (e.g. Sort emitting { active: '', direction: '' } when cleared) from being
    // emitted as distinct form values.
    for (const [key, field] of Object.entries(this._fields)) {
      if (!field.data.valueToQueryParamTransformFn) continue;
      const rawValue = (this.formValue as Record<string, unknown>)[key];
      if (this.isDefaultValue(key, rawValue)) continue;
      const serialized = field.data.valueToQueryParamTransformFn(rawValue);
      if (serialized !== null && serialized !== undefined) continue;
      this.form.controls[key]?.setValue(this.getDefaultValue(key), { emitEvent: false });
    }

    const currentVal = clone(this.currentFormValue$.value);
    const newVal = clone(this.formValue);

    if (equal(currentVal, newVal)) {
      this.skipNextResets = false;

      return;
    }

    if (forceOverwrite) {
      this.lastFormValue$.next(newVal);
    } else {
      this.lastFormValue$.next(currentVal);
    }

    this.currentFormValue$.next(newVal);

    if (!this.isObserving) {
      this._changes$.next({ previousValue: currentVal, currentValue: newVal });
    }
  }

  private cleanup(removeQueryParams = this.removeQueryParamsOnCleanup) {
    if (!this.isObserving) return;

    this.isObserving = false;

    if (!removeQueryParams) return;

    const queryParamKeys = Object.keys(this._fields);
    const queryParams = queryParamKeys.reduce(
      (acc, key) => {
        acc[this.transformKeyToQueryParam(key)] = undefined;
        return acc;
      },
      {} as Record<string, unknown>,
    );
    this.navigateWithParams(queryParams, { replaceUrl: true }, true);
  }

  private navigateWithParams(
    params: Record<string, unknown>,
    extras: Pick<NavigationExtras, 'replaceUrl' | 'info'>,
    onlyOnCurrentRoute = false,
  ) {
    this.zone.run(() => {
      queueMicrotask(() => {
        const pending = this.router.getCurrentNavigation();
        const base = pending?.finalUrl ?? pending?.extractedUrl ?? this.router.parseUrl(this.router.url);

        // Writing onto a navigation that lands on another route would supersede it: the user's
        // navigation resolves `false` and that route's own params (`page`, `search`) are lost.
        if (onlyOnCurrentRoute && this.pathOf(base) !== this.pathOf(this.router.parseUrl(this.router.url))) return;

        const queryParams: Record<string, unknown> = { ...base.queryParams, ...params };

        for (const key of Object.keys(queryParams)) {
          if (queryParams[key] === undefined) delete queryParams[key];
        }

        this.router.navigate([], { queryParams, ...extras });
      });
    });
  }

  private pathOf(tree: UrlTree) {
    return this.router.serializeUrl(tree).split(/[?#]/)[0];
  }
}
