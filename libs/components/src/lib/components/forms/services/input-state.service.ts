import { FocusOrigin } from '@angular/cdk/a11y';
import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, map, Subject } from 'rxjs';
import { NativeInputRefDirective } from '../directives';
import { ValidatorErrors } from '../types';

export type InputValueChangeFn<T = unknown> = (value: T) => void;
export type InputTouchedFn = () => void;

@Injectable()
export class InputStateService<
  T = unknown,
  J extends HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement = HTMLInputElement,
> {
  readonly value$ = new BehaviorSubject<T | null>(null);
  readonly disabled$ = new BehaviorSubject<boolean>(false);
  readonly required$ = new BehaviorSubject<boolean>(false);

  readonly valueChange$ = new Subject<T>();
  readonly disabledChange$ = new Subject<boolean>();
  readonly requiredChange$ = new Subject<boolean>();

  readonly usesImplicitControl$ = new BehaviorSubject<boolean>(false);
  readonly nativeInputRef$ = new BehaviorSubject<NativeInputRefDirective<J> | null>(null);

  readonly autofilled$ = new BehaviorSubject<boolean>(false);

  readonly valueIsTruthy$ = this.value$.pipe(map((value) => !!value));
  readonly valueIsFalsy$ = this.value$.pipe(map((value) => !value));

  readonly valueIsEmpty$ = combineLatest([this.value$, this.autofilled$]).pipe(
    map(([value, autofilled]) => (value === null || value === undefined || value === '') && !autofilled),
  );

  readonly errors$ = new BehaviorSubject<ValidatorErrors | null>(null);
  readonly shouldDisplayError$ = new BehaviorSubject<boolean>(false);

  readonly isFocusedVia$ = new BehaviorSubject<FocusOrigin | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _valueChange: InputValueChangeFn<T> = (value) => {
    // stub
  };
  _touched: InputTouchedFn = () => {
    // stub
  };
}
