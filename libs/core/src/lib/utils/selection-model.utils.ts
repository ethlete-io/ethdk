import { BehaviorSubject, combineLatest, map, shareReplay } from 'rxjs';

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

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

export type SelectionModelTypes = string | number | Record<string, unknown> | unknown;
export type SelectionModelPropertyPath = string;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SelectionModelOptionValueFn<T extends SelectionModelTypes = any> = (option: T) => unknown;

/**
 * You can use a property path or a function to get the value of an option. The function should be as **lightweight as possible** as it will be called **a lot**.
 *
 * @example
 * // Property path
 * "id" // option.id
 * "user.name" // option.user.name
 *
 * // Function
 * (option) => option.id // option.id
 * (option) => option.user.name // option.user.name
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SelectionModelBinding<T extends SelectionModelTypes = any> =
  | SelectionModelPropertyPath
  | SelectionModelOptionValueFn<T>;

export class SelectionModel<T extends SelectionModelTypes = unknown> {
  get selection$() {
    return this._selection$.asObservable();
  }
  get selection() {
    return this._selection$.value;
  }
  private readonly _selection$ = new BehaviorSubject<T[]>([]);

  get options$() {
    return this._options$.asObservable();
  }
  get options() {
    return this._options$.value;
  }
  private readonly _options$ = new BehaviorSubject<T[]>([]);

  get valueBinding$() {
    return this._valueBinding$.asObservable();
  }
  get valueBinding() {
    return this._valueBinding$.value;
  }
  private readonly _valueBinding$ = new BehaviorSubject<SelectionModelBinding<T> | null>(null);

  get keyBinding$() {
    return combineLatest([this._keyBinding$, this.valueBinding$]).pipe(
      map(([keyBinding, valueBinding]) => keyBinding || valueBinding),
    );
  }
  get keyBinding() {
    return this._keyBinding$.value || this.valueBinding;
  }
  private readonly _keyBinding$ = new BehaviorSubject<SelectionModelBinding<T> | null>(null);

  get labelBinding$() {
    return this._labelBinding$.asObservable();
  }
  get labelBinding() {
    return this._labelBinding$.value;
  }
  private readonly _labelBinding$ = new BehaviorSubject<SelectionModelBinding<T> | null>(null);

  get allowMultiple$() {
    return this._allowMultiple$.asObservable();
  }
  get allowMultiple() {
    return this._allowMultiple$.value;
  }
  private readonly _allowMultiple$ = new BehaviorSubject<boolean>(false);

  get filter$() {
    return this._filter$.asObservable();
  }
  get filter() {
    return this._filter$.value;
  }
  private readonly _filter$ = new BehaviorSubject<string>('');

  readonly value$ = combineLatest([this.selection$, this.valueBinding$, this.allowMultiple$]).pipe(
    map(([selection, valueBinding, allowMultiple]) => {
      if (allowMultiple) {
        return selection.map((option) => this.execFnOrGetOptionProperty(option, valueBinding));
      }

      const [option] = selection;

      if (!option) return null;

      return this.execFnOrGetOptionProperty(option, valueBinding);
    }),
  );

  readonly filteredOptions$ = combineLatest([this.options$, this.filter$, this.labelBinding$]).pipe(
    map(([options, filter]) => this.getFilteredOptions(filter, options)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  private readonly _optionsAndSelection$ = combineLatest([this._options$, this._selection$]);

  setSelection(selection: T | T[]) {
    if (!Array.isArray(selection)) {
      selection = [selection];
    }

    this._selection$.next(selection);

    return this;
  }

  setValueBinding(fnOrPropertyPath: SelectionModelBinding<T> | null) {
    this._valueBinding$.next(fnOrPropertyPath);

    return this;
  }

  setKeyBinding(fnOrPropertyPath: SelectionModelBinding<T> | null) {
    this._keyBinding$.next(fnOrPropertyPath);

    return this;
  }

  setLabelBinding(fnOrPropertyPath: SelectionModelBinding<T> | null) {
    this._labelBinding$.next(fnOrPropertyPath);

    return this;
  }

  setOptions(options: T[]) {
    this._options$.next(options);

    return this;
  }

  setAllowMultiple(allowMultiple: boolean) {
    this._allowMultiple$.next(allowMultiple);

    return this;
  }

  setFilter(filter: string | null) {
    const sanitizedFilter = filter?.trim() || '';

    this._filter$.next(sanitizedFilter);
  }

  reset() {
    this._selection$.next([]);
    this._options$.next([]);
    this._valueBinding$.next(null);
    this._keyBinding$.next(null);
    this._labelBinding$.next(null);
    this._allowMultiple$.next(false);
  }

  getOptionByValue$(value: unknown) {
    return this._optionsAndSelection$.pipe(map(() => this.getOptionByValue(value)));
  }

  getOptionByLabel$(label: string) {
    return this._optionsAndSelection$.pipe(map(() => this.getOptionByLabel(label)));
  }

  getOptionByKey$(key: string) {
    return this._optionsAndSelection$.pipe(map(() => this.getOptionByKey(key)));
  }

  isSelected$(option: T) {
    return this._selection$.pipe(map(() => this.isSelected(option)));
  }

  getLabel$(option: T) {
    return this.labelBinding$.pipe(map((labelBinding) => this.execFnOrGetOptionProperty(option, labelBinding)));
  }

  getValue$(option: T) {
    return this.valueBinding$.pipe(map((valueBinding) => this.execFnOrGetOptionProperty(option, valueBinding)));
  }

  getKey$(option: T) {
    return this.keyBinding$.pipe(map((keyBinding) => this.execFnOrGetOptionProperty(option, keyBinding)));
  }

  getOptionByValue(value: unknown) {
    return this.getOption(value, this.valueBinding);
  }

  getOptionByLabel(label: string) {
    return this.getOption(label, this.labelBinding);
  }

  getOptionByKey(key: string) {
    return this.getOption(key, this.keyBinding);
  }

  getOption(
    value: unknown,
    propertyPath: SelectionModelBinding<T> | null = null,
    options = [...this.options, ...this.selection],
  ) {
    if (!propertyPath) {
      return options.find((option) => option === value);
    }

    return options.find((option) => {
      if (!isObject(option)) return false;

      return this.execFnOrGetOptionProperty(option, propertyPath) === value;
    });
  }

  getOptionByIndex(index: number, options = this.getFilteredOptions()): T | null {
    return options[index] || null;
  }

  getOptionByOffset(
    offset: number,
    index: number,
    options = this.getFilteredOptions(),
    config: { loop?: boolean; clamp?: boolean } = { clamp: true },
  ): T | null {
    const { loop, clamp } = config;

    const newIndex = index + offset;
    const remainingOffset = newIndex * -1;

    if (newIndex < 0) {
      if (loop) {
        return this.getOptionByOffset(remainingOffset, options.length - 1, options, config);
      }

      if (clamp) {
        return this.getFirstOption();
      }

      return null;
    }

    if (newIndex >= options.length) {
      if (loop) {
        return this.getOptionByOffset(remainingOffset, 0, options, config);
      }

      if (clamp) {
        return this.getLastOption();
      }

      return null;
    }

    return this.getOptionByIndex(newIndex);
  }

  getFirstOption(options = this.getFilteredOptions()): T | null {
    return this.getOptionByIndex(0, options);
  }

  getLastOption(options = this.getFilteredOptions()): T | null {
    return this.getOptionByIndex(options.length - 1, options);
  }

  getOptionIndex(option: T, options = this.getFilteredOptions()) {
    const key = this.getKey(option);
    const index = options.findIndex((o) => this.getKey(o) === key);

    return index === -1 ? null : index;
  }

  getNonMultipleSelectedOption(): T | null {
    if (this.allowMultiple) return null;

    return this.selection[0] || null;
  }

  getNonMultipleSelectedOptionIndex() {
    if (this.allowMultiple) return null;

    const opt = this.getNonMultipleSelectedOption();

    if (!opt) return null;

    return this.getOptionIndex(opt);
  }

  getNonMultipleOptionByOffsetFromSelected(
    offset: number,
    config: { loop?: boolean; clamp?: boolean } = { clamp: true },
  ) {
    if (this.allowMultiple) return null;

    const index = this.getNonMultipleSelectedOptionIndex();

    if (index === null) return null;

    return this.getOptionByOffset(index, offset, this.getFilteredOptions(), config);
  }

  getLabel(option: T) {
    return this.execFnOrGetOptionProperty(option, this.labelBinding);
  }

  getValue(option: T) {
    return this.execFnOrGetOptionProperty(option, this.valueBinding);
  }

  getKey(option: T) {
    return this.execFnOrGetOptionProperty(option, this.keyBinding);
  }

  execFnOrGetOptionProperty(option: T, fnOrPropertyPath: SelectionModelBinding<T> | null) {
    if (!fnOrPropertyPath || !isObject(option)) return option;

    if (typeof fnOrPropertyPath === 'function') {
      return fnOrPropertyPath(option);
    }

    return getObjectProperty(option, fnOrPropertyPath);
  }

  getOptionProperty(option: T, propertyPath: string | null) {
    if (!propertyPath || !isObject(option)) return option;

    return getObjectProperty(option, propertyPath);
  }

  isSelected(option: T) {
    const optionKey = this.execFnOrGetOptionProperty(option, this.keyBinding);

    return this.getOption(optionKey, this.keyBinding, this.selection) !== undefined;
  }

  getFilteredOptions(filter = this.filter, options = this.options) {
    if (!filter) return options;

    const splitFilter = filter.split(' ').filter((f) => f);

    return options.filter((option) => {
      const label = this.getLabel(option);

      if (!label || typeof label !== 'string') return false;

      const splitLabel = label.split(' ').filter((l) => l);

      return splitFilter.every((f) => splitLabel.some((l) => l.toLowerCase().includes(f.toLowerCase())));
    });
  }

  addSelectedOption(option: T) {
    if (this.allowMultiple) {
      if (this.isSelected(option)) return;

      this._selection$.next([...this.selection, option]);
    } else {
      this._selection$.next([option]);
    }
  }

  removeSelectedOption(option: T) {
    const optionKey = this.execFnOrGetOptionProperty(option, this.keyBinding);

    if (!this.isSelected(option)) return;

    this._selection$.next(
      this.selection.filter((selectedOption) => {
        const key = this.execFnOrGetOptionProperty(selectedOption, this.keyBinding);

        return key !== optionKey;
      }),
    );
  }

  clearSelectedOptions() {
    this._selection$.next([]);
  }

  toggleSelectedOption(option: T) {
    if (this.isSelected(option)) {
      this.removeSelectedOption(option);
    } else {
      this.addSelectedOption(option);
    }
  }

  toggleAllSelectedOptions() {
    const filteredOptions = this.getFilteredOptions();
    const unselectedOptions = filteredOptions.filter((option) => !this.isSelected(option));

    if (unselectedOptions.length) {
      const selection = unselectedOptions.filter((o) => !this.selection.some((s) => this.getKey(s) === this.getKey(o)));

      this._selection$.next([...this.selection, ...selection]);
    } else {
      const selection = this.selection.filter((s) => !filteredOptions.some((o) => this.getKey(o) === this.getKey(s)));

      this._selection$.next(selection);
    }
  }
}
