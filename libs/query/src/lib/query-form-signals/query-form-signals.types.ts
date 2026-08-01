/**
 * The internal, fully-resolved definition of a single query-form field.
 *
 * Produced by the field creators (`queryField()`, `searchQueryField()`, …) and
 * consumed by `createQueryForm()`. `T` is the field's value type and always
 * includes `null` (a field can be cleared).
 */
export type QueryFieldDef<T> = {
  /**
   * The default value. When the field equals this value it is elided from the
   * URL (unless `appendDefaultValueToUrl` is set) and ignored by the filter
   * count. A function is evaluated lazily every time the default is needed.
   */
  readonly defaultValue: T | (() => T);

  /** Debounce in milliseconds before a change is committed (emitted + written to the URL). */
  readonly debounce?: number;

  /**
   * Skip the debounce when the new value is falsy. Useful for search fields so
   * that clearing the input applies immediately while typing stays debounced.
   *
   * @default false
   */
  readonly disableDebounceIfFalsy?: boolean;

  /**
   * Write the field's value to the URL. A field is never written while it holds
   * its default value unless `appendDefaultValueToUrl` is set.
   *
   * @default true
   */
  readonly appendToUrl?: boolean;

  /**
   * Write the field to the URL even when it holds its default value. Ignored
   * when `appendToUrl` is `false`.
   *
   * @default false
   */
  readonly appendDefaultValueToUrl?: boolean;

  /**
   * Reset this field to its default whenever one of the listed sibling fields
   * changes - e.g. a `page` field is reset by `['search', 'limit']`.
   */
  readonly isResetBy?: readonly string[];

  /**
   * Exclude this field from `activeFilterCount`. The common pagination/sort/search
   * keys are excluded automatically (see `IGNORED_FILTER_COUNT_FIELDS`).
   *
   * @default false
   */
  readonly skipInFilterCount?: boolean;

  /**
   * Skip the best-effort auto-coercion (numeric strings → number, `'true'`/`'false'`
   * → boolean, the null sentinel → `null`) when reading the value back from the URL.
   *
   * @default false
   */
  readonly skipAutoTransform?: boolean;

  /** Transform a raw URL query-param value into the field's value type. */
  readonly queryParamToValue?: (raw: unknown) => T;

  /**
   * Transform the field's value into a raw URL query-param value.
   *
   * Declared with method syntax, and it has to be: as an arrow-typed property it makes `QueryFieldDef<T>`
   * contravariant in `T`, so `QueryFieldDef<string>` is not assignable to `QueryFieldDef<unknown>` and therefore a
   * concrete field map does not satisfy {@link QueryFormFields}. Inference papers over that, but it makes any
   * generic API over a query form - `injectFilterOverlay<typeof MY_FIELDS>()`, or simply passing a
   * `QueryFormSignals<typeof MY_FIELDS>` to something that takes a `QueryFormSignals<TFields>` - impossible to
   * write. Method syntax is bivariant, which is the right call for a heterogeneous record like this.
   */
  valueToQueryParam?(value: T): unknown;
};

/**
 * Options accepted by a field creator. Everything is optional; `isResetBy`
 * accepts a single key or a list for convenience.
 */
export type QueryFieldConfig<T> = Partial<Omit<QueryFieldDef<T>, 'isResetBy'>> & {
  readonly isResetBy?: string | readonly string[];
};

/** Extracts a field definition's value type. */
export type QueryFieldValue<F> = F extends QueryFieldDef<infer T> ? T : never;

/** A map of field name → field definition, as passed to `createQueryForm({ fields })`. */
export type QueryFormFields = Record<string, QueryFieldDef<unknown>>;

/** The value shape of a query form - one entry per field. */
export type QueryFormModel<TFields extends QueryFormFields> = {
  [K in keyof TFields]: QueryFieldValue<TFields[K]>;
};

/** A committed change: the value before and after a commit. */
export type QueryFormChange<TFields extends QueryFormFields> = {
  readonly previousValue: QueryFormModel<TFields> | null;
  readonly currentValue: QueryFormModel<TFields>;
};

/**
 * Options passed to `observe()`. Named distinctly from the legacy
 * `QueryFormObserveOptions` to keep both APIs' barrel exports intact.
 */
export type QueryFormSignalsObserveOptions = {
  /**
   * Sync the committed value to the URL query params.
   * @default true
   */
  readonly writeToQueryParams?: boolean;

  /**
   * Apply URL → form changes on navigation (back/forward, external links).
   * @default true
   */
  readonly syncOnNavigation?: boolean;

  /**
   * Replace the current history entry instead of pushing a new one.
   * @default false
   */
  readonly replaceUrl?: boolean;
};

/**
 * Options for a single programmatic write (`setValue`/`patchValue`/reset).
 *
 * Named distinctly from the legacy reactive-forms `QueryFormWriteOptions` (which
 * also carried the RxJS-only `onlySelf`/`emitEvent`) - the signals variant only
 * needs `skipResets`.
 */
export type QueryFormSignalsWriteOptions = {
  /**
   * Skip the `isResetBy` graph for this write, so dependent fields keep their
   * current value instead of resetting to default.
   * @default false
   */
  readonly skipResets?: boolean;
};
