import { Directive, InjectionToken, Input, booleanAttribute, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, merge } from 'rxjs';
import { createDestroy } from '../../utils';

export const DEBUG_TOKEN = new InjectionToken<DebugDirective>('DEBUG_DIRECTIVE_TOKEN');

@Directive({
  selector: '[etDebug]',
  exportAs: 'etDebug',
  standalone: true,
  providers: [
    {
      provide: DEBUG_TOKEN,
      useExisting: DebugDirective,
    },
  ],
})
export class DebugDirective {
  private readonly _destroy$ = createDestroy();

  @Input({ alias: 'etDebug', transform: booleanAttribute })
  private set sDebug(value: boolean) {
    this._debug.set(value);
  }

  private _debug = signal(true);
  readonly debug = this._debug.asReadonly();
  readonly debug$ = toObservable(this.debug);

  readonly startDebug$ = this.debug$.pipe(filter((debug) => !!debug));
  readonly stopDebug$ = merge(this._destroy$, this.debug$.pipe(filter((debug) => !debug)));
}
