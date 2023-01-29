import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
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

  @Input()
  get value() {
    return this._value$.getValue();
  }
  set value(value: RadioValue) {
    this._value$.next(value);
  }
  private _value$ = new BehaviorSubject<RadioValue>(null);

  @Input()
  get disabled(): boolean {
    return this._disabled$.getValue();
  }
  set disabled(value: BooleanInput) {
    this._disabled$.next(coerceBooleanProperty(value));
  }
  private _disabled$ = new BehaviorSubject(false);

  readonly checked$ = combineLatest([this.input.value$, this._value$]).pipe(
    map(([inputValue, value]) => inputValue === value),
  );

  readonly disabled$ = combineLatest([this.input.disabled$, this._disabled$]).pipe(
    map(([inputDisabled, disabled]) => inputDisabled || disabled),
  );

  readonly _bindings = createReactiveBindings(
    {
      attribute: ['class.et-radio--checked'],
      observable: this.checked$,
    },
    {
      attribute: ['class.et-radio--disabled'],
      observable: this.disabled$,
    },
  );

  _onInputInteraction(event: Event) {
    event.stopPropagation();

    if (this.disabled) {
      return;
    }

    this.input._updateValue(this.value);

    this._controlTouched();
  }

  _controlTouched() {
    this.input._markAsTouched();
  }
}
