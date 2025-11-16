import { AfterViewInit, Directive, ElementRef, InjectionToken, Input, booleanAttribute, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { signalHostAttributes, signalHostClasses } from '@ethlete/core';
import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { SELECT_TOKEN } from '../select';

export const SELECT_OPTION_TOKEN = new InjectionToken<SelectOptionDirective>('ET_SELECT_OPTION_TOKEN');

let uniqueId = 0;

@Directive({
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
    '(click)': 'selectOption()',
    '(mouseenter)': 'setActiveByHover()',
    '(etObserveContent)': '_updateViewValue()',
    role: 'option',
  },
})
export class SelectOptionDirective implements AfterViewInit {
  private readonly _select = inject(SELECT_TOKEN);
  readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _viewValue$ = new BehaviorSubject<string>(this._elementRef.nativeElement.textContent?.trim() ?? '');

  readonly isActive$ = this._select._activeSelectionModel.isOptionActive$(this);

  readonly id = `et-select-option-${uniqueId++}`;

  // TODO: Skipped for migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  @Input({ required: true })
  get value() {
    return this._value$.value;
  }
  set value(value: unknown) {
    this._value$.next(value);
  }
  private _value$ = new BehaviorSubject<unknown>(null);

  // TODO: Skipped for migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  @Input()
  get disabled(): boolean {
    return this._disabled$.value;
  }
  set disabled(value: unknown) {
    this._disabled$.next(booleanAttribute(value));
  }
  private _disabled$ = new BehaviorSubject(false);
  readonly disabled$ = this._disabled$.asObservable();

  // TODO: Skipped for migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  @Input()
  get label() {
    return this._label$.value;
  }
  set label(label: string | null) {
    this._label$.next(label);
  }
  private _label$ = new BehaviorSubject<string | null>(null);

  readonly isSelected$ = this._select._selectionModel.isSelected$(this);
  readonly isSelected = toSignal(this.isSelected$);

  get viewValue() {
    return this._label$.value ?? this._viewValue$.value;
  }
  readonly viewValue$ = combineLatest([this._viewValue$, this._label$]).pipe(
    map(([viewValue, label]) => label ?? viewValue),
  );

  readonly hostClassBindings = signalHostClasses({
    'et-select-option--selected': this.isSelected,
    'et-select-option--active': toSignal(this.isActive$),
  });

  readonly hostAttributeBindings = signalHostAttributes({
    'aria-selected': this.isSelected,
  });

  ngAfterViewInit(): void {
    this._updateViewValue();
  }

  protected selectOption() {
    if (this._select._selectionModel.isDisabled(this)) {
      return;
    }

    this._select.writeValueFromOption(this);
    this._select.focus();

    this._select.optionClick.emit(this.value);
    this._select.userInteraction.emit();
  }

  _updateViewValue() {
    this._viewValue$.next(this._elementRef.nativeElement.textContent?.trim() ?? '');
  }

  protected setActiveByHover() {
    this._select._activeSelectionModel.setActiveOption(this);
  }
}
