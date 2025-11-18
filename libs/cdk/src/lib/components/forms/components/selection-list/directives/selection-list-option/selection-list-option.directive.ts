import {
  Directive,
  ElementRef,
  InjectionToken,
  Input,
  booleanAttribute,
  computed,
  inject,
  signal,
} from '@angular/core';
import { INPUT_TOKEN, InputDirective } from '../../../../directives/input';
import { Primitive } from '../../../select/components/combobox/utils';
import { SELECTION_LIST_FIELD } from '../selection-list-field';

export const SELECTION_LIST_OPTION = new InjectionToken<SelectionListOptionDirective>(
  'ET_SELECTION_LIST_OPTION_DIRECTIVE_TOKEN',
);

@Directive({
  providers: [{ provide: SELECTION_LIST_OPTION, useExisting: SelectionListOptionDirective }],
  exportAs: 'etSelectionListOption',
  host: {
    class: 'et-selection-list-option',
    '[class.et-selection-list-option--selected]': 'selected()',
    '[class.et-selection-list-option--disabled]': 'disabled || input.disabled',
    role: 'option',
    '[attr.aria-selected]': 'selected()',
    '[attr.aria-disabled]': 'disabled || input.disabled',
    tabindex: '0',
    '(click)': '_onInputInteraction($event)',
    '(blur)': '_controlTouched()',
  },
})
export class SelectionListOptionDirective {
  readonly input = inject<InputDirective<Primitive | Primitive[] | null>>(INPUT_TOKEN);
  readonly field = inject(SELECTION_LIST_FIELD);
  readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  // TODO: Skipped for migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  @Input()
  get value() {
    return this._value();
  }
  set value(value: Primitive) {
    this._value.set(value);
  }
  private _value = signal<Primitive>(undefined);

  // TODO: Skipped for migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  @Input({ transform: booleanAttribute })
  get disabled(): boolean {
    return this._disabled();
  }
  set disabled(value: boolean) {
    this._disabled.set(value);
  }
  private _disabled = signal<boolean>(false);

  // TODO: Skipped for migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  @Input({ transform: booleanAttribute })
  get isResetOption(): boolean {
    return this._isResetOption();
  }
  set isResetOption(value: boolean) {
    this._isResetOption.set(value);
  }
  private _isResetOption = signal<boolean>(false);

  readonly selected = computed(() => {
    const value = this.input.value;

    return (
      (Array.isArray(value) && value.includes(this.value)) ||
      value === this.value ||
      (this.isResetOption && ((Array.isArray(value) && value.length === 0) || value === null || value === undefined))
    );
  });

  focus() {
    this.elementRef.nativeElement.focus();
  }

  getLabel() {
    return this.elementRef.nativeElement.textContent || '';
  }

  _onInputInteraction(event: Event) {
    event.stopPropagation();

    if (this.disabled) {
      return;
    }

    this._toggleSelected();

    this.input._markAsTouched();
    this.input._setShouldDisplayError(true);
  }

  _controlTouched() {
    this.input._markAsTouched();
    this.input._setShouldDisplayError(true);
  }

  _setTabindex(value: number) {
    this.elementRef.nativeElement.setAttribute('tabindex', value + '');
  }

  _toggleSelected() {
    if (this.field.multiple) {
      if (!Array.isArray(this.input.value)) {
        this.input._updateValue([this.value]);
      } else if (this.isResetOption) {
        this.input._updateValue([]);
      } else if (this.selected()) {
        this.input._updateValue(this.input.value.filter((value) => value !== this.value));
      } else {
        this.input._updateValue([...this.input.value, this.value]);
      }
    } else {
      this.input._updateValue(this.value);
    }
  }
}
