import { ContentChildren, Directive, forwardRef, inject, InjectionToken } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { signalHostClasses, switchQueryListChanges, TypedQueryList } from '@ethlete/core';
import { BehaviorSubject, combineLatest, map, of, switchMap } from 'rxjs';
import { InputStateService } from '../../../../services';
import { RADIO_TOKEN, RadioDirective } from '../radio';

export const RADIO_FIELD_TOKEN = new InjectionToken<RadioFieldDirective>('ET_RADIO_FIELD_DIRECTIVE_TOKEN');

@Directive({
  providers: [{ provide: RADIO_FIELD_TOKEN, useExisting: RadioFieldDirective }],
  exportAs: 'etRadioField',
})
export class RadioFieldDirective {
  readonly inputState = inject<InputStateService<unknown>>(InputStateService);

  // TODO: Skipped for migration because:
  //  Accessor queries cannot be migrated as they are too complex.
  // TODO: Skipped for migration because:
  //  Accessor queries cannot be migrated as they are too complex.
  // TODO: Skipped for migration because:
  //  Accessor queries cannot be migrated as they are too complex.
  // TODO: Skipped for migration because:
  //  Accessor queries cannot be migrated as they are too complex.
  // TODO: Skipped for migration because:
  //  Accessor queries cannot be migrated as they are too complex.
  @ContentChildren(forwardRef(() => RADIO_TOKEN), { descendants: true })
  set radio(radio: TypedQueryList<RadioDirective>) {
    this._radio$.next(radio);
  }
  private _radio$ = new BehaviorSubject<TypedQueryList<RadioDirective> | null>(null);

  readonly radioQueryList$ = this._radio$.pipe(switchQueryListChanges());

  readonly hostClassBindings = signalHostClasses({
    'et-radio-field--checked': toSignal(
      this.radioQueryList$.pipe(
        switchMap((radios) => (radios?.length ? combineLatest(radios.map((radio) => radio.checked$)) : of([]))),
        map((checked) => checked.some((value) => value)),
      ),
    ),
    'et-radio-field--disabled': toSignal(
      this.radioQueryList$.pipe(
        switchMap((radios) => (radios?.length ? combineLatest(radios.map((radio) => radio.disabled$)) : of([]))),
        map((disabled) => disabled.some((value) => value)),
      ),
    ),
  });
}
