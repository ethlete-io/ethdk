import { AfterContentInit, ContentChildren, Directive, forwardRef, inject, InjectionToken } from '@angular/core';
import { createReactiveBindings, TypedQueryList } from '@ethlete/core';
import { combineLatest, map, startWith, switchMap } from 'rxjs';
import { InputStateService } from '../../../../services';
import { RadioValue } from '../../types';
import { RADIO_TOKEN, RadioDirective } from '../radio';

export const RADIO_FIELD_TOKEN = new InjectionToken<RadioFieldDirective>('ET_RADIO_FIELD_DIRECTIVE_TOKEN');

@Directive({
  standalone: true,
  providers: [{ provide: RADIO_FIELD_TOKEN, useExisting: RadioFieldDirective }],
  exportAs: 'etRadioField',
})
export class RadioFieldDirective implements AfterContentInit {
  readonly inputState = inject<InputStateService<RadioValue>>(InputStateService);

  readonly _bindings = createReactiveBindings();

  @ContentChildren(forwardRef(() => RADIO_TOKEN), { descendants: true })
  private _radio?: TypedQueryList<RadioDirective>;

  ngAfterContentInit(): void {
    if (!this._radio) {
      return;
    }

    this._bindings.push({
      attribute: 'class.et-radio-field--checked',
      observable: this._radio.changes.pipe(startWith(this._radio)).pipe(
        switchMap((radios) =>
          combineLatest(radios.filter((radio): radio is RadioDirective => !!radio).map((radio) => radio.checked$)),
        ),
        map((checked) => checked.some((value) => value)),
      ),
    });

    this._bindings.push({
      attribute: 'class.et-radio-field--disabled',
      observable: this._radio.changes.pipe(startWith(this._radio)).pipe(
        switchMap((radios) =>
          combineLatest(radios.filter((radio): radio is RadioDirective => !!radio).map((radio) => radio.disabled$)),
        ),
        map((disabled) => disabled.some((value) => value)),
      ),
    });
  }
}
