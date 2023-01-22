import { Directive, inject, InjectionToken, Input } from '@angular/core';
import { createReactiveBindings, DestroyService } from '@ethlete/core';
import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { InputDirective, INPUT_TOKEN } from '../../../../directives';

export const RADIO_TOKEN = new InjectionToken<RadioDirective>('ET_RADIO_DIRECTIVE_TOKEN');

type RadioValue = string | number | boolean | null;

@Directive({
  standalone: true,
  providers: [{ provide: RADIO_TOKEN, useExisting: RadioDirective }, DestroyService],
  exportAs: 'etRadio',
})
export class RadioDirective {
  readonly input = inject<InputDirective<RadioValue>>(INPUT_TOKEN);

  @Input()
  get value() {
    return this._value$.getValue();
  }
  set value(value: RadioValue) {
    this._value$.next(value);
  }
  private _value$ = new BehaviorSubject<string | number | boolean | null>(false);

  readonly checked$ = combineLatest([this.input.value$, this._value$]).pipe(
    map(([inputValue, value]) => inputValue === value),
  );

  readonly _bindings = createReactiveBindings(
    {
      attribute: ['class.et-radio--checked'],
      observable: this.checked$,
    },
    {
      attribute: ['class.et-radio--disabled'],
      observable: this.input.disabled$,
    },
  );

  _onInputInteraction(event: Event) {
    event.stopPropagation();

    this.input._updateValue(this.value);
  }

  _controlTouched() {
    this.input._markAsTouched();
  }
}
