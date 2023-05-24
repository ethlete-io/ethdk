import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { DOWN_ARROW, ENTER, ESCAPE, TAB, UP_ARROW } from '@angular/cdk/keycodes';
import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  InjectionToken,
  Input,
  OnInit,
  Output,
  ViewEncapsulation,
  inject,
  isDevMode,
} from '@angular/core';
import { AnimatedOverlayDirective, LetDirective, RuntimeError, SelectionModel } from '@ethlete/core';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  map,
  skip,
  skipWhile,
  takeUntil,
  tap,
  throwError,
} from 'rxjs';
import { ChevronIconComponent } from '../../../../../../../icons';
import { INPUT_TOKEN, InputDirective, NativeInputRefDirective } from '../../../../../../directives';
import { DecoratedInputBase } from '../../../../../../utils';
import { ComboboxBodyComponent } from '../../partials';

const COMBOBOX_ERRORS = {
  1: 'Expected options to be an array of objects. This is due to "bindLabel" and "bindValue" being set.',
  2: 'Expected options to be an array of primitives. This is due to "bindLabel" and "bindValue" not being set or "allowCustomValues" being set to true.',
} as const;

const comboboxError = (code: keyof typeof COMBOBOX_ERRORS, data: unknown) => {
  const message = `<et-combobox>: ${COMBOBOX_ERRORS[code]}`;

  throw new RuntimeError(code, message, data);
};

const isPrimitiveArray = (value: unknown): value is Array<string | number | boolean> => {
  if (!Array.isArray(value)) return false;

  const first = value[0];
  const last = value[value.length - 1];

  if (!first || !last) return false;

  return typeof first !== 'object' && typeof last !== 'object';
};

const isObjectArray = (value: unknown): value is Array<Record<string, unknown>> => {
  if (!Array.isArray(value)) return false;

  const first = value[0];
  const last = value[value.length - 1];

  if (!first || !last) return false;

  return typeof first === 'object' && typeof last === 'object';
};

const isEmptyArray = (value: unknown): value is [] => {
  return Array.isArray(value) && value.length === 0;
};

const ComboboxOptionType = {
  Primitive: 'primitive',
  Object: 'object',
} as const;

export const COMBOBOX_TOKEN = new InjectionToken<ComboboxComponent>('ET_COMBOBOX_TOKEN');

@Component({
  selector: 'et-combobox',
  templateUrl: './combobox.component.html',
  styleUrls: ['./combobox.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-combobox',
  },
  imports: [NgIf, NativeInputRefDirective, AsyncPipe, ChevronIconComponent, LetDirective, NgFor],
  hostDirectives: [{ directive: InputDirective }, AnimatedOverlayDirective],
  providers: [
    {
      provide: COMBOBOX_TOKEN,
      useExisting: ComboboxComponent,
    },
  ],
})
export class ComboboxComponent extends DecoratedInputBase implements OnInit {
  //#region Injects

  private readonly _input = inject(INPUT_TOKEN);
  private readonly _animatedOverlay = inject<AnimatedOverlayDirective<ComboboxBodyComponent>>(AnimatedOverlayDirective);

  //#endregion

  //#region Inputs

  @Input({ required: true })
  get options() {
    return this._selectionModel.getFilteredOptions();
  }
  set options(value: unknown[]) {
    this._selectionModel.setOptions(value);
  }

  @Input()
  set initialValue(value: unknown) {
    this._selectionModel.setSelection(value);
  }

  @Input()
  get filterInternal(): boolean {
    return this._filterInternal$.value;
  }
  set filterInternal(value: BooleanInput) {
    const val = coerceBooleanProperty(value);
    this._filterInternal$.next(val);

    if (!val) {
      this._selectionModel.setFilter('');
    } else {
      this._selectionModel.setFilter(this._currentFilter);
    }
  }
  private _filterInternal$ = new BehaviorSubject(true);

  @Input()
  get loading(): boolean {
    return this._loading$.value;
  }
  set loading(value: BooleanInput) {
    this._loading$.next(coerceBooleanProperty(value));
  }
  private _loading$ = new BehaviorSubject(false);
  readonly loading$ = this._loading$.asObservable();

  @Input()
  get error() {
    return this._error$.value;
  }
  set error(value: unknown) {
    this._error$.next(value);
  }
  private _error$ = new BehaviorSubject<unknown>(null);

  @Input()
  get placeholder() {
    return this._placeholder$.value;
  }
  set placeholder(value: string | null) {
    this._placeholder$.next(value);
  }
  private _placeholder$ = new BehaviorSubject<string | null>(null);

  @Input()
  set multiple(value: BooleanInput) {
    this._selectionModel.setAllowMultiple(coerceBooleanProperty(value));
  }

  @Input()
  set bindLabel(value: string | null) {
    this._selectionModel.setLabelBinding(value);
  }

  @Input()
  set bindValue(value: string | null) {
    this._selectionModel.setValueBinding(value);
  }

  @Input()
  get allowCustomValues(): boolean {
    return this._allowCustomValues$.value;
  }
  set allowCustomValues(value: BooleanInput) {
    this._allowCustomValues$.next(coerceBooleanProperty(value));
  }
  private _allowCustomValues$ = new BehaviorSubject(false);

  //#endregion

  //#region Outputs

  @Output()
  protected readonly filterChange = new EventEmitter<string>();

  //#endregion

  //#region Members

  private get _currentFilter() {
    return this._currentFilter$.value;
  }
  private readonly _currentFilter$ = new BehaviorSubject<string>('');

  private get _isOpen() {
    return this._animatedOverlay.isMounted;
  }
  private readonly _isOpen$ = this._animatedOverlay.isMounted$;

  private readonly _selectionModel = new SelectionModel();

  protected readonly selectedOptions$ = this._selectionModel.selection$;
  protected readonly multiple$ = this._selectionModel.allowMultiple$;
  protected readonly options$ = this._selectionModel.filteredOptions$;

  //#endregion

  //#region Computes

  //#endregion

  //#region Lifecycle

  constructor() {
    super();

    this._bindings.push({
      attribute: 'class.et-combobox--loading',
      observable: this._loading$,
    });

    this._bindings.push({
      attribute: 'class.et-combobox--error',
      observable: this._error$.pipe(map((v) => !!v)),
    });

    this._bindings.push({
      attribute: 'class.et-combobox--open',
      observable: this._isOpen$,
    });
  }

  ngOnInit(): void {
    this._initDispatchFilterChanges();
    this._initRepositionOnValueChanges();

    if (isDevMode()) {
      this._debugValidateComboboxConfig();
    }

    this._selectionModel.value$
      .pipe(
        takeUntil(this._destroy$),
        tap((value) => {
          this._input._updateValue(value);
          this._setFilterFromInputValue();
        }),
      )
      .subscribe();
  }

  //#endregion

  //#region Public Methods

  getOptionLabel(option: unknown) {
    return this._selectionModel.getLabel$(option);
  }

  getOptionValue(option: unknown) {
    return this._selectionModel.getValue$(option);
  }

  removeSelectedOption(option: unknown) {
    this._selectionModel.removeSelectedOption(option);

    this.input._markAsTouched();
  }

  open() {
    // if (!this._selectBodyConfig) return;

    if (this._isOpen || this.input.disabled) return;

    // this._setSelectedOptionActive();

    const instance = this._animatedOverlay.mount({
      component: ComboboxBodyComponent,
      mirrorWidth: true,
      // data: { _bodyTemplate: this._selectBodyConfig.template },
    });

    if (!instance) return;

    // this._selectBodyId$.next(instance.selectBody.id);
  }

  close() {
    if (!this._isOpen) return;

    this._animatedOverlay.unmount();

    // this._selectBodyId$.next(null);
  }

  writeValueFromOption(option: unknown) {
    this.input._markAsTouched();

    if (this._selectionModel.allowMultiple) {
      this._selectionModel.toggleSelectedOption(option);
    } else {
      this._selectionModel.addSelectedOption(option);
    }

    if (!this._selectionModel.allowMultiple) {
      this.close();
      this._setFilterFromInputValue();
    }
  }

  isOptionSelected(option: unknown) {
    return this._selectionModel.isSelected$(option);
  }

  //#endregion

  //#region Protected Methods

  protected processKeydownEvent(event: KeyboardEvent) {
    const keyCode = event.keyCode;
    const isOpen = this._isOpen;
    const isMultiple = this._selectionModel.allowMultiple;
    const canAddCustomValue = this.allowCustomValues;
    const value = (event.target as HTMLInputElement).value;
    const hasValue = !!value;

    // The user typed a custom value and pressed enter. Add it to the selected options.
    if (keyCode === ENTER && canAddCustomValue && hasValue) {
      this._selectionModel.addSelectedOption(value);

      if (isMultiple) {
        this._updateFilter('');
      }

      if (!isMultiple) {
        this.close();
      }

      return;
    }

    if (keyCode === ESCAPE) {
      if (isOpen) {
        this.close();
      } else {
        if (!isMultiple) {
          this._selectionModel.clearSelectedOptions();
          this._updateFilter('');
          return;
        }
      }

      return;
    }

    if (keyCode === TAB) {
      this.close();
      return;
    }

    if (!isOpen) {
      this.open();
    }

    if (keyCode === DOWN_ARROW) {
      // TODO: Implement
    }

    if (keyCode === UP_ARROW) {
      // TODO: Implement
    }
  }

  protected processInputEvent(event: Event) {
    const value = (event.target as HTMLInputElement).value;

    this._updateFilter(value);
  }

  protected handleBlurEvent() {
    this.input._markAsTouched();
    this.input._setShouldDisplayError(true);

    if (this._selectionModel.allowMultiple) return;

    if (this._currentFilter === '') {
      this._selectionModel.clearSelectedOptions();
      return;
    }

    this._setFilterFromInputValue();
  }

  //#endregion

  //#region Private Methods

  private _initDispatchFilterChanges() {
    this._currentFilter$
      .pipe(
        skipWhile(() => this.filterInternal),
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this._destroy$),
        tap((v) => this.filterChange.emit(v)),
      )
      .subscribe();
  }

  private _initRepositionOnValueChanges() {
    this.input.valueChange$
      .pipe(
        takeUntil(this._destroy$),
        debounceTime(0),
        tap(() => this._animatedOverlay._reposition()),
      )
      .subscribe();
  }

  private _updateFilter(value: string) {
    if (this.input.nativeInputRef && this.input.nativeInputRef.element.nativeElement.value !== value) {
      this.input.nativeInputRef.element.nativeElement.value = value;
    }

    if (this._currentFilter === value) return;

    this._currentFilter$.next(value);

    if (this.filterInternal) {
      this._selectionModel.setFilter(value);
    }
  }

  private _setFilterFromInputValue() {
    if (this._selectionModel.allowMultiple) return;

    const value = this.input.value;

    if (!value || Array.isArray(value)) {
      this._updateFilter('');
      return;
    }

    const option = this._selectionModel.getOptionByValue(value);

    if (!option) return;

    const label = this._selectionModel.getLabel(option);

    if (typeof label !== 'string') return;

    this._updateFilter(label);
  }

  //#endregion

  //#region Dev mode

  private _debugValidateComboboxConfig(isRetry = false) {
    combineLatest([this._selectionModel.labelBinding$, this._selectionModel.valueBinding$, this._allowCustomValues$])
      .pipe(
        skip(isRetry ? 1 : 0), // Skip if retrying to avoid infinite loop
        debounceTime(0),
        takeUntil(this._destroy$),
        map(([bindLabel, bindValue, allowCustomValues]) => {
          const shouldBeObjects = bindLabel && bindValue && !allowCustomValues;

          if (shouldBeObjects) {
            return ComboboxOptionType.Object;
          }

          return ComboboxOptionType.Primitive;
        }),
        tap((expectedOptionType) => {
          const options = this._selectionModel.options;

          if (isEmptyArray(options)) {
            return;
          }

          if (expectedOptionType === ComboboxOptionType.Object) {
            if (!isObjectArray(options)) {
              throw comboboxError(1, options);
            }
          } else if (expectedOptionType === ComboboxOptionType.Primitive) {
            if (!isPrimitiveArray(options)) {
              throw comboboxError(2, options);
            }
          }
        }),
        catchError((e) => {
          this._debugValidateComboboxConfig(true);
          return throwError(() => e);
        }),
      )
      .subscribe();
  }

  //#endregion
}
