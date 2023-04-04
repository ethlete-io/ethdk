import { Directive, InjectionToken } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export const DELAYABLE_TOKEN = new InjectionToken<DelayableDirective>('DELAYABLE_DIRECTIVE_TOKEN');

@Directive({
  selector: '[etDelayable]',
  exportAs: 'etDelayable',
  standalone: true,
  providers: [
    {
      provide: DELAYABLE_TOKEN,
      useExisting: DelayableDirective,
    },
  ],
})
export class DelayableDirective {
  private readonly _isDelayed$ = new BehaviorSubject(false);

  get isDelayed$() {
    return this._isDelayed$.asObservable();
  }

  get isDelayed() {
    return this._isDelayed$.value;
  }

  enableDelayed() {
    this._isDelayed$.next(true);
  }

  disableDelayed() {
    this._isDelayed$.next(false);
  }

  setDelayed(val: boolean) {
    this._isDelayed$.next(val);
  }
}
