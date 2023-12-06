import { A, BACKSPACE, ENTER, ESCAPE, TAB } from '@angular/cdk/keycodes';
import { ComponentType } from '@angular/cdk/overlay';
import {
  ContentChild,
  Directive,
  ElementRef,
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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  ActiveSelectionModel,
  AnimatedOverlayComponentBase,
  AnimatedOverlayDirective,
  KeyPressManager,
  SelectionModel,
  SelectionModelBinding,
  TypedQueryList,
  createDestroy,
  isEmptyArray,
  isObjectArray,
  isPrimitiveArray,
  scrollToElement,
  signalClasses,
  signalHostClasses,
} from '@ethlete/core';
import { THEME_PROVIDER } from '@ethlete/theming';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  skip,
  skipWhile,
  startWith,
  switchMap,
  takeUntil,
  tap,
  throwError,
} from 'rxjs';
import { INPUT_TOKEN, InputDirective } from '../../../../../../directives';
import { SELECT_FIELD_TOKEN } from '../../../../directives';
import { COMBOBOX_CONFIG_TOKEN, COMBOBOX_DEFAULT_CONFIG } from '../../constants';
import {
  ComboboxKeyHandlerResult,
  ComboboxOptionType,
  ComponentWithError,
  ComponentWithOption,
  TemplateRefWithError,
  TemplateRefWithOption,
  assetComboboxBodyComponentSet,
  comboboxError,
} from '../../private';
import { COMBOBOX_BODY_EMPTY_TEMPLATE_TOKEN } from '../combobox-body-empty-template';
import { COMBOBOX_BODY_ERROR_TEMPLATE_TOKEN } from '../combobox-body-error-template';
import { COMBOBOX_BODY_LOADING_TEMPLATE_TOKEN } from '../combobox-body-loading-template';
import { COMBOBOX_BODY_MORE_ITEMS_HINT_TEMPLATE_TOKEN } from '../combobox-body-more-items-hint-template';
import { COMBOBOX_OPTION_TEMPLATE_TOKEN } from '../combobox-option-template';
import { COMBOBOX_SELECTED_OPTION_TEMPLATE_TOKEN } from '../combobox-selected-option-template';

export const COMBOBOX_TOKEN = new InjectionToken<ComboboxDirective>('ET_COMBOBOX_INPUT_TOKEN');

export type AbstractComboboxBody = AnimatedOverlayComponentBase & {
  _options$: BehaviorSubject<TypedQueryList<AbstractComboboxOption> | null>;
  _containerElementRef: ElementRef<HTMLElement> | undefined;
  id: string;
};

export type AbstractComboboxOption = {
  _option$: BehaviorSubject<unknown>;
  _elementRef: ElementRef<HTMLElement>;
  id: string;
};

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
  readonly _input = inject<InputDirective<unknown, HTMLInputElement>>(INPUT_TOKEN);
  private readonly _selectField = inject(SELECT_FIELD_TOKEN);
  private readonly _animatedOverlay = inject<AnimatedOverlayDirective<AbstractComboboxBody>>(AnimatedOverlayDirective);
  private readonly _comboboxConfig = inject(COMBOBOX_CONFIG_TOKEN, { optional: true });
  private readonly _themeProvider = inject(THEME_PROVIDER, { optional: true });

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
      this._selectionModel.setFilter(this.currentFilter);
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
  readonly error$ = this._error$.asObservable();

  /**
   * @deprecated Use `bodyEmptyText` instead. Will be removed in v5.
   */
  @Input()
  emptyText?: string;

  @Input()
  bodyEmptyText?: string;

  @Input()
  bodyMoreItemsHintText?: string;

  /**
   * To be removed in v5.
   */
  get _tempEmptyText() {
    return (
      this.emptyText ??
      this.bodyEmptyText ??
      this._comboboxConfig?.bodyEmptyText ??
      this._comboboxConfig?.emptyText ??
      COMBOBOX_DEFAULT_CONFIG.bodyEmptyText
    );
  }

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
  set bindDisabled(value: SelectionModelBinding | null) {
    this._selectionModel.setDisabledBinding(value);
  }

  @Input()
  get allowCustomValues(): boolean {
    return this._allowCustomValues$.value;
  }
  set allowCustomValues(value: unknown) {
    this._allowCustomValues$.next(booleanAttribute(value));
  }
  private _allowCustomValues$ = new BehaviorSubject(false);

  @Input({ transform: booleanAttribute })
  get showBodyMoreItemsHint(): boolean {
    return this._showBodyMoreItemsHint$.value;
  }
  set showBodyMoreItemsHint(value: boolean) {
    this._showBodyMoreItemsHint$.next(value);
  }
  private _showBodyMoreItemsHint$ = new BehaviorSubject(false);

  @Input()
  get optionComponent() {
    return this._optionComponent$.value;
  }
  set optionComponent(component: ComponentWithOption | null) {
    this._optionComponent$.next(component);
  }
  private readonly _optionComponent$ = new BehaviorSubject<ComponentWithOption | null>(
    this._comboboxConfig?.optionComponent ?? null,
  );

  @Input()
  get optionComponentInputs() {
    return this._optionComponentInputs$.value;
  }
  set optionComponentInputs(value: Record<string, unknown> | null | undefined) {
    this._optionComponentInputs$.next(value ?? {});
  }
  private _optionComponentInputs$ = new BehaviorSubject<Record<string, unknown>>({});

  @Input()
  get selectedOptionComponent() {
    return this._selectedOptionComponent$.value;
  }
  set selectedOptionComponent(component: ComponentWithOption | null) {
    this._selectedOptionComponent$.next(component);
  }
  private readonly _selectedOptionComponent$ = new BehaviorSubject<ComponentWithOption | null>(
    this._comboboxConfig?.selectedOptionComponent ?? null,
  );

  @Input()
  get selectedOptionComponentInputs() {
    return this._selectedOptionComponentInputs$.value;
  }
  set selectedOptionComponentInputs(value: Record<string, unknown> | null | undefined) {
    this._selectedOptionComponentInputs$.next(value ?? {});
  }
  private _selectedOptionComponentInputs$ = new BehaviorSubject<Record<string, unknown>>({});

  @Input()
  get bodyErrorComponent() {
    return this._bodyErrorComponent$.value;
  }
  set bodyErrorComponent(value: ComponentWithError | null) {
    this._bodyErrorComponent$.next(value);
  }
  private _bodyErrorComponent$ = new BehaviorSubject<ComponentWithError | null>(
    this._comboboxConfig?.bodyErrorComponent ?? null,
  );

  @Input()
  get bodyErrorComponentInputs() {
    return this._bodyErrorComponentInputs$.value;
  }
  set bodyErrorComponentInputs(value: Record<string, unknown> | null | undefined) {
    this._bodyErrorComponentInputs$.next(value ?? {});
  }
  private _bodyErrorComponentInputs$ = new BehaviorSubject<Record<string, unknown>>({});

  @Input()
  get bodyLoadingComponent() {
    return this._bodyLoadingComponent$.value;
  }
  set bodyLoadingComponent(value: ComponentType<unknown> | null) {
    this._bodyLoadingComponent$.next(value);
  }
  private _bodyLoadingComponent$ = new BehaviorSubject<ComponentType<unknown> | null>(
    this._comboboxConfig?.bodyLoadingComponent ?? null,
  );

  @Input()
  get bodyLoadingComponentInputs() {
    return this._bodyLoadingComponentInputs$.value;
  }
  set bodyLoadingComponentInputs(value: Record<string, unknown> | null | undefined) {
    this._bodyLoadingComponentInputs$.next(value ?? {});
  }
  private _bodyLoadingComponentInputs$ = new BehaviorSubject<Record<string, unknown>>({});

  @Input()
  get bodyEmptyComponent() {
    return this._bodyEmptyComponent$.value;
  }
  set bodyEmptyComponent(value: ComponentType<unknown> | null) {
    this._bodyEmptyComponent$.next(value);
  }
  private _bodyEmptyComponent$ = new BehaviorSubject<ComponentType<unknown> | null>(
    this._comboboxConfig?.bodyEmptyComponent ?? null,
  );

  @Input()
  get bodyEmptyComponentInputs() {
    return this._bodyEmptyComponentInputs$.value;
  }
  set bodyEmptyComponentInputs(value: Record<string, unknown> | null | undefined) {
    this._bodyEmptyComponentInputs$.next(value ?? {});
  }
  private _bodyEmptyComponentInputs$ = new BehaviorSubject<Record<string, unknown>>({});

  @Input()
  get bodyMoreItemsHintComponent() {
    return this._bodyMoreItemsHintComponent$.value;
  }
  set bodyMoreItemsHintComponent(value: ComponentType<unknown> | null) {
    this._bodyMoreItemsHintComponent$.next(value);
  }
  private _bodyMoreItemsHintComponent$ = new BehaviorSubject<ComponentType<unknown> | null>(
    this._comboboxConfig?.bodyMoreItemsHintComponent ?? null,
  );

  @Input()
  get bodyMoreItemsHintComponentInputs() {
    return this._bodyMoreItemsHintComponentInputs$.value;
  }
  set bodyMoreItemsHintComponentInputs(value: Record<string, unknown> | null | undefined) {
    this._bodyMoreItemsHintComponentInputs$.next(value ?? {});
  }
  private _bodyMoreItemsHintComponentInputs$ = new BehaviorSubject<Record<string, unknown>>({});

  //#endregion

  //#region Outputs

  @Output()
  protected readonly filterChange = new EventEmitter<string>();

  //#endregion

  //#region Members

  private _shouldIgnoreNextBlurEvent = false;
  private _deletedSearchWithKeyPress = false;

  readonly selectBodyId$ = new BehaviorSubject<string | null>(null);
  readonly activeOptionId$ = new BehaviorSubject<string | null>(null);

  get currentFilter() {
    return this._currentFilter$.value;
  }
  private readonly _currentFilter$ = new BehaviorSubject<string>('');

  private get _isOpen() {
    return this._animatedOverlay.isMounted;
  }
  readonly isOpen$ = this._animatedOverlay.isMounted$;
  readonly isOpen = toSignal(this.isOpen$);

  readonly _selectionModel = new SelectionModel();
  readonly _activeSelectionModel = new ActiveSelectionModel();
  private readonly _backspaceKeyPressManager = new KeyPressManager(BACKSPACE);

  readonly selectedOptions$ = this._selectionModel.selection$;
  readonly multiple$ = this._selectionModel.allowMultiple$;
  readonly multipleSignal = toSignal(this.multiple$, { requireSync: true });
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

  @ContentChild(COMBOBOX_BODY_LOADING_TEMPLATE_TOKEN, { read: TemplateRef })
  set bodyLoadingTemplate(value: TemplateRef<unknown> | undefined) {
    this._bodyLoadingTemplate$.next(value ?? null);
  }
  private readonly _bodyLoadingTemplate$ = new BehaviorSubject<TemplateRef<unknown> | null>(null);

  @ContentChild(COMBOBOX_BODY_ERROR_TEMPLATE_TOKEN, { read: TemplateRef })
  set bodyErrorTemplate(value: TemplateRefWithError | undefined) {
    this._bodyErrorTemplate$.next(value ?? null);
  }
  private readonly _bodyErrorTemplate$ = new BehaviorSubject<TemplateRefWithError | null>(null);

  @ContentChild(COMBOBOX_BODY_EMPTY_TEMPLATE_TOKEN, { read: TemplateRef })
  set bodyEmptyTemplate(value: TemplateRef<unknown> | undefined) {
    this._bodyEmptyTemplate$.next(value ?? null);
  }
  private readonly _bodyEmptyTemplate$ = new BehaviorSubject<TemplateRef<unknown> | null>(null);

  @ContentChild(COMBOBOX_BODY_MORE_ITEMS_HINT_TEMPLATE_TOKEN, { read: TemplateRef })
  set bodyMoreItemsHintTemplate(value: TemplateRef<unknown> | undefined) {
    this._bodyMoreItemsHintTemplate$.next(value ?? null);
  }
  private readonly _bodyMoreItemsHintTemplate$ = new BehaviorSubject<TemplateRef<unknown> | null>(null);

  readonly hostClassBindings = signalHostClasses({
    'et-combobox--loading': toSignal(this._loading$),
    'et-combobox--error': toSignal(this._error$.pipe(map((v) => !!v))),
    'et-combobox--open': toSignal(this.isOpen$),
    'et-select-field--multiple': toSignal(this.multiple$),
    'et-select-field--open': this.isOpen,
  });

  readonly fieldHostClassBindings = signalClasses(this._selectField.elementRef, {
    'et-select-field--open': toSignal(this.isOpen$),
    'et-select-field--multiple': toSignal(this.multiple$),
  });

  private _comboboxBodyComponent: ComponentType<AbstractComboboxBody> | null = null;

  //#endregion

  //#region Computes

  readonly customOptionTpl$ = this._optionTemplate$.asObservable();
  readonly customOptionComponent$ = this._optionComponent$.asObservable();
  readonly customSelectedOptionTpl$ = this._selectedOptionTemplate$.asObservable();
  readonly customSelectedOptionComponent$ = this._selectedOptionComponent$.asObservable();
  readonly customBodyLoadingTpl$ = this._bodyLoadingTemplate$.asObservable();
  readonly customBodyLoadingComponent$ = this._bodyLoadingComponent$.asObservable();
  readonly customBodyErrorTpl$ = this._bodyErrorTemplate$.asObservable();
  readonly customBodyErrorComponent$ = this._bodyErrorComponent$.asObservable();
  readonly customBodyEmptyTpl$ = this._bodyEmptyTemplate$.asObservable();
  readonly customBodyEmptyComponent$ = this._bodyEmptyComponent$.asObservable();
  readonly customBodyMoreItemsHintTpl$ = this._bodyMoreItemsHintTemplate$.asObservable();
  readonly customBodyMoreItemsHintComponent$ = this._bodyMoreItemsHintComponent$.asObservable();

  readonly customOptionComponentInputs$ = this._optionComponentInputs$.asObservable();
  readonly customSelectedOptionComponentInputs$ = this._selectedOptionComponentInputs$.asObservable();
  readonly customBodyLoadingComponentInputs$ = this._bodyLoadingComponentInputs$.asObservable();
  readonly customBodyErrorComponentInputs$ = this._bodyErrorComponentInputs$.asObservable();
  readonly customBodyEmptyComponentInputs$ = this._bodyEmptyComponentInputs$.asObservable();
  readonly customBodyMoreItemsHintComponentInputs$ = this._bodyMoreItemsHintComponentInputs$.asObservable();

  //#endregion

  //#region Lifecycle

  constructor() {
    this._selectionModel.setDisabledBinding('disabled');

    this._activeSelectionModel.setSelectionModel(this._selectionModel);

    this._animatedOverlay.placement = 'bottom';
    this._animatedOverlay.fallbackPlacements = ['bottom', 'top'];
    this._animatedOverlay.autoResize = true;

    this._selectionModel.allowMultiple$
      .pipe(
        takeUntilDestroyed(),
        tap((allowMultiple) => {
          if (allowMultiple) {
            this._updateFilter('');
          }
        }),
      )
      .subscribe();

    this._input._setEmptyHelper(this._currentFilter$);
  }

  ngOnInit(): void {
    this._initDispatchFilterChanges();
    this._closeBodyOnDisable();

    if (isDevMode()) {
      this._debugValidateComboboxConfig();
      this._debugValidateOptionAndInitialValueSchema();
    }

    this._selectionModel.setSelectionFromValue$(this._input.value);

    this._selectionModel.value$
      .pipe(
        takeUntil(this._destroy$),
        tap((value) => {
          this._input._updateValue(value);
          this._setFilterFromInputValue();
        }),
      )
      .subscribe();

    this._input.onExternalUpdate$
      .pipe(
        takeUntil(this._destroy$),
        tap(() => this._selectionModel.setSelectionFromValue$(this._input.value)),
      )
      .subscribe();
  }

  //#endregion

  //#region Public Methods

  setBodyComponent(component: ComponentType<AbstractComboboxBody>) {
    this._comboboxBodyComponent = component;
  }

  getOptionLabel(option: unknown) {
    return this._selectionModel.getLabel$(option);
  }

  getOptionValue(option: unknown) {
    return this._selectionModel.getValue$(option);
  }

  combineSelectedOptionWithComponentInputs(option: unknown) {
    return this.customSelectedOptionComponentInputs$.pipe(
      map((inputs) => ({ option, ...inputs })),
      takeUntil(this._destroy$),
    );
  }

  removeSelectedOption(option: unknown) {
    this._selectionModel.removeSelectedOption(option);

    this._input._markAsTouched();
  }

  open() {
    assetComboboxBodyComponentSet(this._comboboxBodyComponent);

    if (this._isOpen || this._input.disabled || this._animatedOverlay.isMounting) return;

    const bodyRef = this._animatedOverlay.mount({
      component: this._comboboxBodyComponent,
      mirrorWidth: true,
      themeProvider: this._themeProvider,
    });

    if (!bodyRef) return;

    this.selectBodyId$.next(bodyRef.id);

    bodyRef._options$
      .pipe(
        switchMap((queryList) =>
          combineLatest([
            queryList?.changes.pipe(
              startWith(queryList),
              map((l) => l.toArray()),
            ) ?? of([] as AbstractComboboxOption[]),
            this._activeSelectionModel.activeOption$,
          ]),
        ),
        tap(([options, activeOptionData]) => {
          const optionRef = options.find((o) => o._option$.value === activeOptionData);

          if (!optionRef?._elementRef?.nativeElement) return;

          scrollToElement({
            behavior: 'instant',
            element: optionRef._elementRef.nativeElement,
            container: bodyRef._containerElementRef?.nativeElement,
          });

          this.activeOptionId$.next(optionRef.id);
        }),
        takeUntil(this._destroy$),
        takeUntil(this._animatedOverlay.afterClosed()),
      )
      .subscribe();

    this._animatedOverlay
      .afterClosed()
      .pipe(
        takeUntil(this._destroy$),
        tap(() => {
          this.selectBodyId$.next(null);
          this.activeOptionId$.next(null);
        }),
      )
      .subscribe();
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
    return this._activeSelectionModel.isOptionActive$(option);
  }

  isOptionDisabled(option: unknown) {
    return this._selectionModel.isDisabled$(option);
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

    const result: ComboboxKeyHandlerResult = {};

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
        event.preventDefault();
        event.stopPropagation();
      } else if (!isMultiple) {
        if (this.currentFilter) {
          event.preventDefault();
          event.stopPropagation();
        }

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

    if (this.currentFilter === '') {
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

    if (this.currentFilter === value) return;

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

  private _interpretKeyHandlerResult(result: ComboboxKeyHandlerResult) {
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

        if (this._selectionModel.isDisabled(option)) return;

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

  private _closeBodyOnDisable() {
    this._input.disabled$
      .pipe(
        tap((disabled) => {
          if (!disabled) return;

          this.close();
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();
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

          if (!this.multiple) return;

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
