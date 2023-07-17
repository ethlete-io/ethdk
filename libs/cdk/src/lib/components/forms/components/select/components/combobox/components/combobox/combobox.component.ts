import { A, ENTER, ESCAPE, TAB } from '@angular/cdk/keycodes';
import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  EventEmitter,
  InjectionToken,
  Input,
  OnInit,
  Output,
  TemplateRef,
  ViewEncapsulation,
  booleanAttribute,
  inject,
  isDevMode,
} from '@angular/core';
import {
  ActiveSelectionModel,
  AnimatedOverlayDirective,
  LetDirective,
  RuntimeError,
  SelectionModel,
} from '@ethlete/core';
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
import { SELECT_FIELD_TOKEN } from '../../../../directives';
import { COMBOBOX_OPTION_TEMPLATE_TOKEN } from '../../directives';
import { ComboboxBodyComponent } from '../../partials';
import { isOptionDisabled } from '../../utils';

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

interface KeyHandlerResult {
  setFilter?: string;
  overlayOperation?: 'open' | 'close';
  optionAction?:
    | {
        type: 'add';
        option: unknown;
      }
    | {
        type: 'remove';
        option: unknown;
      }
    | {
        type: 'toggle';
        option: unknown;
      }
    | 'clear'
    | 'toggleAll';
}

@Component({
  selector: 'et-combobox',
  templateUrl: './combobox.component.html',
  styleUrls: ['./combobox.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-combobox',
    '(click)': 'selectInputAndOpen()',
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
  private readonly _selectField = inject(SELECT_FIELD_TOKEN);

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
  set filterInternal(value: unknown) {
    const val = booleanAttribute(value);
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
  set allowCustomValues(value: unknown) {
    this._allowCustomValues$.next(booleanAttribute(value));
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
  private readonly _activeSelectionModel = new ActiveSelectionModel();

  readonly selectedOptions$ = this._selectionModel.selection$;
  readonly multiple$ = this._selectionModel.allowMultiple$;
  readonly options$ = this._selectionModel.filteredOptions$;
  readonly rawOptions$ = this._selectionModel.options$;

  @ContentChild(COMBOBOX_OPTION_TEMPLATE_TOKEN, { read: TemplateRef })
  set optionTemplates(value: TemplateRef<{ option: unknown }> | undefined) {
    this._optionTemplate$.next(value ?? null);
  }
  private readonly _optionTemplate$ = new BehaviorSubject<TemplateRef<{ option: unknown }> | null>(null);

  //#endregion

  //#region Computes

  readonly customOptionTpl$ = this._optionTemplate$.asObservable();

  //#endregion

  //#region Lifecycle

  constructor() {
    super();

    this._activeSelectionModel.setSelectionModel(this._selectionModel);

    this._animatedOverlay.placement = 'bottom';
    this._animatedOverlay.allowedAutoPlacements = ['bottom', 'top'];

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

    this._selectField._bindings.push({
      attribute: 'class.et-select-field--multiple',
      observable: this.multiple$,
    });

    this._selectField._bindings.push({
      attribute: 'class.et-select-field--open',
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

    if (this._isOpen || this.input.disabled || this._animatedOverlay.isMounting) return;

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
    if (!this._isOpen || this._animatedOverlay.isUnmounting) return;

    this._animatedOverlay.unmount();

    // this._selectBodyId$.next(null);
  }

  selectInputAndOpen() {
    if (this.input.disabled) return;

    this.input.nativeInputRef?.element.nativeElement.select();
    this.open();
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

  //#endregion

  //#region Protected Methods

  protected processKeydownEvent(event: KeyboardEvent) {
    const keyCode = event.keyCode;
    const isOpen = this._isOpen;
    const isMultiple = this._selectionModel.allowMultiple;
    const canAddCustomValue = this.allowCustomValues;
    const value = (event.target as HTMLInputElement).value;
    const hasFilterValue = !!value;

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

  protected processInputEvent(event: Event) {
    const value = (event.target as HTMLInputElement).value;

    this._updateFilter(value);
  }

  protected handleBlurEvent() {
    this.input._markAsTouched();
    this.input._setShouldDisplayError(true);

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
