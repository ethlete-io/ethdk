import {
  DestroyRef,
  Injector,
  Signal,
  assertInInjectionContext,
  computed,
  effect,
  inject,
  isDevMode,
  signal,
  untracked,
} from '@angular/core';
import { FieldTree, form } from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';
import { ET_PROPERTY_REMOVED, clone, equal, injectQueryParamChanges } from '@ethlete/core';
import { transformToBoolean, transformToNumber } from '../query-form/query-form.utils';
import {
  QueryFieldDef,
  QueryFormChange,
  QueryFormFields,
  QueryFormModel,
  QueryFormSignalsObserveOptions,
  QueryFormSignalsWriteOptions,
} from './query-form-signals.types';

/** URL sentinel for an explicit `null` value (a bare empty param would be ambiguous). */
const ET_NULL_VALUE = 'ET_NULL__';

/**
 * Fields excluded from `activeFilterCount` by default - pagination, sorting and
 * search are navigation state, not filters.
 */
export const IGNORED_FILTER_COUNT_FIELDS: readonly string[] = [
  'page',
  'skip',
  'take',
  'limit',
  'sort',
  'sortBy',
  'sortOrder',
  'query',
  'search',
];

type Dict = Record<string, unknown>;

const resolveDefault = (def: QueryFieldDef<unknown>): unknown => {
  const { defaultValue } = def;

  return typeof defaultValue === 'function' ? (defaultValue as () => unknown)() : (defaultValue ?? null);
};

const buildDefaults = (fields: QueryFormFields): Dict => {
  const out: Dict = {};

  for (const [key, def] of Object.entries(fields)) {
    out[key] = resolveDefault(def);
  }

  return out;
};

const changedKeysBetween = (previous: Dict | null, current: Dict): string[] =>
  Object.keys(current).filter((key) => !equal(previous?.[key], current[key]));

/** Best-effort URL string → value coercion, mirroring the auto-transform of the legacy QueryForm. */
const autoCoerce = (raw: unknown, defaultValue: unknown): unknown => {
  if (raw === ET_NULL_VALUE) return null;

  if (typeof raw !== 'string') return raw;

  const defaultIsNumber = typeof defaultValue === 'number';
  const looksNumeric = raw.trim() === raw && !raw.startsWith('0') && !raw.endsWith('.') && !isNaN(Number(raw));

  if (defaultIsNumber || (looksNumeric && raw !== '')) {
    return transformToNumber(raw);
  }

  if (raw === 'true' || raw === 'false') {
    return transformToBoolean(raw);
  }

  return raw;
};

const computeFilterCount = (fields: QueryFormFields, value: Dict, defaults: Dict) => {
  let count = 0;

  for (const [key, def] of Object.entries(fields)) {
    if (IGNORED_FILTER_COUNT_FIELDS.includes(key) || def.skipInFilterCount) continue;
    if (!equal(value[key], defaults[key])) count++;
  }

  return count;
};

/**
 * A detached editor over the same fields - its own signal-forms form and value,
 * with no URL sync and no reset graph. Written back to the source form via
 * `source.setValue(branch.value())`. Powers the filter-overlay "edit then apply"
 * pattern (see `10-filter.md`).
 */
export type QueryFormBranch<TFields extends QueryFormFields> = {
  /** The bindable signal-forms field tree (`branch.fields.search`). */
  readonly fields: FieldTree<QueryFormModel<TFields>>;
  /** The live (undebounced) value of the branch. */
  readonly value: Signal<QueryFormModel<TFields>>;
  /** The number of active (non-default) filters in the branch. */
  readonly activeFilterCount: Signal<number>;
  setValue(value: QueryFormModel<TFields>): void;
  patchValue(value: Partial<QueryFormModel<TFields>>): void;
  resetFieldToDefault(key: keyof QueryFormModel<TFields>): void;
  resetAllFieldsToDefault(): void;
};

const createBranch = <TFields extends QueryFormFields>(
  fields: TFields,
  initial: QueryFormModel<TFields>,
  injector: Injector,
): QueryFormBranch<TFields> => {
  const defaults = buildDefaults(fields);
  const model = signal<QueryFormModel<TFields>>(clone(initial));
  const tree = form(model, { injector });

  return {
    fields: tree,
    value: model.asReadonly(),
    activeFilterCount: computed(() => computeFilterCount(fields, model() as Dict, defaults)),
    setValue: (value) => model.set(clone(value)),
    patchValue: (value) => model.update((cur) => ({ ...cur, ...value })),
    resetFieldToDefault: (key) => model.update((cur) => ({ ...cur, [key]: defaults[key as string] })),
    resetAllFieldsToDefault: () => model.set(clone(defaults) as QueryFormModel<TFields>),
  };
};

export type CreateQueryFormConfig<TFields extends QueryFormFields> = {
  readonly fields: TFields;

  /**
   * A prefix for every query-param key, so multiple query forms can coexist on
   * one route (e.g. prefix `'users'` maps the `page` field to `users-page`).
   * A function is evaluated every time a key is built.
   */
  readonly queryParamPrefix?: string | (() => string);
};

/**
 * A signals-first query form: binds on-screen controls to typed fields, keeps a
 * debounced committed value, syncs to the URL query params, and resets dependent
 * fields via the `isResetBy` graph - all as signals.
 *
 * @example
 * const qf = createQueryForm({
 *   fields: {
 *     search: searchQueryField(),
 *     sort: sortQueryField(),
 *     page: queryField<number>({ defaultValue: 1, isResetBy: ['search', 'sort'] }),
 *   },
 * }).observe();
 * // template: <input etInput [formField]="qf.fields.search" />
 */
export class QueryFormSignals<TFields extends QueryFormFields> {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private injector = inject(Injector);
  private readonly queryParamChanges = injectQueryParamChanges();

  private readonly _fields: TFields;
  private readonly prefix: string | (() => string) | undefined;
  private readonly defaults: Dict;

  /** Live field values (updated immediately by bound controls). */
  private readonly model: ReturnType<typeof signal<QueryFormModel<TFields>>>;

  /** The committed (debounced) value that drives `value`, the URL and the filter count. */
  private readonly committed: ReturnType<typeof signal<QueryFormModel<TFields>>>;
  private previous = signal<QueryFormModel<TFields> | null>(null);

  private observing = signal(false);

  private observeOptions: QueryFormSignalsObserveOptions | undefined;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;
  private skipNextResets = false;

  /**
   * The bindable signal-forms field tree - bind a field with `[formField]`, e.g.
   * `<input etInput [formField]="qf.fields.search" />`.
   */
  public readonly fields: FieldTree<QueryFormModel<TFields>>;

  /** The committed value of the form. */
  public readonly value: Signal<QueryFormModel<TFields>>;

  /** The committed value before the most recent change. */
  public readonly previousValue: Signal<QueryFormModel<TFields> | null>;

  /** The previous/current value pair of the most recent committed change. */
  public readonly changes: Signal<QueryFormChange<TFields>>;

  /**
   * The number of active filters. Excludes the pagination/sort/search keys and
   * any field created with `skipInFilterCount`.
   */
  public readonly activeFilterCount: Signal<number>;

  /** The default value of the whole form. */
  public readonly defaultValue: QueryFormModel<TFields>;

  public constructor(config: CreateQueryFormConfig<TFields>) {
    assertInInjectionContext(QueryFormSignals);

    this._fields = config.fields;
    this.prefix = config.queryParamPrefix;
    this.defaults = buildDefaults(config.fields);
    this.defaultValue = clone(this.defaults) as QueryFormModel<TFields>;

    const initial = clone(this.defaults) as QueryFormModel<TFields>;
    this.model = signal(initial);
    this.committed = signal(clone(initial) as QueryFormModel<TFields>);
    this.fields = form(this.model);

    this.value = this.committed.asReadonly();
    this.previousValue = this.previous.asReadonly();
    this.changes = computed(() => ({ previousValue: this.previous(), currentValue: this.committed() }));
    this.activeFilterCount = computed(() => computeFilterCount(this._fields, this.committed() as Dict, this.defaults));

    // React to live control edits: schedule a debounced commit.
    effect(() => {
      const live = this.model();

      untracked(() => this.onLiveChange(live as Dict));
    });

    // React to navigation (back/forward, external links): apply URL → form immediately.
    effect(() => {
      const changes = this.queryParamChanges();

      untracked(() => {
        if (!this.observing() || this.observeOptions?.syncOnNavigation === false) return;

        this.applyFromUrl(changes as Dict);
      });
    });

    inject(DestroyRef).onDestroy(() => this.cleanup());
  }

  public observe(options?: QueryFormSignalsObserveOptions): this {
    if (this.observing()) {
      if (isDevMode()) {
        console.warn('QueryFormSignals.observe() was called more than once. Ignoring the extra call.');
      }

      return this;
    }

    this.observeOptions = options;
    this.observing.set(true);

    if (options?.syncOnNavigation !== false) {
      this.applyFromUrl(this.route.snapshot.queryParams as Dict);
    }

    // Commit whatever the model holds now (URL-restored or programmatic defaults).
    this.flush();

    return this;
  }

  public unobserve() {
    this.cleanup();
  }

  public setValue(value: QueryFormModel<TFields>, options?: QueryFormSignalsWriteOptions) {
    if (options?.skipResets) this.skipNextResets = true;

    this.model.set(clone(value));
  }

  public patchValue(value: Partial<QueryFormModel<TFields>>, options?: QueryFormSignalsWriteOptions) {
    if (options?.skipResets) this.skipNextResets = true;

    this.model.update((cur) => ({ ...cur, ...value }));
  }

  public resetFieldToDefault(key: keyof QueryFormModel<TFields>, options?: QueryFormSignalsWriteOptions) {
    if (options?.skipResets) this.skipNextResets = true;

    this.model.update((cur) => ({ ...cur, [key]: this.defaults[key as string] }));
  }

  public resetFieldsToDefault(keys: (keyof QueryFormModel<TFields>)[], options?: QueryFormSignalsWriteOptions) {
    if (options?.skipResets) this.skipNextResets = true;

    this.model.update((cur) => {
      const next = { ...cur } as Dict;

      for (const key of keys) {
        next[key as string] = this.defaults[key as string];
      }

      return next as QueryFormModel<TFields>;
    });
  }

  public resetAllFieldsToDefault(
    options?: QueryFormSignalsWriteOptions & { skipFields?: (keyof QueryFormModel<TFields>)[] },
  ) {
    const skip = new Set((options?.skipFields ?? []).map((key) => key as string));
    const keys = Object.keys(this._fields).filter((key) => !skip.has(key)) as (keyof QueryFormModel<TFields>)[];

    this.resetFieldsToDefault(keys, options);
  }

  /** Create a detached editor over the same fields, seeded from the current committed value. */
  public branch(): QueryFormBranch<TFields> {
    return createBranch(this._fields, clone(this.committed()), this.injector);
  }

  private onLiveChange(live: Dict) {
    if (!this.observing()) return;
    if (equal(live, this.committed())) return;

    const changedKeys = changedKeysBetween(this.committed() as Dict, live);
    const debounceMs = this.resolveDebounce(changedKeys, live);

    this.clearTimer();

    if (debounceMs === null) {
      this.flush();
    } else {
      this.pendingTimer = setTimeout(() => {
        this.pendingTimer = null;
        this.flush();
      }, debounceMs);
    }
  }

  /** Shortest-debounce-wins; `null` means commit immediately. */
  private resolveDebounce(changedKeys: string[], live: Dict): number | null {
    if (!changedKeys.length) return null;

    const times: number[] = [];

    for (const key of changedKeys) {
      const def = this._fields[key];

      if (!def) return null;
      if (def.disableDebounceIfFalsy && !live[key]) return null;
      if (def.debounce === undefined) return null;

      times.push(def.debounce);
    }

    return Math.min(...times);
  }

  private flush() {
    this.clearTimer();

    const live = this.model() as Dict;
    const previous = this.committed() as Dict;

    if (equal(live, previous)) {
      this.skipNextResets = false;

      return;
    }

    const changedKeys = changedKeysBetween(previous, live);
    const next = this.skipNextResets ? { ...live } : this.applyResets(live, changedKeys);

    this.skipNextResets = false;

    this.previous.set(clone(previous) as QueryFormModel<TFields>);
    this.committed.set(clone(next) as QueryFormModel<TFields>);

    // Reflect any reset overrides back into the bound controls. The effect re-runs
    // but no-ops because the model now equals the committed value.
    if (!equal(next, live)) {
      this.model.set(clone(next) as QueryFormModel<TFields>);
    }

    if (this.observing() && this.observeOptions?.writeToQueryParams !== false) {
      this.writeToUrl(next);
    }
  }

  private applyResets(live: Dict, changedKeys: string[]): Dict {
    const next = { ...live };

    for (const [key, def] of Object.entries(this._fields)) {
      const resets = def.isResetBy;

      if (!resets?.length) continue;

      const triggered = resets.some((resetKey) => {
        if (!(resetKey in this._fields)) {
          if (isDevMode()) {
            console.warn(`QueryFormSignals: isResetBy references unknown field "${resetKey}". Is it a typo?`);
          }

          return false;
        }

        return changedKeys.includes(resetKey);
      });

      if (!triggered) continue;

      const defaultValue = this.defaults[key];

      if (!equal(next[key], defaultValue)) {
        next[key] = defaultValue;
      }
    }

    return next;
  }

  private applyFromUrl(params: Dict) {
    const current = { ...(this.committed() as Dict) };
    let changed = false;

    for (const [key, def] of Object.entries(this._fields)) {
      const raw = params[this.paramKey(key)];

      if (raw === undefined) continue;

      const value = raw === ET_PROPERTY_REMOVED ? this.defaults[key] : this.deserialize(def, raw);

      if (!equal(current[key], value)) {
        current[key] = value;
        changed = true;
      }
    }

    if (!changed) return;

    this.commitFromUrl(current);
  }

  private commitFromUrl(next: Dict) {
    this.clearTimer();
    this.previous.set(clone(this.committed()) as QueryFormModel<TFields>);
    this.committed.set(clone(next) as QueryFormModel<TFields>);
    // Feed the URL value into the live model & bound controls; the effect no-ops (model === committed).
    this.model.set(clone(next) as QueryFormModel<TFields>);
  }

  private deserialize(def: QueryFieldDef<unknown>, raw: unknown): unknown {
    if (def.queryParamToValue) return def.queryParamToValue(raw);
    if (def.skipAutoTransform) return raw;

    return autoCoerce(raw, resolveDefault(def));
  }

  private writeToUrl(value: Dict) {
    const queryParams: Dict = {};

    for (const [key, def] of Object.entries(this._fields)) {
      const paramKey = this.paramKey(key);
      const fieldValue = value[key];

      const isDefault = equal(fieldValue, this.defaults[key]);
      const writeToUrl = def.appendToUrl !== false;
      const writeDefault = def.appendDefaultValueToUrl === true;

      if (!writeToUrl || (isDefault && !writeDefault)) {
        queryParams[paramKey] = undefined;
      } else if (def.valueToQueryParam) {
        queryParams[paramKey] = def.valueToQueryParam(fieldValue);
      } else {
        queryParams[paramKey] = fieldValue === null ? ET_NULL_VALUE : fieldValue;
      }
    }

    queueMicrotask(() => {
      this.router.navigate([], {
        queryParams,
        queryParamsHandling: 'merge',
        replaceUrl: this.observeOptions?.replaceUrl,
      });
    });
  }

  private paramKey(key: string) {
    const prefix = this.prefix;

    if (!prefix) return key;

    return `${typeof prefix === 'string' ? prefix : prefix()}-${key}`;
  }

  private clearTimer() {
    if (this.pendingTimer !== null) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
  }

  private cleanup() {
    if (!this.observing()) return;

    this.observing.set(false);
    this.clearTimer();

    if (this.observeOptions?.writeToQueryParams === false) return;

    const queryParams: Dict = {};

    for (const key of Object.keys(this._fields)) {
      queryParams[this.paramKey(key)] = undefined;
    }

    queueMicrotask(() => {
      this.router.navigate([], { queryParams, queryParamsHandling: 'merge', replaceUrl: true });
    });
  }
}

/**
 * Create a {@link QueryFormSignals}. Call `.observe()` to start syncing with the
 * URL. Must be called in an injection context.
 */
export const createQueryForm = <TFields extends QueryFormFields>(
  config: CreateQueryFormConfig<TFields>,
): QueryFormSignals<TFields> => new QueryFormSignals(config);
