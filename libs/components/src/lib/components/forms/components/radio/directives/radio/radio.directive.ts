import { Directive, inject, InjectionToken, Input } from '@angular/core';
import { createReactiveBindings, DestroyService } from '@ethlete/core';
import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { InputDirective, INPUT_TOKEN } from '../../../../directives';
import { RadioValue } from '../../types';

export const RADIO_TOKEN = new InjectionToken<RadioDirective>('ET_RADIO_DIRECTIVE_TOKEN');

@Directive({
  standalone: true,
  providers: [{ provide: RADIO_TOKEN, useExisting: RadioDirective }, DestroyService],
  exportAs: 'etRadio',
})
export class RadioDirective {
  readonly input = inject<InputDirective<RadioValue>>(INPUT_TOKEN);
  // readonly formControlHost = inject(FORM_CONTROL_HOST_TOKEN);

  @Input()
  get value() {
    return this._value$.getValue();
  }
  set value(value: RadioValue) {
    this._value$.next(value);
  }
  private _value$ = new BehaviorSubject<RadioValue>(null);

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

  // constructor() {
  //   this.formControlHost._bindings.remove('class.et-value-is-truthy');
  //   this.formControlHost._bindings.remove('class.et-value-is-falsy');

  //   this.formControlHost._bindings.push({
  //     attribute: 'class.et-value-is-truthy',
  //     observable: this.checked$,
  //   });

  //   this.formControlHost._bindings.push({
  //     attribute: 'class.et-value-is-falsy',
  //     observable: this.checked$.pipe(map((checked) => !checked)),
  //   });
  // }

  _onInputInteraction(event: Event) {
    event.stopPropagation();

    this.input._updateValue(this.value);

    this._controlTouched();
  }

  _controlTouched() {
    this.input._markAsTouched();
  }
}
