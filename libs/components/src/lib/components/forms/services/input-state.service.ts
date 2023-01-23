import { Injectable, Injector, Optional, SkipSelf } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { NativeInputRefDirective } from '../directives';

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _valueChange: InputValueChangeFn<T> = (value) => {
    // stub
  };
  _touched: InputTouchedFn = () => {
    // stub
  };
}
