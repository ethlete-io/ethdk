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
import { AnimatedOverlayDirective, LetDirective, clone } from '@ethlete/core';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  shareReplay,
  skip,
  takeUntil,
  tap,
  throwError,
} from 'rxjs';
import { ChevronIconComponent } from '../../../../../../../icons';
import { INPUT_TOKEN, InputDirective, NativeInputRefDirective } from '../../../../../../directives';
import { DecoratedInputBase } from '../../../../../../utils';
import { ComboboxBodyComponent } from '../../partials';

export class RuntimeError<T extends number> extends Error {
  constructor(public code: T, message: null | false | string, public data: unknown = '__ET_NO_DATA__') {
    super(formatRuntimeError<T>(code, message));

    if (data !== '__ET_NO_DATA__') {
      try {
        const _data = clone(data);

        setTimeout(() => {
          console.error(_data);
        }, 1);
      } catch {
        setTimeout(() => {
          console.error(data);
        }, 1);
      }
    }
  }
}

export function formatRuntimeError<T extends number>(code: T, message: null | false | string): string {
  // prefix code with zeros if it's less than 100
  const codeWithZeros = code < 10 ? `00${code}` : code < 100 ? `0${code}` : code;

  const fullCode = `ET${codeWithZeros}`;

  return `${fullCode}${message ? ': ' + message : ''}`;
}

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

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const ComboboxOptionType = {
  Primitive: 'primitive',
  Object: 'object',
} as const;

const ComboboxInputValueType = {
  Single: 'single',
  Array: 'array',
} as const;

const getObjectProperty = (obj: Record<string, unknown>, prop: string) => {
  const hasDotNotation = prop.includes('.');

  if (!hasDotNotation) return obj[prop];

  const props = prop.split('.');

  let value: unknown = obj;

  for (const prop of props) {
    if (!isObject(value)) return undefined;

    value = value[prop];
  }

  return value;
};

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
    return this._options$.value;
  }
  set options(value: unknown[]) {
    this._options$.next(value);
  }
  private _options$ = new BehaviorSubject<unknown[]>([]);
  readonly options$ = this._options$.asObservable();

  @Input()
  get initialValue() {
    return this._initialValue$.value;
  }
  set initialValue(value: unknown) {
    this._initialValue$.next(value);

    this._updateSelectedOptionsViaInitialValue();
  }
  private _initialValue$ = new BehaviorSubject<unknown>(null);

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
  get multiple(): boolean {
    return this._multiple$.value;
  }
  set multiple(value: BooleanInput) {
    this._multiple$.next(coerceBooleanProperty(value));
  }
  private _multiple$ = new BehaviorSubject(false);

  @Input()
  get bindLabel() {
    return this._bindLabel$.value;
  }
  set bindLabel(value: string | null) {
    this._bindLabel$.next(value);
  }
  private _bindLabel$ = new BehaviorSubject<string | null>(null);

  @Input()
  get bindValue() {
    return this._bindValue$.value;
  }
  set bindValue(value: string | null) {
    this._bindValue$.next(value);
  }
  private _bindValue$ = new BehaviorSubject<string | null>(null);

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

  private get _rawSelectedOptions() {
    return this._rawSelectedOptions$.value;
  }
  private readonly _rawSelectedOptions$ = new BehaviorSubject<unknown[]>([]);

  private get _currentFilter() {
    return this._currentFilter$.value;
  }
  private readonly _currentFilter$ = new BehaviorSubject<string>('');

  private get _isOpen() {
    return this._animatedOverlay.isMounted;
  }
  private readonly _isOpen$ = this._animatedOverlay.isMounted$;

  //#endregion

  //#region Computes

  private readonly _allOptions$ = combineLatest([this._options$, this._rawSelectedOptions$]).pipe(
    map(([options, rawSelectedOptions]) => [...options, ...rawSelectedOptions]),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  protected readonly expectedOptionType$ = combineLatest([
    this._bindLabel$,
    this._bindValue$,
    this._allowCustomValues$,
  ]).pipe(
    map(([bindLabel, bindValue, allowCustomValues]) => {
      const shouldBeObjects = bindLabel && bindValue && !allowCustomValues;

      if (shouldBeObjects) {
        return ComboboxOptionType.Object;
      }

      return ComboboxOptionType.Primitive;
    }),
  );

  protected readonly expectedInputValueType$ = this._multiple$.pipe(
    map((multiple) => (multiple ? ComboboxInputValueType.Array : ComboboxInputValueType.Single)),
  );

  protected readonly selectedOptions$ = combineLatest([
    this._input.value$,
    this.expectedInputValueType$,
    this._allOptions$,
  ]).pipe(
    map(([inputValue, expectedInputValueType, allOptions]) => {
      if (expectedInputValueType === ComboboxInputValueType.Single) {
        if (Array.isArray(inputValue)) {
          return [];
        }

        const option = this._findOptionByValue(inputValue, allOptions);

        return [option];
      } else if (expectedInputValueType === ComboboxInputValueType.Array) {
        if (!Array.isArray(inputValue)) {
          return [];
        }

        const options = inputValue.map((value) => this._findOptionByValue(value, allOptions)).filter((v) => !!v);

        if (!options.length) return [];

        return options;
      }

      return [];
    }),
    map((options) => options.filter((v) => !!v)),
  );

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
  }

  //#endregion

  //#region Public Methods

  getOptionLabel(option: unknown) {
    if (!this.bindLabel || !isObject(option)) {
      return of(option);
    }

    return this._bindLabel$.pipe(
      map((label) => {
        if (!label) return option;

        return getObjectProperty(option, label) ?? option;
      }),
    );
  }

  getOptionValue(option: unknown) {
    if (!this.bindValue || !isObject(option)) {
      return of(option);
    }

    return this._bindValue$.pipe(
      map((value) => {
        if (!value) return option;

        return getObjectProperty(option, value) ?? option;
      }),
    );
  }

  removeSelectedOption(option: unknown) {
    this.input._markAsTouched();

    const selectedOptions = this._rawSelectedOptions;
    const optionValue = this._getOptionValueSync(option);

    const index = selectedOptions.findIndex((v) => {
      const val = this._getOptionValueSync(v);

      return val === optionValue;
    });

    if (index === -1) return;

    selectedOptions.splice(index, 1);

    this._rawSelectedOptions$.next(selectedOptions);

    this._removeOrClearInputValue(optionValue);
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

    const optionValue = this._getOptionValueSync(option);

    if (this._findOptionByValue(optionValue, this._rawSelectedOptions)) {
      if (this.multiple) {
        this.removeSelectedOption(option);
        this._removeOrClearInputValue(optionValue);
      }

      return;
    }

    this._setOrAddToInputValue(optionValue);
    this._addSelectedOption(option);

    if (!this.multiple) {
      this.close();
      this._setFilterFromInputValue();
    }
  }

  isOptionSelected(option: unknown) {
    return combineLatest([this._rawSelectedOptions$, this.getOptionValue(option)]).pipe(
      map(([selectedOptions, value]) => !!this._findOptionByValue(value, selectedOptions)),
    );
  }

  //#endregion

  //#region Protected Methods

  protected processKeydownEvent(event: KeyboardEvent) {
    const keyCode = event.keyCode;
    const isOpen = this._isOpen;
    const isMultiple = this.multiple;
    const canAddCustomValue = this.allowCustomValues;
    const value = (event.target as HTMLInputElement).value;
    const hasValue = !!value;

    // The user typed a custom value and pressed enter. Add it to the selected options.
    if (keyCode === ENTER && canAddCustomValue && hasValue) {
      // Don't add the value if it already exists.
      if (!this._findOptionByValue(value, this._rawSelectedOptions)) {
        this._addSelectedOption(value);
        this._setOrAddToInputValue(value);
      }

      if (this.multiple) {
        this._updateFilter('');
      }

      return;
    }

    if (keyCode === ESCAPE) {
      if (isOpen) {
        this.close();
      } else {
        if (!isMultiple) {
          this._removeOrClearInputValue(null);
          this._updateFilter('');
          return;
        }
      }
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

    if (this.multiple) return;

    if (this._currentFilter === '') {
      this._removeOrClearInputValue(null);
      return;
    }

    this._setFilterFromInputValue();
  }

  //#endregion

  //#region Private Methods

  private _initDispatchFilterChanges() {
    this._currentFilter$
      .pipe(
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

  private _updateSelectedOptionsViaInitialValue() {
    if (this.initialValue !== null && this.initialValue !== undefined) {
      if (Array.isArray(this.initialValue)) {
        this._addSelectedOptions(this.initialValue);
      } else {
        this._addSelectedOption(this.initialValue);
      }
    }
  }

  private _addSelectedOption(option: unknown) {
    if (this.multiple) {
      this._rawSelectedOptions$.next([...this._rawSelectedOptions, option]);
    } else {
      this._rawSelectedOptions$.next([option]);
    }
  }

  private _addSelectedOptions(options: unknown[]) {
    if (!this.multiple) {
      return;
    }

    this._rawSelectedOptions$.next([...this._rawSelectedOptions, ...options]);
  }

  private _findOptionByValue(value: unknown, allOptions: unknown[]) {
    const option = allOptions.find((option) => {
      if (isObject(option) && this.bindValue) {
        return getObjectProperty(option, this.bindValue) === value;
      }

      return option === value;
    });

    return option;
  }

  private _setOrAddToInputValue(value: unknown) {
    if (this.multiple) {
      if (Array.isArray(this._input.value)) {
        this._input._updateValue([...this._input.value, value]);
      } else {
        this._input._updateValue([value]);
      }
    } else {
      this._input._updateValue(value);
    }
  }

  private _removeOrClearInputValue(value: unknown) {
    if (this.multiple) {
      if (Array.isArray(this._input.value)) {
        this._input._updateValue(this._input.value.filter((v) => v !== value));
      } else {
        this._input._updateValue([]);
      }
    } else {
      this._input._updateValue(null);
    }
  }

  private _updateFilter(value: string) {
    if (this.input.nativeInputRef && this.input.nativeInputRef.element.nativeElement.value !== value) {
      this.input.nativeInputRef.element.nativeElement.value = value;
    }

    if (this._currentFilter === value) return;

    this._currentFilter$.next(value);
  }

  private _getOptionValueSync(option: unknown) {
    if (!this.bindValue || !isObject(option)) {
      return option;
    }

    return getObjectProperty(option, this.bindValue) ?? option;
  }

  private _getOptionLabelSync(option: unknown) {
    if (!this.bindLabel || !isObject(option)) {
      return option;
    }

    return getObjectProperty(option, this.bindLabel) ?? option;
  }

  private _setFilterFromInputValue() {
    if (this.multiple) return;

    const value = this.input.value;

    if (!value || Array.isArray(value)) {
      this._updateFilter('');
      return;
    }

    const option = this._findOptionByValue(value, this._rawSelectedOptions);

    if (!option) return;

    const label = this._getOptionLabelSync(option);

    if (typeof label !== 'string') return;

    this._updateFilter(label);
  }

  //#endregion

  //#region Dev mode

  private _debugValidateComboboxConfig(isRetry = false) {
    this.expectedOptionType$
      .pipe(
        skip(isRetry ? 1 : 0), // Skip if retrying to avoid infinite loop
        debounceTime(0),
        takeUntil(this._destroy$),
        tap((expectedOptionType) => {
          if (isEmptyArray(this.options)) {
            return;
          }

          if (expectedOptionType === ComboboxOptionType.Object) {
            if (!isObjectArray(this.options)) {
              throw comboboxError(1, this.options);
            }
          } else if (expectedOptionType === ComboboxOptionType.Primitive) {
            if (!isPrimitiveArray(this.options)) {
              throw comboboxError(2, this.options);
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
