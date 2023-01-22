import { Injectable, Injector, Optional, SkipSelf } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

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
  value$ = new BehaviorSubject<T | null>(null);
  disabled$ = new BehaviorSubject<boolean>(false);
  required$ = new BehaviorSubject<boolean>(false);

  valueChange$ = new Subject<T>();
  disabledChange$ = new Subject<boolean>();
  requiredChange$ = new Subject<boolean>();

  usesImplicitControl$ = new BehaviorSubject<boolean>(false);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _valueChange: InputValueChangeFn<T> = (value) => {
    // stub
  };
  _touched: InputTouchedFn = () => {
    // stub
  };
}
