import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

export type InputControlType = `et-control--${string}`;
export type InputValueChangeFn<T = unknown> = (value: T) => void;
export type InputTouchedFn = () => void;

@Injectable()
export class InputStateService<T = unknown> {
  value$ = new BehaviorSubject<T | null>(null);
  disabled$ = new BehaviorSubject<boolean>(false);
  required$ = new BehaviorSubject<boolean>(false);

  labelId$ = new BehaviorSubject<string | null>(null);
  inputId$ = new BehaviorSubject<string | null>(null);

  controlType$ = new BehaviorSubject<InputControlType | null>(null);

  valueChange$ = new Subject<T>();
  disabledChange$ = new Subject<boolean>();
  requiredChange$ = new Subject<boolean>();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _valueChange: InputValueChangeFn<T> = (value) => {
    // stub
  };
  _touched: InputTouchedFn = () => {
    // stub
  };
}
