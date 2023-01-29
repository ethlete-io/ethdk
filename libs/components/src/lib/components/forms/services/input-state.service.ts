import { Injectable, InjectionToken, Injector, Optional, SkipSelf } from '@angular/core';
import { BehaviorSubject, combineLatest, map, Subject } from 'rxjs';
import { NativeInputRefDirective } from '../directives';
import { ValidatorErrors } from '../types';

export type InputValueChangeFn<T = unknown> = (value: T) => void;
export type InputTouchedFn = () => void;

export const provideInputStateServiceIfNotProvided = () => ({
  provide: InputStateService,
  useFactory: (parentInjector: Injector, parentInputStateService?: InputStateService) => {
    if (!parentInputStateService) {
      const injector = Injector.create({ providers: [{ provide: InputStateService }], parent: parentInjector });
      parentInputStateService = injector.get(InputStateService);
    }

    return parentInputStateService;
  },
  deps: [Injector, [new Optional(), new SkipSelf(), InputStateService]],
});

export const INPUT_STATE_SERVICE_TOKEN = new InjectionToken<InputStateService>('ET_INPUT_STATE_SERVICE_TOKEN');

@Injectable()
export class InputStateService<T = unknown> {
  readonly value$ = new BehaviorSubject<T | null>(null);
  readonly disabled$ = new BehaviorSubject<boolean>(false);
  readonly required$ = new BehaviorSubject<boolean>(false);

  readonly valueChange$ = new Subject<T>();
  readonly disabledChange$ = new Subject<boolean>();
  readonly requiredChange$ = new Subject<boolean>();

  readonly usesImplicitControl$ = new BehaviorSubject<boolean>(false);
  readonly nativeInputRef$ = new BehaviorSubject<NativeInputRefDirective | null>(null);

  readonly autofilled$ = new BehaviorSubject<boolean>(false);

  readonly valueIsTruthy$ = this.value$.pipe(map((value) => !!value));
  readonly valueIsFalsy$ = this.value$.pipe(map((value) => !value));

  readonly valueIsEmpty$ = combineLatest([this.value$, this.autofilled$]).pipe(
    map(([value, autofilled]) => (value === null || value === undefined || value === '') && !autofilled),
  );

  readonly errors$ = new BehaviorSubject<ValidatorErrors | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _valueChange: InputValueChangeFn<T> = (value) => {
    // stub
  };
  _touched: InputTouchedFn = () => {
    // stub
  };
}
