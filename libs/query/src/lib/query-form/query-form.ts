import { NgZone, assertInInjectionContext, inject, isDevMode } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ET_PROPERTY_REMOVED, RouterStateService, clone, createDestroy, equal } from '@ethlete/core';
import { BehaviorSubject, Subject, debounceTime, map, merge, of, switchMap, takeUntil, tap, timer } from 'rxjs';
import {
  QueryFieldOptions,
  QueryFormGroupControls,
  QueryFormObserveOptions,
  QueryFormValue,
  QueryFormValueEvent,
  QueryFormWriteOptions,
} from './query-form.types';
import { transformToBoolean, transformToNumber } from './query-form.utils';

const ET_ARR_PREFIX = 'ET_ARR__';

export class QueryField<T> {
  get control() {
    return this.data.control;
  }

  constructor(public data: QueryFieldOptions<T>) {}
}

const IGNORED_FILTER_COUNT_FIELDS = ['page', 'skip', 'take', 'limit', 'sort', 'sortBy', 'sortOrder', 'query', 'search'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class QueryForm<T extends Record<string, QueryField<any>>> {
  private readonly _destroy$ = createDestroy();
  private readonly _unobserveTrigger$ = new Subject<boolean>();
  private readonly _router = inject(Router);
  private readonly _activatedRoute = inject(ActivatedRoute);
  private readonly _defaultValues = this._extractDefaultValues();
  private readonly _routerStateService = inject(RouterStateService);
  private readonly _zone = inject(NgZone);
  private readonly _didValueChanges$ = new Subject<boolean>();

  private _isObserving = false;
  private _skipNextResets = false;

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

  private readonly _changes$ = new BehaviorSubject<QueryFormValueEvent<T>>({
    previousValue: null,
    currentValue: this.form.getRawValue() as QueryFormValue<T>,
  });

  readonly changes$ = this._changes$.asObservable();

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
            if (IGNORED_FILTER_COUNT_FIELDS.includes(key) || this._fields[key].data.skipInFilterCount) {
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

  constructor(private _fields: T) {
    assertInInjectionContext(QueryForm);
  }

  observe(options?: QueryFormObserveOptions) {
    if (this._isObserving) {
      if (isDevMode()) {
        console.warn('QueryForm.observe() was called multiple times. This is not supported.');
      }
      return;
    }

    this._isObserving = true;

    if (options?.syncOnNavigation !== false) {
      const didChanges = this.setFormValueFromUrlQueryParams({
        queryParams: this._routerStateService.queryParams,
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
            const fieldData = this._fields[key].data;

            if (fieldData.disableDebounceIfFalsy === true && !currentValue[key]) {
              return null;
            }

            return fieldData.debounce ?? null;
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
      this._routerStateService.queryParamChanges$
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
  }

  private _handleQueryFormResets(previousValue: QueryFormValue<T> | null, currentValue: QueryFormValue<T>) {
    let didResetValues = false;

    for (const formFieldKey in this._fields) {
      const resets = this._fields[formFieldKey].data.isResetBy;

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

          this.form.controls[formFieldKey].setValue(defaultValueForKeyToReset, { emitEvent: false });

          didResetValues = true;

          break;
        }
      }
    }

    return didResetValues;
  }

  unobserve() {
    this._unobserveTrigger$.next(true);
  }

  setFormValueFromUrlQueryParams(options: { queryParams: Record<string, unknown> }) {
    let didValueChanges = false;

    for (const [key, field] of Object.entries(this._fields)) {
      const value = options.queryParams[key];

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
      } else if (typeof this._getDefaultValue(key) === 'number') {
        deserializedValue = transformToNumber(value);
      } else if (typeof this._getDefaultValue(key) === 'boolean') {
        deserializedValue = transformToBoolean(value);
      }

      const valueIsEqualToCurrent = equal(deserializedValue, field.control.value);

      if (valueIsEqualToCurrent) continue;

      field.control.setValue(deserializedValue, { emitEvent: false });
      didValueChanges = true;
    }

    return didValueChanges;
  }

  setValue(value: QueryFormValue<T>, options?: QueryFormWriteOptions) {
    this.form.setValue(value, options);

    if (options?.skipResets) {
      this._skipNextResets = true;
    }
  }

  patchValue(value: Partial<QueryFormValue<T>>, options?: QueryFormWriteOptions) {
    this.form.patchValue(value, options);

    if (options?.skipResets) {
      this._skipNextResets = true;
    }
  }

  private _getDefaultValue(key: string) {
    const val = this._defaultValues[key];

    if (typeof val === 'string' && val.startsWith(ET_ARR_PREFIX)) {
      return JSON.parse(val.slice(ET_ARR_PREFIX.length));
    }

    return val ?? null;
  }

  private _isDefaultValue(key: string, value: unknown) {
    const normalizedValue = Array.isArray(value) ? `${ET_ARR_PREFIX}${JSON.stringify(value)}` : value;

    return this._getDefaultValue(key) === normalizedValue;
  }

  private _setupFormGroup() {
    const group = new FormGroup({} as QueryFormGroupControls<T>);

    for (const [key, field] of Object.entries(this._fields)) {
      group.addControl(key, field.control);
    }

    return group;
  }

  private _extractDefaultValues() {
    const defaultValues: Record<string, unknown> = {};

    for (const [key, field] of Object.entries(this._fields)) {
      const value = field.control.value;

      if (Array.isArray(value)) {
        defaultValues[key] = `${ET_ARR_PREFIX}${JSON.stringify(value)}`;
      } else {
        defaultValues[key] = value;
      }
    }

    return defaultValues;
  }

  private _syncViaUrlQueryParams(values: QueryFormValue<T>, replaceUrl?: boolean) {
    const queryParams = { ...clone(this._activatedRoute.snapshot.queryParams) };

    for (const [key, value] of Object.entries(values)) {
      if (!this._fields[key]) {
        console.warn(`The field "${key}" is not defined in the QueryForm. Is it a typo?`, this);
        continue;
      }

      if (this._isDefaultValue(key, value) || this._fields[key].data.appendToUrl === false) {
        delete queryParams[key];
      } else {
        queryParams[key] = this._fields[key].data.valueToQueryParamTransformFn
          ? this._fields[key].data.valueToQueryParamTransformFn?.(value)
          : value;
      }
    }

    this._zone.run(() => {
      this._router.navigate([], {
        queryParams,
        replaceUrl,
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
}
