import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  ChangeDetectorRef,
  Directive,
  EventEmitter,
  forwardRef,
  HostBinding,
  inject,
  InjectionToken,
  Input,
  Output,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export const CHECKBOX_VALUE_ACCESSOR = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => CheckboxDirective),
  multi: true,
};

export const CHECKBOX_TOKEN = new InjectionToken<CheckboxDirective>('ET_CHECKBOX_DIRECTIVE_TOKEN');

let nextUniqueId = 0;

@Directive({
  standalone: true,
  providers: [CHECKBOX_VALUE_ACCESSOR, { provide: CHECKBOX_TOKEN, useExisting: CheckboxDirective }],
  exportAs: 'etCheckbox',
})
export class CheckboxDirective implements ControlValueAccessor {
  private readonly _cdr = inject(ChangeDetectorRef);

  private readonly _uniqueId = `et-checkbox-${++nextUniqueId}`;

  get uniqueId() {
    return this._uniqueId;
  }

  @Input()
  @HostBinding('class.et-checkbox--checked')
  get checked(): boolean {
    return this._checked;
  }
  set checked(checked: BooleanInput) {
    const checkedAsBool = coerceBooleanProperty(checked);

    if (checkedAsBool === this._checked) {
      return;
    }

    this._checked = checkedAsBool;
  }
  private _checked = false;

  @Input()
  @HostBinding('class.et-checkbox--disabled')
  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(value: BooleanInput) {
    const newValue = coerceBooleanProperty(value);

    if (newValue !== this.disabled) {
      this._disabled = newValue;
      this._cdr.markForCheck();
      this.disabledChange.emit(newValue);
    }
  }
  private _disabled = false;

  @Input()
  @HostBinding('class.et-checkbox--indeterminate')
  get indeterminate(): boolean {
    return this._indeterminate && !this.checked;
  }
  set indeterminate(value: BooleanInput) {
    this._indeterminate = coerceBooleanProperty(value);
  }
  private _indeterminate = false;

  @Input()
  id?: string; // TODO(TRB): LabelRef should be used instead of id.

  @Output()
  // eslint-disable-next-line @angular-eslint/no-output-native
  readonly change = new EventEmitter<boolean>();

  @Output()
  readonly disabledChange = new EventEmitter<boolean>();

  // The id should get passed to the input and not used by the host element.
  @HostBinding('attr.id')
  get hostId() {
    return undefined;
  }

  writeValue(checked: boolean) {
    this.checked = checked;
  }

  registerOnChange(fn: (value: boolean | null) => void) {
    this._controlValueAccessorChangeFn = fn;
  }

  registerOnTouched(fn: () => void) {
    this._onTouched = fn;
  }

  setDisabledState(isDisabled: boolean) {
    this.disabled = isDisabled;
  }

  _controlValueAccessorChangeFn: (value: boolean | null) => void = () => {
    // no-op
  };

  _onTouched: () => void = () => {
    // no-op
  };

  _onInputInteraction(event: Event) {
    event.stopPropagation();

    if (this.disabled) {
      return;
    }

    this.checked = !this.checked;
    this._emitChangeEvent();

    this._controlValueAccessorChangeFn(this.checked);
  }

  _markForCheck() {
    this._cdr.markForCheck();
  }

  _emitChangeEvent(): void {
    this.change.emit(this.checked);
  }
}
