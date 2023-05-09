import { inject, isDevMode } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { clone, equal } from '@ethlete/core';
import {
  BehaviorSubject,
  combineLatest,
  concat,
  debounceTime,
  distinctUntilChanged,
  map,
  pairwise,
  shareReplay,
  startWith,
  take,
  tap,
} from 'rxjs';
import {
  QueryFieldOptions,
  QueryFormGroup,
  QueryFormObserveOptions,
  QueryFormValue,
  QueryFormValueEvent,
} from './query-form.types';

export class QueryField<T> {
  changes$ = this._setupChangesObservable();

  get control() {
    return this.data.control;
  }

  private _currentDebounceTimeout: number | null = null;

  constructor(public data: QueryFieldOptions<T>) {}

  setValue(value: T | null, options?: { skipDebounce?: boolean }) {
    if (this._currentDebounceTimeout !== null) {
      clearTimeout(this._currentDebounceTimeout);
    }

    if (this.data.debounce && !options?.skipDebounce) {
      this._currentDebounceTimeout = window.setTimeout(() => {
        this.control.setValue(value);
      }, this.data.debounce);
    } else {
      this.control.setValue(value);
    }
  }

  private _setupChangesObservable() {
    const obs = this.control.valueChanges.pipe(startWith(this.control.value));

    if (!this.data.debounce) {
      return obs;
    }

    // The initial value should get emitted immediately
    // concat switches to the debounced observable after the first observable is completed
    return concat(obs.pipe(take(1)), this.control.valueChanges.pipe(debounceTime(this.data.debounce)));
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class QueryForm<T extends Record<string, QueryField<any>>> {
  private _router = inject(Router, { optional: true });
  private _activatedRoute = inject(ActivatedRoute, { optional: true });
  private _defaultValues = this._extractDefaultValues();

  form = this._setupFormGroup();

  private get _formValue() {
    return this.form.getRawValue() as QueryFormValue<T>;
  }

  private readonly _changes$ = new BehaviorSubject<QueryFormValueEvent<T>>({
    previousValue: null,
    currentValue: this.form.getRawValue() as QueryFormValue<T>,
  });

  readonly changes$ = this._changes$.asObservable();

  get controls() {
    return this.form.controls;
  }

  get value() {
    return this._changes$.value.currentValue;
  }

  constructor(private _fields: T) {}

  observe(options?: QueryFormObserveOptions) {
    return combineLatest(Object.values(this._fields).map((field) => field.changes$)).pipe(
      map(() => this._formValue),
      distinctUntilChanged((a, b) => equal(a, b)),
      tap((values) => {
        if (options?.syncViaUrlQueryParams !== false) {
          this._syncViaUrlQueryParams(values);
        }
      }),
      pairwise(),
      startWith([null, this._formValue] as const),
      map(([previousValue, currentValue]) => ({ previousValue, currentValue })),
      tap(({ previousValue, currentValue }) => {
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
              const defaultValueForKeyToReset = this._defaultValues[formFieldKey];
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

        if (!didResetValues) {
          this._changes$.next({
            previousValue,
            currentValue,
          });
        }
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
      map(() => null),
    );
  }

  setFormValueFromUrlQueryParams(options?: { skipDebounce?: boolean }) {
    if (!this._activatedRoute) {
      throw new Error('Cannot set form value from url query params without ActivatedRoute');
    }

    const queryParams = this._activatedRoute.snapshot.queryParams;

    for (const [key, field] of Object.entries(this._fields)) {
      const value = queryParams[key];

      // We only check using == because the value types can be different (e.g. "1" and 1)
      if (value === undefined || value == field.control.value) {
        continue;
      }

      const deserializedValue = field.data.queryParamToValueTransformFn?.(value) ?? value;

      field.setValue(deserializedValue, { skipDebounce: options?.skipDebounce ?? true });
    }
  }

  updateFormOnUrlQueryParamsChange() {
    if (!this._activatedRoute) {
      throw new Error('Cannot update form on url query params change without ActivatedRoute');
    }

    return this._activatedRoute.queryParams.pipe(tap(() => this.setFormValueFromUrlQueryParams()));
  }

  private _getDefaultValue(key: string) {
    return this._defaultValues[key] ?? null;
  }

  private _isDefaultValue(key: string, value: unknown) {
    const normalizedValue = Array.isArray(value) ? JSON.stringify(value) : value;

    return this._getDefaultValue(key) === normalizedValue;
  }

  private _setupFormGroup() {
    const group = new FormGroup({} as QueryFormGroup<T>);

    for (const [key, field] of Object.entries(this._fields)) {
      group.addControl(key, field.control);
    }

    return group;
  }

  private _extractDefaultValues() {
    const defaultValues: Record<string, unknown> = {};

    for (const [key, field] of Object.entries(this._fields)) {
      const value = field.control.value;

      if (value === null || value === undefined) {
        continue;
      }

      if (Array.isArray(value)) {
        defaultValues[key] = JSON.stringify(value);
      } else {
        defaultValues[key] = value;
      }
    }

    return defaultValues;
  }

  private _syncViaUrlQueryParams(values: Record<string, unknown>) {
    if (!this._router || !this._activatedRoute) {
      return;
    }

    const queryParams = { ...clone(this._activatedRoute.snapshot.queryParams) };

    for (const [key, value] of Object.entries(values)) {
      if (this._isDefaultValue(key, value) || this._fields[key].data.appendToUrl === false) {
        delete queryParams[key];
      } else {
        queryParams[key] = this._fields[key].data.valueToQueryParamTransformFn
          ? this._fields[key].data.valueToQueryParamTransformFn?.(value)
          : value;
      }
    }

    this._router.navigate([], {
      queryParams,
    });
  }
}
