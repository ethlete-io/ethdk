import { NgZone, assertInInjectionContext, inject, isDevMode } from '@angular/core';
import { AbstractControl, FormGroup, ɵValue } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ET_PROPERTY_REMOVED, RouterStateService, clone, createDestroy, equal } from '@ethlete/core';
import {
  BehaviorSubject,
  Subject,
  concat,
  debounce,
  map,
  merge,
  of,
  startWith,
  take,
  takeUntil,
  tap,
  timer,
  withLatestFrom,
} from 'rxjs';
import {
  QueryFieldOptions,
  QueryFormGroupControls,
  QueryFormObserveOptions,
  QueryFormValue,
  QueryFormValueEvent,
} from './query-form.types';

const ET_ARR_PREFIX = 'ET_ARR__';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class QueryFormGroup<T extends { [K in keyof T]: AbstractControl<any, any> } = any> extends FormGroup<T> {
  override patchValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: 0 extends 1 & T ? { [key: string]: any } : Partial<{ [K in keyof T]: ɵValue<T[K]> }>,
    options?: { onlySelf?: boolean | undefined; emitEvent?: boolean | undefined } | undefined,
  ): void {
    super.patchValue(value, options);
  }
}

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
      this._currentDebounceTimeout = null;
    }

    if (value === this.control.value) {
      return;
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
    return concat(
      obs.pipe(take(1)),
      this.control.valueChanges.pipe(
        debounce((v) => {
          if ((this.data.disableDebounceIfFalsy && !v) || !this.data.debounce) {
            return of(0);
          }

          return timer(this.data.debounce);
        }),
      ),
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class QueryForm<T extends Record<string, QueryField<any>>> {
  private readonly _destroy$ = createDestroy();
  private readonly _unobserveTrigger$ = new Subject<boolean>();
  private readonly _router = inject(Router);
  private readonly _activatedRoute = inject(ActivatedRoute);
  private readonly _defaultValues = this._extractDefaultValues();
  private readonly _routerStateService = inject(RouterStateService);
  private readonly _zone = inject(NgZone);

  private _isObserving = false;

  readonly form = this._setupFormGroup();

  private readonly _lastFormValue$ = new BehaviorSubject<{ id: number; data: QueryFormValue<T> } | null>(null);
  private readonly _currentFormValue$ = new BehaviorSubject<{ id: number; data: QueryFormValue<T> }>({
    id: 0,
    data: this._formValue,
  });

  private get _formValue() {
    return this.form.getRawValue() as QueryFormValue<T>;
  }

  private readonly _changes$ = new BehaviorSubject<QueryFormValueEvent<T>>({
    previousValue: null,
    currentValue: this.form.getRawValue() as QueryFormValue<T>,
  });

  readonly changes$ = this._currentFormValue$.pipe(withLatestFrom(this._lastFormValue$)).pipe(
    map(([currentValueEvent, previousValueEvent]) => {
      return {
        previousValue: previousValueEvent?.data ?? null,
        currentValue: currentValueEvent.data,
      };
    }),
  );

  get controls() {
    return this.form.controls;
  }

  get value() {
    return this._changes$.value.currentValue;
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
      this.setFormValueFromUrlQueryParams({
        queryParams: this._routerStateService.queryParams,
      });
    }

    merge(...Object.values(this._fields).map((field) => field.changes$))
      .pipe(
        startWith(null),
        tap(() => {
          this._lastFormValue$.next(clone(this._currentFormValue$.value));
          this._currentFormValue$.next({ id: this._currentFormValue$.value.id + 1, data: clone(this._formValue) });
        }),
        takeUntil(this._destroy$),
        takeUntil(this._unobserveTrigger$),
      )
      .subscribe();

    this._currentFormValue$
      .pipe(
        tap((currentValueEvent) => {
          const previousValueEvent = this._lastFormValue$.value;
          const currentValue = currentValueEvent.data;

          if (options?.writeToQueryParams !== false) {
            this._syncViaUrlQueryParams(currentValueEvent.data, options?.replaceUrl);
          }

          const didResetValues = this._handleQueryFormResets(previousValueEvent?.data ?? null, currentValue);

          if (didResetValues) {
            return;
          }

          if (this._currentFormValue$.value.id !== currentValueEvent.id) {
            return;
          }

          this._changes$.next({
            previousValue: previousValueEvent?.data ?? null,
            currentValue: currentValueEvent.data,
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
          tap((changes) => this.setFormValueFromUrlQueryParams({ queryParams: changes })),
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
  }

  setFormValueFromUrlQueryParams(options: { queryParams: Record<string, unknown>; skipDebounce?: boolean }) {
    for (const [key, field] of Object.entries(this._fields)) {
      const value = options.queryParams[key];

      const valueDoesNotExist = value === undefined;

      if (valueDoesNotExist) continue;

      const valueGotRemoved = value === ET_PROPERTY_REMOVED;

      if (valueGotRemoved) {
        field.setValue(this._getDefaultValue(key), { skipDebounce: options?.skipDebounce ?? true });

        continue;
      }

      const deserializedValue = field.data.queryParamToValueTransformFn?.(value) ?? value;
      const valueIsEqualToCurrent = equal(deserializedValue, field.control.value);

      if (valueIsEqualToCurrent) continue;

      field.setValue(deserializedValue, { skipDebounce: options?.skipDebounce ?? true });
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
    const group = new QueryFormGroup({} as QueryFormGroupControls<T>);

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
}
