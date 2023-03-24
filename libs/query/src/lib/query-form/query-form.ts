import { inject } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { clone, equal } from '@ethlete/core';
import { combineLatest, concat, debounceTime, distinctUntilChanged, map, Observable, startWith, take, tap } from 'rxjs';
import { QueryFieldOptions, QueryFormGroup, QueryFormValue } from './query-form.types';

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

  constructor(private _fields: T) {}

  observe(options?: { syncViaUrlQueryParams?: boolean }) {
    return combineLatest(Object.values(this._fields).map((field) => field.changes$)).pipe(
      map(() => this.form.getRawValue()),
      distinctUntilChanged((a, b) => equal(a, b)),
      tap((values) => {
        if (options?.syncViaUrlQueryParams !== false) {
          this._syncViaUrlQueryParams(values);
        }
      }),

      // This type cast is needed since ng-packagr will break the type inference otherwise.
    ) as Observable<QueryFormValue<T>>;
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
