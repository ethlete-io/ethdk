import { A, BACKSPACE, ENTER, ESCAPE, TAB } from '@angular/cdk/keycodes';
import { ComponentType } from '@angular/cdk/overlay';
import {
  ContentChild,
  Directive,
  EventEmitter,
  InjectionToken,
  Input,
  OnInit,
  Output,
  TemplateRef,
  TrackByFunction,
  booleanAttribute,
  inject,
  isDevMode,
} from '@angular/core';
import {
  ActiveSelectionModel,
  AnimatedOverlayComponentBase,
  AnimatedOverlayDirective,
  KeyPressManager,
  SelectionModel,
  SelectionModelBinding,
  createDestroy,
  createReactiveBindings,
  isEmptyArray,
  isObjectArray,
  isPrimitiveArray,
} from '@ethlete/core';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  skip,
  skipWhile,
  take,
  takeUntil,
  tap,
  throwError,
} from 'rxjs';
import { INPUT_TOKEN } from '../../../../../../directives';
import { SELECT_FIELD_TOKEN } from '../../../../directives';
import {
  ComboboxOptionType,
  ComponentWithOption,
  KeyHandlerResult,
  TemplateRefWithOption,
  assetComboboxBodyComponentSet,
  comboboxError,
} from '../../private';
import { isOptionDisabled } from '../../utils';
import { COMBOBOX_OPTION_TEMPLATE_TOKEN } from '../combobox-option-template';
import { COMBOBOX_SELECTED_OPTION_TEMPLATE_TOKEN } from '../combobox-selected-option-template';

export const COMBOBOX_TOKEN = new InjectionToken<ComboboxDirective>('ET_COMBOBOX_INPUT_TOKEN');

@Directive({
  standalone: true,
  providers: [
    {
      provide: COMBOBOX_TOKEN,
      useExisting: ComboboxDirective,
    },
  ],
})
export class ComboboxDirective implements OnInit {
  //#region Injects

  private readonly _destroy$ = createDestroy();
  private readonly _input = inject(INPUT_TOKEN);
  private readonly _selectField = inject(SELECT_FIELD_TOKEN);
  private readonly _animatedOverlay =
    inject<AnimatedOverlayDirective<AnimatedOverlayComponentBase>>(AnimatedOverlayDirective);

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
    this._initialValue$.next(value);
  }
  private _initialValue$ = new BehaviorSubject<unknown>(null);

  @Input()
  get filterInternal(): boolean {
    return this._filterInternal$.value;
  }
  set filterInternal(value: unknown) {
    const val = booleanAttribute(value);
    this._filterInternal$.next(val);

    if (!val) {
      this._selectionModel.setFilter('');
    } else {
      this._selectionModel.setFilter(this._currentFilter);
    }
  }
  private _filterInternal$ = new BehaviorSubject(false);

  @Input()
  get loading(): boolean {
    return this._loading$.value;
  }
  set loading(value: unknown) {
    this._loading$.next(booleanAttribute(value));
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
  emptyText = 'No results found';

  @Input()
  get placeholder() {
    return this._placeholder$.value;
  }
  set placeholder(value: string | null) {
    this._placeholder$.next(value);
  }
  private _placeholder$ = new BehaviorSubject<string | null>(null);

  @Input()
  set multiple(value: unknown) {
    this._selectionModel.setAllowMultiple(booleanAttribute(value));
  }

  @Input()
  set bindLabel(value: SelectionModelBinding | null) {
    this._selectionModel.setLabelBinding(value);
  }

  @Input()
  set bindValue(value: SelectionModelBinding | null) {
    this._selectionModel.setValueBinding(value);
  }

  @Input()
  set bindKey(value: SelectionModelBinding | null) {
    this._selectionModel.setKeyBinding(value);
  }

  @Input()
  get allowCustomValues(): boolean {
    return this._allowCustomValues$.value;
  }
  set allowCustomValues(value: unknown) {
    this._allowCustomValues$.next(booleanAttribute(value));
  }
  private _allowCustomValues$ = new BehaviorSubject(false);

  @Input()
  get optionComponent(): ComponentWithOption | null {
    return this._optionComponent$.value;
  }
  set optionComponent(component: ComponentWithOption | null) {
    this._optionComponent$.next(component);
  }
  private readonly _optionComponent$ = new BehaviorSubject<ComponentWithOption | null>(null);

  @Input()
  get selectedOptionComponent(): ComponentWithOption | null {
    return this._selectedOptionComponent$.value;
  }
  set selectedOptionComponent(component: ComponentWithOption | null) {
    this._selectedOptionComponent$.next(component);
  }
  private readonly _selectedOptionComponent$ = new BehaviorSubject<ComponentWithOption | null>(null);

  //#endregion

  //#region Outputs

  @Output()
  protected readonly filterChange = new EventEmitter<string>();

  //#endregion

  //#region Members

  private _shouldIgnoreNextBlurEvent = false;
  private _deletedSearchWithKeyPress = false;

  private get _currentFilter() {
    return this._currentFilter$.value;
  }
  private readonly _currentFilter$ = new BehaviorSubject<string>('');

  private get _isOpen() {
    return this._animatedOverlay.isMounted;
  }
  private readonly _isOpen$ = this._animatedOverlay.isMounted$;

  readonly _selectionModel = new SelectionModel();
  private readonly _activeSelectionModel = new ActiveSelectionModel();
  private readonly _backspaceKeyPressManager = new KeyPressManager(BACKSPACE);

  readonly selectedOptions$ = this._selectionModel.selection$;
  readonly multiple$ = this._selectionModel.allowMultiple$;
  readonly options$ = this._selectionModel.filteredOptions$;
  readonly rawOptions$ = this._selectionModel.options$;

  @ContentChild(COMBOBOX_OPTION_TEMPLATE_TOKEN, { read: TemplateRef })
  set optionTemplate(value: TemplateRefWithOption | undefined) {
    this._optionTemplate$.next(value ?? null);
  }
  private readonly _optionTemplate$ = new BehaviorSubject<TemplateRefWithOption | null>(null);

  @ContentChild(COMBOBOX_SELECTED_OPTION_TEMPLATE_TOKEN, { read: TemplateRef })
  set selectedOptionTemplate(value: TemplateRefWithOption | undefined) {
    this._selectedOptionTemplate$.next(value ?? null);
  }
  private readonly _selectedOptionTemplate$ = new BehaviorSubject<TemplateRefWithOption | null>(null);

  readonly _bindings = createReactiveBindings(
    {
      attribute: 'class.et-combobox--loading',
      observable: this._loading$,
    },
    {
      attribute: 'class.et-combobox--error',
      observable: this._error$.pipe(map((v) => !!v)),
    },
    {
      attribute: 'class.et-combobox--open',
      observable: this._isOpen$,
    },
    {
      attribute: 'class.et-select-field--multiple',
      observable: this.multiple$,
    },
    {
      attribute: 'class.et-select-field--open',
      observable: this._isOpen$,
    },
  );

  private _comboboxBodyComponent: ComponentType<AnimatedOverlayComponentBase> | null = null;

  //#endregion

  //#region Computes

  readonly customOptionTpl$ = this._optionTemplate$.asObservable();
  readonly customOptionComponent$ = this._optionComponent$.asObservable();
  readonly customSelectedOptionTpl$ = this._selectedOptionTemplate$.asObservable();
  readonly customSelectedOptionComponent$ = this._selectedOptionComponent$.asObservable();

  //#endregion

  //#region Lifecycle

  constructor() {
    this._activeSelectionModel.setSelectionModel(this._selectionModel);

    this._animatedOverlay.placement = 'bottom';
    this._animatedOverlay.fallbackPlacements = ['bottom', 'top'];
    this._animatedOverlay.autoResize = true;

    this._selectField._bindings.push({
      attribute: 'class.et-select-field--open',
      observable: this._isOpen$,
    });

    this._selectField._bindings.push({
      attribute: 'class.et-select-field--multiple',
      observable: this.multiple$,
    });
  }

  ngOnInit(): void {
    this._initDispatchFilterChanges();

    if (isDevMode()) {
      this._debugValidateComboboxConfig();
      this._debugValidateOptionAndInitialValueSchema();
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

    this._input.nativeInputRef$
      .pipe(
        takeUntil(this._destroy$),
        debounceTime(0),
        filter((ref) => !!ref?.element.nativeElement),
        tap(() => this._updateFilter(this._currentFilter)),
        take(1),
      )
      .subscribe();
  }

  //#endregion

  //#region Public Methods

  setBodyComponent(component: ComponentType<AnimatedOverlayComponentBase>) {
    this._comboboxBodyComponent = component;
  }

  getOptionLabel(option: unknown) {
    return this._selectionModel.getLabel$(option);
  }

  getOptionValue(option: unknown) {
    return this._selectionModel.getValue$(option);
  }

  removeSelectedOption(option: unknown) {
    this._selectionModel.removeSelectedOption(option);

    this._input._markAsTouched();
  }

  open() {
    assetComboboxBodyComponentSet(this._comboboxBodyComponent);

    if (this._isOpen || this._input.disabled || this._animatedOverlay.isMounting) return;

    this._animatedOverlay.mount({
      component: this._comboboxBodyComponent,
      mirrorWidth: true,
    });
  }

  close() {
    if (!this._isOpen || this._animatedOverlay.isUnmounting) return;

    this._animatedOverlay.unmount();
  }

  focus() {
    this._input.nativeInputRef?.element.nativeElement.focus();
  }

  selectInputAndOpen() {
    if (this._input.disabled) return;

    this._input.nativeInputRef?.element.nativeElement.select();
    this.open();
  }

  writeValueFromOption(option: unknown) {
    this._input._markAsTouched();

    if (this._selectionModel.allowMultiple) {
      this._selectionModel.toggleSelectedOption(option);
    } else {
      this._selectionModel.addSelectedOption(option);
    }

    if (!this._selectionModel.allowMultiple) {
      this.close();
      this._setFilterFromInputValue();
    } else {
      this._updateFilter('');
    }
  }

  isOptionSelected(option: unknown) {
    return this._selectionModel.isSelected$(option);
  }

  isOptionActive(option: unknown) {
    return this._activeSelectionModel.activeOption$.pipe(map((activeOption) => activeOption === option));
  }

  trackByOptionKeyFn: TrackByFunction<unknown> = (index, item) => this._selectionModel.getKey(item);

  //#endregion

  //#region Protected Methods

  _ignoreNextBlurEvent() {
    this._shouldIgnoreNextBlurEvent = true;
  }

  _processKeydownEvent(event: KeyboardEvent) {
    const keyCode = event.keyCode;
    const isOpen = this._isOpen;
    const isMultiple = this._selectionModel.allowMultiple;
    const canAddCustomValue = this.allowCustomValues;
    const value = (event.target as HTMLInputElement).value;
    const hasFilterValue = !!value;
    const selection = this._selectionModel.selection;
    const isBackspacePressed = this._backspaceKeyPressManager.isPressed(event);

    const result: KeyHandlerResult = {};

    if (keyCode === ENTER) {
      event.preventDefault();
      event.stopPropagation();

      // The user typed a custom value and pressed enter. Add it to the selected options.
      // FIXME: Currently it is impossible to select the active option with the keyboard if canAddCustomValue is true.
      // To fix this, the active option should also include the origin it got active from (keyboard or programmatic).
      // The "value" changing should put the combobox into a "use the custom input on enter" mode.
      // The "active option" changing via keyboard should put the combobox into a "use the active option on enter" mode.
      if (canAddCustomValue && hasFilterValue) {
        result.optionAction = { type: 'add', option: value };
      } else {
        const activeOption = this._activeSelectionModel.activeOption;

        if (activeOption) {
          if (isMultiple) {
            result.optionAction = { type: 'toggle', option: activeOption };
          } else {
            result.optionAction = { type: 'add', option: activeOption };
          }
        }
      }

      if (isMultiple) {
        result.setFilter = '';
      } else {
        result.overlayOperation = 'close';
      }

      return this._interpretKeyHandlerResult(result);
    }

    if (keyCode === ESCAPE) {
      if (isOpen) {
        result.overlayOperation = 'close';
      } else if (!isMultiple) {
        result.setFilter = '';
        result.optionAction = 'clear';
      }

      return this._interpretKeyHandlerResult(result);
    }

    if (keyCode === TAB) {
      result.overlayOperation = 'close';
      return this._interpretKeyHandlerResult(result);
    }

    if (keyCode === BACKSPACE) {
      if (isBackspacePressed && value) {
        this._deletedSearchWithKeyPress = true;
      }

      if (!hasFilterValue && isMultiple && selection.length && !this._deletedSearchWithKeyPress) {
        result.optionAction = { type: 'remove', option: selection[selection.length - 1] };
        return this._interpretKeyHandlerResult(result);
      }

      if (!isBackspacePressed) {
        this._deletedSearchWithKeyPress = false;
      }
    } else {
      this._deletedSearchWithKeyPress = false;
    }

    if (!isOpen) {
      result.overlayOperation = 'open';
    }

    this._activeSelectionModel.evaluateKeyboardEvent(event);

    if (keyCode === A && event.ctrlKey && isMultiple) {
      result.optionAction = 'toggleAll';
      event.preventDefault();
    }

    return this._interpretKeyHandlerResult(result);
  }

  _processKeyupEvent() {
    this._backspaceKeyPressManager.clear();
  }

  _processInputEvent(event: Event) {
    const value = (event.target as HTMLInputElement).value;

    this._updateFilter(value);
  }

  _handleBlurEvent() {
    if (this._shouldIgnoreNextBlurEvent) {
      this._shouldIgnoreNextBlurEvent = false;
      return;
    }

    this._input._markAsTouched();
    this._input._setShouldDisplayError(true);

    if (this._selectionModel.allowMultiple) {
      this._updateFilter('');
      return;
    }

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

  private _updateFilter(value: string) {
    if (this._input.nativeInputRef && this._input.nativeInputRef.element.nativeElement.value !== value) {
      this._input.nativeInputRef.element.nativeElement.value = value;
    }

    if (this._currentFilter === value) return;

    this._currentFilter$.next(value);

    if (this.filterInternal) {
      this._selectionModel.setFilter(value);
    }
  }

  private _setFilterFromInputValue() {
    if (this._selectionModel.allowMultiple) return;

    const value = this._input.value;

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

  private _interpretKeyHandlerResult(result: KeyHandlerResult) {
    if (result.overlayOperation === 'close') {
      this.close();
    } else if (result.overlayOperation === 'open') {
      this.open();
    }

    if (result.setFilter !== undefined) {
      this._updateFilter(result.setFilter);
    }

    if (result.optionAction) {
      if (typeof result.optionAction === 'string') {
        if (result.optionAction === 'clear') {
          this._selectionModel.clearSelectedOptions();
        } else if (result.optionAction === 'toggleAll') {
          this._selectionModel.toggleAllSelectedOptions();
        }
      } else {
        const { type, option } = result.optionAction;

        if (isOptionDisabled(option)) return;

        if (type === 'add') {
          this._selectionModel.addSelectedOption(option);
        }

        if (type === 'remove') {
          this._selectionModel.removeSelectedOption(option);
        }

        if (type === 'toggle') {
          this._selectionModel.toggleSelectedOption(option);
        }
      }
    }
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
              throw comboboxError('options_object_mismatch', true, options);
            }
          } else if (expectedOptionType === ComboboxOptionType.Primitive) {
            if (!isPrimitiveArray(options)) {
              throw comboboxError('options_primitive_mismatch', true, options);
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

  private _debugValidateOptionAndInitialValueSchema(isRetry = false) {
    combineLatest([this.options$, this._initialValue$])
      .pipe(
        skip(isRetry ? 1 : 0), // Skip if retrying to avoid infinite loop
        takeUntil(this._destroy$),
        tap(([options, initialValue]) => {
          if (initialValue === null || initialValue === undefined) return;

          const isPrimitive = isPrimitiveArray(options);
          const initialValueIsPrimitive = this.multiple
            ? isPrimitiveArray(initialValue)
            : typeof initialValue !== 'object';

          if (isPrimitive) {
            if (!initialValueIsPrimitive) {
              throw comboboxError('init_val_primitive_mismatch', true, { initialValue, options });
            }
          } else {
            if (initialValueIsPrimitive) {
              throw comboboxError('init_val_object_mismatch', true, { initialValue, options });
            }
          }
        }),
        catchError((e) => {
          this._debugValidateOptionAndInitialValueSchema(true);
          return throwError(() => e);
        }),
      )
      .subscribe();
  }

  //#endregion
}
