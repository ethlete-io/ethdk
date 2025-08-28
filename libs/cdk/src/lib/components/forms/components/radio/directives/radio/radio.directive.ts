import { Directive, InjectionToken, Input, booleanAttribute, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { equal, signalHostClasses } from '@ethlete/core';
import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { INPUT_TOKEN, InputDirective } from '../../../../directives/input';

export const RADIO_TOKEN = new InjectionToken<RadioDirective>('ET_RADIO_DIRECTIVE_TOKEN');

@Directive({
  standalone: true,
  providers: [{ provide: RADIO_TOKEN, useExisting: RadioDirective }],
  exportAs: 'etRadio',
})
export class RadioDirective {
  readonly input = inject<InputDirective<unknown>>(INPUT_TOKEN);

  @Input()
  get value() {
    return this._value$.getValue();
  }
  set value(value: unknown) {
    this._value$.next(value);
  }
  private _value$ = new BehaviorSubject<unknown>(null);

  @Input()
  get disabled(): boolean {
    return this._disabled$.getValue();
  }
  set disabled(value: unknown) {
    this._disabled$.next(booleanAttribute(value));
  }
  private _disabled$ = new BehaviorSubject(false);

  readonly checked$ = combineLatest([this.input.value$, this._value$]).pipe(
    map(([inputValue, value]) => equal(inputValue, value)),
  );

  readonly disabled$ = combineLatest([this.input.disabled$, this._disabled$]).pipe(
    map(([inputDisabled, disabled]) => inputDisabled || disabled),
  );

  readonly hostClassBindings = signalHostClasses({
    'et-radio--checked': toSignal(this.checked$),
    'et-radio--disabled': toSignal(this.disabled$),
  });

  _onInputInteraction(event: Event) {
    event.stopPropagation();

    if (this.disabled) {
      return;
    }

    this.input._updateValue(this.value);

    this.input._markAsTouched();
    this.input._setShouldDisplayError(true);
  }

  _controlTouched() {
    this.input._markAsTouched();
    this.input._setShouldDisplayError(true);
  }
}
