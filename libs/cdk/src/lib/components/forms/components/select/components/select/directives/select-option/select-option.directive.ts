import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { Directive, ElementRef, InjectionToken, Input, inject } from '@angular/core';
import { ObserveContentDirective, createReactiveBindings } from '@ethlete/core';
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
    '[attr.aria-disabled]': 'disabled',
    '[class.et-select-option--disabled]': 'disabled',
    '(click)': 'setSelectValueAndClose(value)',
    '(etObserveContent)': 'updateViewValue()',
    role: 'option',
  },
  hostDirectives: [ObserveContentDirective],
})
export class SelectOptionDirective {
  private readonly _select = inject(SELECT_TOKEN);
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _contentChange$ = inject(ObserveContentDirective).valueChange;

  private readonly _viewValue$ = new BehaviorSubject<string>(this._elementRef.nativeElement.textContent?.trim() ?? '');

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
    return this._disabled$.value;
  }
  set disabled(value: BooleanInput) {
    this._disabled$.next(coerceBooleanProperty(value));
  }
  private _disabled$ = new BehaviorSubject(false);

  readonly selected$ = combineLatest([this._select.input.value$, this._value$]).pipe(
    map(([selectValue, optionValue]) => selectValue === optionValue),
  );

  readonly viewValue$ = this._viewValue$.asObservable();

  readonly shouldRender$ = combineLatest([this._select.searchable$, this._select.currentSearchTerm$]).pipe(
    map(([searchable, searchTerm]) => {
      this.updateViewValue();

      if (!searchable || !searchTerm) return true;

      return this._viewValue$.value.toLowerCase().includes(searchTerm.toLowerCase());
    }),
  );

  readonly _bindings = createReactiveBindings(
    {
      attribute: 'class.et-select-option--selected',
      observable: this.selected$,
    },
    {
      attribute: 'aria-selected',
      observable: this.selected$.pipe(
        map((selected) => ({
          render: true,
          value: selected,
        })),
      ),
    },
    {
      attribute: 'class.et-select-option--hidden',
      observable: this.shouldRender$.pipe(map((shouldRender) => !shouldRender)),
    },
  );

  readonly disabled$ = this._disabled$.asObservable();

  setSelectValueAndClose(value: unknown) {
    if (this.disabled) return;

    this._select.setValue(value);

    this._select.unmountSelectBody();
  }

  protected updateViewValue() {
    this._viewValue$.next(this._elementRef.nativeElement.textContent?.trim() ?? '');
  }
}
