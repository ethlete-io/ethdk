import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { Directive, InjectionToken, Input } from '@angular/core';

export const SELECT_OPTION_TOKEN = new InjectionToken<SelectOptionDirective>('ET_SELECT_OPTION_TOKEN');

let uniqueId = 0;

@Directive({
  standalone: true,
  providers: [
    {
      provide: SELECT_OPTION_TOKEN,
      useExisting: SelectOptionDirective,
    },
  ],
  host: {
    '[attr.id]': 'id',
    '[attr.aria-disabled]': 'disabled || null',
    '[class.et-select-option--disabled]': 'disabled',
    role: 'option',
  },
})
export class SelectOptionDirective {
  readonly id = `et-select-option-${uniqueId++}`;

  @Input({ required: true })
  get value() {
    return this._value;
  }
  set value(value: unknown) {
    this._value = value;
  }
  private _value: unknown = null;

  @Input()
  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(value: BooleanInput) {
    this._disabled = coerceBooleanProperty(value);
  }
  private _disabled = false;
}
