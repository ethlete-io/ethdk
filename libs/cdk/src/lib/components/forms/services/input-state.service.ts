import { FocusOrigin } from '@angular/cdk/a11y';
import { Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, combineLatest, filter, map, Observable, of, Subject, switchMap } from 'rxjs';
import { NativeInputRefDirective } from '../directives/native-input-ref';
import { InputTouchedFn, InputValueChangeFn, InputValueUpdateType, ValidatorErrors } from '../types';

@Injectable()
export class InputStateService<T = unknown, J extends HTMLElement = HTMLElement> {
  readonly lastUpdateType$ = new BehaviorSubject<InputValueUpdateType | null>(null);
  readonly lastUpdateType = toSignal(this.lastUpdateType$, { requireSync: true });

  readonly onInternalUpdate$ = this.lastUpdateType$.pipe(filter((type) => type === 'internal'));
  readonly onExternalUpdate$ = this.lastUpdateType$.pipe(filter((type) => type === 'external'));

  readonly value$ = new BehaviorSubject<T | null>(null);
  readonly value = toSignal(this.value$, { requireSync: true });

  readonly disabled$ = new BehaviorSubject<boolean>(false);
  readonly disabled = toSignal(this.disabled$, { requireSync: true });

  readonly required$ = new BehaviorSubject<boolean>(false);
  readonly required = toSignal(this.required$, { requireSync: true });

  readonly valueChange$ = new Subject<T>();
  readonly disabledChange$ = new Subject<boolean>();
  readonly requiredChange$ = new Subject<boolean>();

  readonly usesImplicitControl$ = new BehaviorSubject<boolean>(false);
  readonly usesImplicitControl = toSignal(this.usesImplicitControl$, { requireSync: true });

  readonly nativeInputRef$ = new BehaviorSubject<NativeInputRefDirective<J> | null>(null);
  readonly nativeInputRef = toSignal(this.nativeInputRef$, { requireSync: true });

  readonly isNeverEmptyInput$ = new BehaviorSubject<boolean>(false);
  readonly isNeverEmptyInput = toSignal(this.isNeverEmptyInput$, { requireSync: true });

  readonly autofilled$ = new BehaviorSubject<boolean>(false);
  readonly autofilled = toSignal(this.autofilled$, { requireSync: true });

  readonly valueIsTruthy$ = this.value$.pipe(map((value) => !!value));
  readonly valueIsTruthy = toSignal(this.valueIsTruthy$, { requireSync: true });

  readonly valueIsFalsy$ = this.value$.pipe(map((value) => !value));
  readonly valueIsFalsy = toSignal(this.valueIsFalsy$, { requireSync: true });

  /**
   * Selects might have a option that is "null".
   * This helper can be used to enhance the detection of empty values.
   * The input is empty if the helper returns a falsy value and the value itself is falsy or an empty array.
   */
  readonly isEmptyHelper$ = new BehaviorSubject<unknown | Observable<unknown>>(undefined);
  readonly isEmptyHelper = toSignal(this.isEmptyHelper$, { requireSync: true });

  readonly valueIsEmpty$ = combineLatest([
    this.value$,
    this.autofilled$,
    this.isEmptyHelper$.pipe(
      switchMap((isEmptyHelper) => (isEmptyHelper instanceof Observable ? isEmptyHelper : of(isEmptyHelper))),
    ),
  ]).pipe(
    map(([value, autofilled, isEmptyHelper]) => {
      const defaultIsEmpty =
        (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) &&
        !autofilled;

      if (isEmptyHelper !== undefined) {
        return !isEmptyHelper && defaultIsEmpty;
      }

      return defaultIsEmpty;
    }),
  );
  readonly valueIsEmpty = toSignal(this.valueIsEmpty$, { requireSync: true });

  readonly errors$ = new BehaviorSubject<ValidatorErrors | null>(null);
  readonly errors = toSignal(this.errors$, { requireSync: true });

  readonly shouldDisplayError$ = new BehaviorSubject<boolean>(false);
  readonly shouldDisplayError = toSignal(this.shouldDisplayError$, { requireSync: true });

  readonly isFocusedVia$ = new BehaviorSubject<FocusOrigin | null>(null);
  readonly isFocusedVia = toSignal(this.isFocusedVia$, { requireSync: true });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _valueChange: InputValueChangeFn<T> = (value) => {
    // stub
  };
  _touched: InputTouchedFn = () => {
    // stub
  };
}
