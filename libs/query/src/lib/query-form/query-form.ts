import { DestroyRef, NgZone, assertInInjectionContext, inject, isDevMode } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ET_PROPERTY_REMOVED,
  clone,
  createDestroy,
  equal,
  injectQueryParamChanges,
  injectQueryParams,
} from '@ethlete/core';
import { BehaviorSubject, Subject, debounceTime, map, merge, of, switchMap, takeUntil, tap, timer } from 'rxjs';
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
const ET_PROP_NULL_VALUE = 'ET_NULL__';

export class QueryField<T> {
  get control() {
    return this.data.control;
  }

  constructor(public data: QueryFieldOptions<T>) {}
}

export class SearchQueryField {
  get control() {
    return this.data.control;
  }

  data: QueryFieldOptions<string | null>;

  constructor(public _data?: OptionalQueryFieldOptions<string | null>) {
    this.data = {
      control: _data?.control ?? new FormControl<string | null>(null),
      debounce: 300,
      disableDebounceIfFalsy: true,
      ...(_data ?? {}),
    };
  }
}

export class SortQueryField {
  get control() {
    return this.data.control;
  }

  data: QueryFieldOptions<Sort | null>;

  constructor(public _data?: OptionalQueryFieldOptions<Sort | null>) {
    this.data = {
      control: _data?.control ?? new FormControl<Sort | null>(null),
      queryParamToValueTransformFn: transformToSort,
      valueToQueryParamTransformFn: transformToSortQueryParam,
      ...(_data ?? {}),
    };
  }
}

export class StringArrayQueryField<T extends string[]> {
  get control() {
    return this.data.control;
  }

  data: QueryFieldOptions<T | null>;

  constructor(public _data?: OptionalQueryFieldOptions<T | null>) {
    this.data = {
      control: _data?.control ?? new FormControl<T | null>(null),
      queryParamToValueTransformFn: transformToStringArray as (val: unknown) => T | null,
      ...(_data ?? {}),
    };
  }
}

export class BooleanArrayQueryField {
  get control() {
    return this.data.control;
  }

  data: QueryFieldOptions<boolean[] | null>;

  constructor(public _data?: OptionalQueryFieldOptions<boolean[] | null>) {
    this.data = {
      control: _data?.control ?? new FormControl<boolean[] | null>(null),
      queryParamToValueTransformFn: transformToBooleanArray,
      ...(_data ?? {}),
    };
  }
}

export class NumberArrayQueryField {
  get control() {
    return this.data.control;
  }

  data: QueryFieldOptions<number[] | null>;

  constructor(public _data?: OptionalQueryFieldOptions<number[] | null>) {
    this.data = {
      control: _data?.control ?? new FormControl<number[] | null>(null),
      queryParamToValueTransformFn: transformToNumberArray,
      ...(_data ?? {}),
    };
  }
}

export class DateQueryField {
  get control() {
    return this.data.control;
  }

  data: QueryFieldOptions<Date | null>;

  constructor(public _data?: OptionalQueryFieldOptions<Date | null>) {
    this.data = {
      control: _data?.control ?? new FormControl<Date | null>(null),
      queryParamToValueTransformFn: transformToDate,
      ...(_data ?? {}),
    };
  }
}

export class DateArrayQueryField {
  get control() {
    return this.data.control;
  }

  data: QueryFieldOptions<Date[] | null>;

  constructor(public _data?: OptionalQueryFieldOptions<Date[] | null>) {
    this.data = {
      control: _data?.control ?? new FormControl<Date[] | null>(null),
      queryParamToValueTransformFn: transformToDateArray,
      ...(_data ?? {}),
    };
  }
}

const IGNORED_FILTER_COUNT_FIELDS = ['page', 'skip', 'take', 'limit', 'sort', 'sortBy', 'sortOrder', 'query', 'search'];

export interface QueryFormOptions {
  /**
   * A prefix to use for the query parameters. This is useful when you have multiple query forms on the same page.
   */
  queryParamPrefix?: string | (() => string);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyQueryForm = QueryForm<any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class QueryForm<T extends Record<string, QueryField<any>>> {
  private readonly _destroy$ = createDestroy();
  private readonly _unobserveTrigger$ = new Subject<boolean>();
  private readonly _router = inject(Router);
  private readonly _activatedRoute = inject(ActivatedRoute);
  private readonly _defaultValues = this._extractDefaultValues();
  private readonly _zone = inject(NgZone);
  private readonly _didValueChanges$ = new Subject<boolean>();

  private _isObserving = false;
  private _skipNextResets = false;

  private _queryParamChanges$ = toObservable(injectQueryParamChanges());
  private _queryParams = injectQueryParams();

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
  readonly form = this._setupFormGroup();

  private readonly _lastFormValue$ = new BehaviorSubject<QueryFormValue<T> | null>(null);
  private readonly _currentFormValue$ = new BehaviorSubject<QueryFormValue<T>>(this._formValue);

  private get _formValue() {
    return this.form.getRawValue() as QueryFormValue<T>;
  }

  private get _form() {
    return this.form as unknown as QueryFormGroup;
  }

  private readonly _changes$ = new BehaviorSubject<QueryFormValueEvent<T>>({
    previousValue: null,
    currentValue: this.form.getRawValue() as QueryFormValue<T>,
  });

  readonly changes$ = this._changes$.asObservable();
  readonly currentValue$ = this._changes$.pipe(map(({ currentValue }) => currentValue));
  readonly previousValue$ = this._changes$.pipe(map(({ previousValue }) => previousValue));

  readonly changes = toSignal(this.changes$);
  readonly currentValue = toSignal(this.currentValue$);
  readonly previousValue = toSignal(this.previousValue$);

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

            return this._isDefaultValue(key, value);
          })
          .filter((v) => v === false).length,
    ),
  );

  get controls() {
    return this.form.controls;
  }

  get value() {
    return this._changes$.value.currentValue;
  }

  get defaultFormValue() {
    return Object.entries(this._defaultValues).reduce((acc, [key]) => {
      acc[key as keyof QueryFormValue<T>] = this._getDefaultValue(key);

      return acc;
    }, {} as QueryFormValue<T>);
  }

  // with prefix eg. page should become ${prefix}-page
  constructor(
    private _fields: T,
    private _options?: QueryFormOptions,
  ) {
    assertInInjectionContext(QueryForm);

    inject(DestroyRef).onDestroy(() => this._cleanup());
  }

  observe(options?: QueryFormObserveOptions) {
    if (this._isObserving) {
      if (isDevMode()) {
        console.warn('QueryForm.observe() was called multiple times. This is not supported.');
      }
      return this;
    }

    this._isObserving = true;

    if (options?.syncOnNavigation !== false) {
      const didChanges = this.setFormValueFromUrlQueryParams({
        queryParams: this._queryParams(),
      });

      if (didChanges) {
        this._handleFormChange(true);
      }
    }

    merge(...Object.values(this._fields).map((field) => field.control.valueChanges), this._didValueChanges$)
      .pipe(
        debounceTime(0),
        tap(() => {
          this._handleFormChange();
        }),
        takeUntil(this._destroy$),
        takeUntil(this._unobserveTrigger$),
      )
      .subscribe();

    let changedFieldsInLastResetLoop: string[] = [];
    let currentUniqueChangedFields: string[] = [];

    this._currentFormValue$
      .pipe(
        map((currentValue) => {
          return {
            previousValue: clone(this._lastFormValue$.value),
            currentValue: clone(currentValue),
          };
        }),
        tap(({ currentValue, previousValue }) => {
          if (options?.writeToQueryParams !== false) {
            this._syncViaUrlQueryParams(currentValue, options?.replaceUrl);
          }

          const didResetValues = this._skipNextResets
            ? false
            : this._handleQueryFormResets(previousValue ?? null, currentValue);

          this._skipNextResets = false;

          const changedFields = Object.keys(currentValue).filter(
            (key) => !equal(previousValue?.[key], currentValue[key]),
          );

          if (changedFieldsInLastResetLoop.length) {
            changedFields.push(...changedFieldsInLastResetLoop);
            changedFieldsInLastResetLoop = [];
          }

          if (didResetValues) {
            this._didValueChanges$.next(true);
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
        takeUntil(this._destroy$),
        takeUntil(this._unobserveTrigger$),
      )
      .subscribe();

    if (options?.syncOnNavigation !== false) {
      this._queryParamChanges$
        .pipe(
          takeUntil(this._destroy$),
          takeUntil(this._unobserveTrigger$),
          tap((changes) => {
            const didValueChanges = this.setFormValueFromUrlQueryParams({ queryParams: changes });

            if (didValueChanges) {
              this._didValueChanges$.next(true);
            }
          }),
        )
        .subscribe();
    }

    return this;
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
          const defaultValueForKeyToReset = this._getDefaultValue(formFieldKey);
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

  unobserve() {
    this._unobserveTrigger$.next(true);
    this._cleanup();
  }

  setFormValueFromUrlQueryParams(options: { queryParams: Record<string, unknown> }) {
    let didValueChanges = false;

    for (const [key, field] of Object.entries(this._fields)) {
      const value = options.queryParams[this._transformKeyToQueryParam(key)];

      const valueDoesNotExist = value === undefined;

      if (valueDoesNotExist) continue;

      const valueGotRemoved = value === ET_PROPERTY_REMOVED;

      if (valueGotRemoved) {
        field.control.setValue(this._getDefaultValue(key), { emitEvent: false });
        didValueChanges = true;

        continue;
      }
      let deserializedValue = value;

      if (field.data.queryParamToValueTransformFn) {
        deserializedValue = field.data.queryParamToValueTransformFn(value);
      } else if (!field.data.skipAutoTransform) {
        const defaultIsNum = typeof this._getDefaultValue(key) === 'number';
        const valueIsNum = !isNaN(Number(value));
        const valueContainsWhitespace = typeof value === 'string' && value.trim() !== value;
        const valueHasLeadingZero = typeof value === 'string' && value.startsWith('0');
        const valueEndsWithDot = typeof value === 'string' && value.endsWith('.');

        const defaultIsBool = this._getDefaultValue(key) === 'boolean';
        const valueIsBool = value === 'true' || value === 'false';

        if (defaultIsNum && value === ET_PROP_NULL_VALUE) {
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
    this._form._setValue(value, options);

    if (options?.skipResets) {
      this._skipNextResets = true;
    }
  }

  patchValue(value: Partial<QueryFormValue<T>>, options?: QueryFormWriteOptions) {
    this._form._patchValue(value, options);

    if (options?.skipResets) {
      this._skipNextResets = true;
    }
  }

  resetFieldToDefault(key: keyof QueryFormValue<T>, options?: QueryFormWriteOptions) {
    const defaultValue = this._getDefaultValue(key as string);

    this.form.controls[key].setValue(defaultValue);

    if (options?.skipResets) {
      this._skipNextResets = true;
    }
  }

  resetFieldsToDefault(keys: (keyof QueryFormValue<T>)[], options?: QueryFormWriteOptions) {
    const defaults = keys.reduce(
      (acc, key) => {
        acc[key] = this._getDefaultValue(key as string);

        return acc;
      },
      {} as Partial<QueryFormValue<T>>,
    );

    this.patchValue(defaults);

    if (options?.skipResets) {
      this._skipNextResets = true;
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

  private _getDefaultValue(key: string) {
    const val = this._defaultValues[key];

    if (typeof val === 'string' && val.startsWith(ET_ARR_PREFIX)) {
      return JSON.parse(val.slice(ET_ARR_PREFIX.length));
    } else if (typeof val === 'string' && val.startsWith(ET_OBJ_PREFIX)) {
      return JSON.parse(val.slice(ET_OBJ_PREFIX.length));
    } else if (typeof val === 'function') {
      return val();
    } else if (val === ET_PROP_NULL_VALUE) {
      return null;
    }

    return val ?? null;
  }

  private _transformKeyToQueryParam(key: string) {
    if (!this._options?.queryParamPrefix) return key;

    const prefix =
      typeof this._options?.queryParamPrefix === 'string'
        ? this._options.queryParamPrefix
        : this._options.queryParamPrefix();

    return `${prefix}-${key}`;
  }

  private _isDefaultValue(key: string, value: unknown) {
    const normalizedValue = Array.isArray(value)
      ? `${ET_ARR_PREFIX}${JSON.stringify(value)}`
      : typeof value === 'object' && value !== null
        ? `${ET_OBJ_PREFIX}${JSON.stringify(value)}`
        : value === null
          ? ET_PROP_NULL_VALUE
          : value;

    return this._defaultValues[key] === normalizedValue;
  }

  private _setupFormGroup() {
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

  private _extractDefaultValues() {
    const defaultValues: Record<string, unknown> = {};

    for (const [key, field] of Object.entries(this._fields)) {
      const value = field.data.defaultValue !== undefined ? field.data.defaultValue : field.control.value;

      if (Array.isArray(value)) {
        defaultValues[key] = `${ET_ARR_PREFIX}${JSON.stringify(value)}`;
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
    const queryParams = { ...clone(this._activatedRoute.snapshot.queryParams) };

    for (const [key, value] of Object.entries(values)) {
      const queryParamKey = this._transformKeyToQueryParam(key);
      const field = this._fields[key];

      if (!field) {
        continue;
      }

      const isDefault = this._isDefaultValue(key, value);
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

    this._zone.run(() => {
      queueMicrotask(() => {
        this._router.navigate([], {
          queryParams,
          replaceUrl,
          queryParamsHandling: 'merge',
        });
      });
    });
  }

  private _handleFormChange(forceOverwrite = false) {
    const currentVal = clone(this._currentFormValue$.value);
    const newVal = clone(this._formValue);

    if (equal(currentVal, newVal)) {
      return;
    }

    if (forceOverwrite) {
      this._lastFormValue$.next(newVal);
    } else {
      this._lastFormValue$.next(currentVal);
    }

    this._currentFormValue$.next(newVal);
  }

  private _cleanup() {
    if (!this._isObserving) return;

    this._isObserving = false;

    const queryParamKeys = Object.keys(this._fields);
    const queryParams = queryParamKeys.reduce(
      (acc, key) => {
        acc[this._transformKeyToQueryParam(key)] = undefined;
        return acc;
      },
      {} as Record<string, unknown>,
    );
    this._zone.run(() => {
      queueMicrotask(() => {
        this._router.navigate([], {
          queryParams,
          replaceUrl: true,
          queryParamsHandling: 'merge',
        });
      });
    });
  }
}
