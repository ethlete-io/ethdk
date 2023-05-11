import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { Directive, InjectionToken, Input, TemplateRef, inject } from '@angular/core';
import { createReactiveBindings } from '@ethlete/core';
import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { SELECT_TOKEN } from '../select';

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
    '(click)': 'setSelectValueAndClose(value)',
    role: 'option',
  },
})
export class SelectOptionDirective {
  private readonly _select = inject(SELECT_TOKEN);
  private readonly _optionTemplate$ = new BehaviorSubject<TemplateRef<unknown> | null>(null);

  readonly id = `et-select-option-${uniqueId++}`;

  @Input({ required: true })
  get value() {
    return this._value$.value;
  }
  set value(value: unknown) {
    this._value$.next(value);
  }
  private _value$ = new BehaviorSubject<unknown>(null);

  @Input()
  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(value: BooleanInput) {
    this._disabled = coerceBooleanProperty(value);
  }
  private _disabled = false;

  readonly selected$ = combineLatest([this._select.input.value$, this._value$]).pipe(
    map(([selectValue, optionValue]) => selectValue === optionValue),
  );

  readonly _bindings = createReactiveBindings({
    attribute: 'class.et-select-option--selected',
    observable: this.selected$,
  });

  readonly optionTemplate$ = this._optionTemplate$.asObservable();

  setSelectValueAndClose(value: unknown) {
    if (this.disabled) return;

    this._select.setValue(value);

    this._select.unmountSelectBody();
  }

  _setOptionTemplate(templateRef: TemplateRef<unknown> | null) {
    this._optionTemplate$.next(templateRef);
  }
}
