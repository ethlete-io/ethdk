import {
  AfterContentInit,
  Directive,
  ElementRef,
  InjectionToken,
  Input,
  booleanAttribute,
  inject,
  isDevMode,
} from '@angular/core';
import { ObserveContentDirective, createReactiveBindings } from '@ethlete/core';
import { BehaviorSubject, combineLatest, firstValueFrom, map } from 'rxjs';
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
    '(click)': 'setSelectValue()',
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
  set disabled(value: unknown) {
    this._disabled$.next(booleanAttribute(value));
  }
  private _disabled$ = new BehaviorSubject(false);

  readonly isSelected$ = combineLatest([this._select.input.value$, this._value$]).pipe(
    map(([selectValue, optionValue]) => {
      if (Array.isArray(selectValue)) {
        return selectValue.includes(optionValue);
      }

      return selectValue === optionValue;
    }),
  );

  get viewValue() {
    return this._viewValue$.value;
  }

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

  async setSelectValue() {
    if (this.disabled) return;

    if (this._select.multiple) {
      if (!Array.isArray(this._select.input.value)) {
        if (isDevMode()) {
          console.warn('Select multiple is enabled but the value is not an array');
        }

        return;
      }

      const isSelected = await firstValueFrom(this.isSelected$);

      if (isSelected) {
        this._select.setValue(this._select.input.value.filter((value) => value !== this.value));
      } else {
        this._select.setValue([...this._select.input.value, this.value]);
      }
    } else {
      this._select.setValue(this.value);
      this._select.unmountSelectBody();
    }
  }

  _updateViewValue() {
    this._viewValue$.next(this._elementRef.nativeElement.textContent?.trim() ?? '');
  }

  _setActive(isActive: boolean) {
    this._isActive$.next(isActive);
  }
}
