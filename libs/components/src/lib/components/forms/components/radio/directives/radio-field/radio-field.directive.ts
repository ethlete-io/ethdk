import { AfterContentInit, ContentChildren, Directive, inject, InjectionToken } from '@angular/core';
import { createReactiveBindings, DestroyService, TypedQueryList } from '@ethlete/core';
import { combineLatest, map, startWith } from 'rxjs';
import { InputStateService } from '../../../../services';
import { RadioValue } from '../../types';
import { RadioDirective, RADIO_TOKEN } from '../radio';

export const RADIO_FIELD_TOKEN = new InjectionToken<RadioFieldDirective>('ET_RADIO_FIELD_DIRECTIVE_TOKEN');

@Directive({
  standalone: true,
  providers: [{ provide: RADIO_FIELD_TOKEN, useExisting: RadioFieldDirective }, DestroyService],
  exportAs: 'etRadioGroup',
})
export class RadioFieldDirective implements AfterContentInit {
  readonly inputState = inject<InputStateService<RadioValue>>(InputStateService);

  readonly _bindings = createReactiveBindings();

  @ContentChildren(RADIO_TOKEN, { descendants: true })
  private _radio?: TypedQueryList<RadioDirective>;

  ngAfterContentInit(): void {
    if (!this._radio) {
      return;
    }

    this._bindings.push({
      attribute: 'class.et-radio-field--checked',
      observable: combineLatest([this._radio.changes.pipe(startWith(this._radio)), this.inputState.value$]).pipe(
        map(([radios, value]) => radios.some((radio) => radio.value === value)),
      ),
    });
  }
}
