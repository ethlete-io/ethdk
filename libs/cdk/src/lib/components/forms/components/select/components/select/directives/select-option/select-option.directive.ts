import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { AfterContentInit, Directive, ElementRef, InjectionToken, Input, inject } from '@angular/core';
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
    '(click)': 'setSelectValueAndClose()',
    '(etObserveContent)': '_updateViewValue()',
    role: 'option',
  },
  hostDirectives: [ObserveContentDirective],
})
export class SelectOptionDirective implements AfterContentInit {
  private readonly _select = inject(SELECT_TOKEN);
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _viewValue$ = new BehaviorSubject<string>(this._elementRef.nativeElement.textContent?.trim() ?? '');
  private readonly _isActive$ = new BehaviorSubject(false);

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

  readonly isSelected$ = combineLatest([this._select.input.value$, this._value$]).pipe(
    map(([selectValue, optionValue]) => selectValue === optionValue),
  );

  readonly viewValue$ = this._viewValue$.asObservable();
  readonly disabled$ = this._disabled$.asObservable();
  readonly isActive$ = this._isActive$.asObservable();

  readonly _bindings = createReactiveBindings(
    {
      attribute: 'class.et-select-option--selected',
      observable: this.isSelected$,
    },
    {
      attribute: 'class.et-select-option--active',
      observable: this._isActive$,
    },
    {
      attribute: 'aria-selected',
      observable: this.isSelected$.pipe(
        map((selected) => ({
          render: true,
          value: selected,
        })),
      ),
    },
  );

  ngAfterContentInit(): void {
    this._updateViewValue();
  }

  setSelectValueAndClose() {
    if (this.disabled) return;

    this._select.setValue(this.value);
    this._select.unmountSelectBody();
  }

  _updateViewValue() {
    this._viewValue$.next(this._elementRef.nativeElement.textContent?.trim() ?? '');

    console.log(this._elementRef.nativeElement.textContent?.trim());
  }

  _setActive(isActive: boolean) {
    this._isActive$.next(isActive);
  }
}
