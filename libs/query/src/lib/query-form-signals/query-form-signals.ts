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
import { ActivatedRoute, NavigationExtras, Router, UrlTree } from '@angular/router';
import { ET_PROPERTY_REMOVED, clone, equal, injectQueryParamChanges } from '@ethlete/core';
import { QueryDevtoolsFormField, QueryDevtoolsFormHandle } from '../devtools/query-devtools-form';
import { noteQueryFormReads } from '../devtools/query-devtools-form-links';
import { isQueryDevtoolsEnabled, registerQueryDevtoolsEntry } from '../devtools/query-devtools-hook';
import { transformToBoolean, transformToNumber } from '../query-form/query-form.utils';
import {
  QueryFieldDef,
  QueryFormChange,
  QueryFormFields,
  QueryFormModel,
  QueryFormPersistence,
  QueryFormSignalsObserveOptions,
  QueryFormStorage,
  QueryFormSignalsWriteOptions,
} from './query-form-signals.types';

/** URL sentinel for an explicit `null` value (a bare empty param would be ambiguous). */
const ET_NULL_VALUE = 'ET_NULL__';

/** URL sentinel for an empty list, which the router would otherwise drop from the URL. */
const ET_EMPTY_ARRAY_VALUE = 'ET_EMPTY_ARRAY__';

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

const MAX_RESET_PASSES = 10;

const changedKeysBetween = (previous: Dict | null, current: Dict): string[] =>
  Object.keys(current).filter((key) => !equal(previous?.[key], current[key]));

/** Best-effort URL string → value coercion, mirroring the auto-transform of the legacy QueryForm. */
const autoCoerce = (raw: unknown, defaultValue: unknown): unknown => {
  if (typeof raw !== 'string') return raw;

  if (Array.isArray(defaultValue)) return [raw];

  const defaultIsNumber = typeof defaultValue === 'number';
  const looksNumeric = raw.trim() === raw && !/^-?0\d/.test(raw) && !raw.endsWith('.') && !isNaN(Number(raw));

  if (defaultIsNumber || (looksNumeric && raw !== '')) {
    return transformToNumber(raw);
  }

  if (raw === 'true' || raw === 'false') {
    return transformToBoolean(raw);
  }

  return raw;
};

/** Shortest-debounce-wins; `null` means commit immediately. */
const resolveDebounce = (fieldDefs: QueryFormFields, changedKeys: string[], live: Dict): number | null => {
  if (!changedKeys.length) return null;

  const times: number[] = [];

  for (const key of changedKeys) {
    const def = fieldDefs[key];

    if (!def) return null;
    if (def.disableDebounceIfFalsy && !live[key]) return null;
    if (def.debounce === undefined) return null;

    times.push(def.debounce);
  }

  return Math.min(...times);
};

/**
 * A value that cannot be told apart from the default once serialized - a cleared text (`''`), an emptied list
 * (`[]`) or one whose `valueToQueryParam` yields nothing - commits as the default, so the URL reproduces the
 * committed state and the filter count does not report it.
 */
const normalizeLive = (fieldDefs: QueryFormFields, rawLive: Dict, defaults: Dict): Dict => {
  const live = { ...rawLive };

  for (const [key, def] of Object.entries(fieldDefs)) {
    const value = live[key];

    if (equal(value, defaults[key])) continue;

    const serialized = def.valueToQueryParam?.(value);
    const serializedToNothing = !!def.valueToQueryParam && (serialized === null || serialized === undefined);
    const clearedNullable = defaults[key] === null && (value === '' || (Array.isArray(value) && value.length === 0));

    if (serializedToNothing || clearedNullable) {
      live[key] = defaults[key];
    }
  }

  return live;
};

const resolveStorage = (storage: QueryFormPersistence['storage']): QueryFormStorage | null => {
  if (typeof storage !== 'string') return storage;

  try {
    if (typeof globalThis.window === 'undefined') return null;

    return (storage === 'session' ? globalThis.sessionStorage : globalThis.localStorage) ?? null;
  } catch {
    return null;
  }
};

const readStoredParams = (persistence: QueryFormPersistence): Dict | null => {
  try {
    const raw = resolveStorage(persistence.storage)?.getItem(persistence.key);
    const parsed: unknown = raw ? JSON.parse(raw) : null;

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Dict) : null;
  } catch {
    return null;
  }
};

const writeStoredParams = (persistence: QueryFormPersistence, params: Dict) => {
  try {
    resolveStorage(persistence.storage)?.setItem(persistence.key, JSON.stringify(params));
  } catch {
    return;
  }
};

const computeFilterCount = (fields: QueryFormFields, value: Dict, defaults: Dict) => {
  let count = 0;

  for (const [key, def] of Object.entries(fields)) {
    if (IGNORED_FILTER_COUNT_FIELDS.includes(key) || def.skipInFilterCount) continue;
    if (!equal(value[key], defaults[key])) count++;
  }

  return count;
};

const applyResets = (
  fieldDefs: QueryFormFields,
  live: Dict,
  changedKeys: string[],
  explicitKeys: ReadonlySet<string>,
  resetDefaults: Map<string, unknown>,
  defaultFor: (key: string) => unknown,
): Dict => {
  const next = { ...live };

  for (const [key, def] of Object.entries(fieldDefs)) {
    const resets = def.isResetBy;

    if (!resets?.length || explicitKeys.has(key)) continue;

    const triggered = resets.some((resetKey) => {
      if (!(resetKey in fieldDefs)) {
        if (isDevMode()) {
          console.warn(`defineQueryForm: isResetBy references unknown field "${resetKey}". Is it a typo?`);
        }

        return false;
      }

      return changedKeys.includes(resetKey);
    });

    if (!triggered) continue;

    let fieldDefault = resetDefaults.get(key);

    if (!resetDefaults.has(key)) {
      fieldDefault = defaultFor(key);
      resetDefaults.set(key, fieldDefault);
    }

    if (!equal(next[key], fieldDefault)) {
      next[key] = fieldDefault;
    }
  }

  return next;
};

/**
 * Resets are transitive: a field this pass reset counts as changed in the next one, so
 * `country → league → team` clears `team` as well when only `country` moved. Passes repeat until
 * nothing moves, which has to happen before the value commits - one query execution for the
 * whole chain, not one per hop. Each pass clears one hop, and a field already at its default stops
 * triggering, so a cycle converges instead of reaching the cap - only a chain deeper than
 * `MAX_RESET_PASSES` hops does, and it commits with the fields below that hop left untouched.
 * A key the commit itself changed (`explicitKeys`) is never reset, in any pass, and so is a key
 * `protectedKeys` names - the fields a caller asked to skip. A key in `silentKeys` - written with
 * `skipResets` - never triggers a reset.
 */
const resolveResets = (
  fieldDefs: QueryFormFields,
  prev: Dict,
  live: Dict,
  defaultFor: (key: string) => unknown,
  protectedKeys?: ReadonlySet<string>,
  silentKeys?: ReadonlySet<string>,
): Dict => {
  const explicitKeys = new Set([...changedKeysBetween(prev, live), ...(protectedKeys ?? [])]);
  const resetDefaults = new Map<string, unknown>();
  let next = live;

  for (let pass = 0; pass < MAX_RESET_PASSES; pass++) {
    const applied = applyResets(
      fieldDefs,
      next,
      changedKeysBetween(prev, next).filter((key) => !silentKeys?.has(key)),
      explicitKeys,
      resetDefaults,
      defaultFor,
    );

    if (equal(applied, next)) return applied;

    next = applied;
  }

  if (isDevMode()) {
    console.warn(`defineQueryForm: isResetBy did not settle within ${MAX_RESET_PASSES} passes. Check for a cycle.`);
  }

  return next;
};

/**
 * A detached editor over the same fields - its own signal-forms form and value,
 * with no URL sync but the same debounce and `isResetBy` graph. Written back to
 * the source form via `source.setValue(branch.liveValue())`. Powers the
 * filter-overlay "edit then apply" pattern.
 */
export type QueryFormBranch<TFields extends QueryFormFields> = {
  /** The bindable signal-forms field tree (`branch.fields.search`). */
  readonly fields: FieldTree<QueryFormModel<TFields>>;
  /** The committed value of the branch - debounced and reset-resolved like the source form's `value`. */
  readonly value: Signal<QueryFormModel<TFields>>;
  /** What the bound controls hold right now, ahead of any pending debounce. Apply this on an explicit submit. */
  readonly liveValue: Signal<QueryFormModel<TFields>>;
  /** The number of active (non-default) filters in the branch. */
  readonly activeFilterCount: Signal<number>;
  setValue(value: QueryFormModel<TFields>, options?: QueryFormBranchWriteOptions): void;
  patchValue(value: Partial<QueryFormModel<TFields>>, options?: QueryFormBranchWriteOptions): void;
  resetFieldToDefault(key: keyof QueryFormModel<TFields>, options?: QueryFormBranchWriteOptions): void;
  resetAllFieldsToDefault(options?: QueryFormBranchWriteOptions): void;
};

/** Options for a write to a {@link QueryFormBranch}. */
export type QueryFormBranchWriteOptions = Pick<QueryFormSignalsWriteOptions, 'debounce'>;

const createBranch = <TFields extends QueryFormFields>(
  fields: TFields,
  initial: QueryFormModel<TFields>,
  injector: Injector,
): QueryFormBranch<TFields> => {
  const defaults = buildDefaults(fields);
  const model = signal<QueryFormModel<TFields>>(clone(initial));
  const committed = signal<QueryFormModel<TFields>>(clone(initial));
  const tree = form(model, { injector });
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;

  const defaultFor = (key: string) => {
    const value = resolveDefault(fields[key] as QueryFieldDef<unknown>);

    defaults[key] = value;

    return value;
  };

  const normalizedLive = computed(() => normalizeLive(fields, model() as Dict, defaults) as QueryFormModel<TFields>);

  const clearTimer = () => {
    if (pendingTimer !== null) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
  };

  const flush = () => {
    clearTimer();

    const live = normalizedLive() as Dict;
    const prev = committed() as Dict;

    if (equal(live, prev)) return;

    const next = resolveResets(fields, prev, live, defaultFor);

    committed.set(clone(next) as QueryFormModel<TFields>);

    if (!equal(next, model())) {
      model.set(clone(next) as QueryFormModel<TFields>);
    }
  };

  const write = (next: QueryFormModel<TFields>, options?: QueryFormBranchWriteOptions) => {
    model.set(next);

    if (!options?.debounce) flush();
  };

  effect(
    () => {
      const live = normalizedLive() as Dict;

      untracked(() => {
        const prev = committed() as Dict;

        if (equal(live, prev)) return;

        const debounceMs = resolveDebounce(fields, changedKeysBetween(prev, live), live);

        clearTimer();

        if (debounceMs === null) {
          flush();
        } else {
          pendingTimer = setTimeout(flush, debounceMs);
        }
      });
    },
    { injector },
  );

  injector.get(DestroyRef).onDestroy(clearTimer);

  return {
    fields: tree,
    value: committed.asReadonly(),
    liveValue: model.asReadonly(),
    activeFilterCount: computed(() => computeFilterCount(fields, committed() as Dict, defaults)),
    setValue: (value, options) => write(clone(value), options),
    patchValue: (value, options) => write({ ...model(), ...value }, options),
    resetFieldToDefault: (key, options) => write({ ...model(), [key]: defaultFor(key as string) }, options),
    resetAllFieldsToDefault: (options) => {
      for (const key of Object.keys(fields)) defaultFor(key);

      write(clone(defaults) as QueryFormModel<TFields>, options);
    },
  };
};

export type DefineQueryFormConfig<TFields extends QueryFormFields> = {
  readonly fields: TFields;

  /**
   * A prefix for every query-param key, so multiple query forms can coexist on
   * one route (e.g. prefix `'users'` maps the `page` field to `users-page`).
   * A function is evaluated every time a key is built.
   */
  readonly queryParamPrefix?: string | (() => string);

  /**
   * What the form is called in the devtools Forms tab. Defaults to the
   * `queryParamPrefix` where it is a plain string, and to `form` otherwise.
   * Ignored unless `provideQueryDevtools()` is installed.
   */
  readonly name?: string;
};

/**
 * A signals-first query form: binds on-screen controls to typed fields, keeps a
 * debounced committed value, syncs to the URL query params, and resets dependent
 * fields via the `isResetBy` graph - all as signals.
 *
 * Created with {@link defineQueryForm}.
 */
export type QueryFormSignals<TFields extends QueryFormFields> = {
  /**
   * The bindable signal-forms field tree - bind a field with `[formField]`, e.g.
   * `<input etInput [formField]="qf.fields.search" />`.
   */
  readonly fields: FieldTree<QueryFormModel<TFields>>;

  /** The committed value of the form. */
  readonly value: Signal<QueryFormModel<TFields>>;

  /** The committed value before the most recent change. */
  readonly previousValue: Signal<QueryFormModel<TFields> | null>;

  /** The previous/current value pair of the most recent committed change. */
  readonly changes: Signal<QueryFormChange<TFields>>;

  /**
   * The number of active filters. Excludes the pagination/sort/search keys and
   * any field created with `skipInFilterCount`.
   */
  readonly activeFilterCount: Signal<number>;

  /** The default value of the whole form. */
  readonly defaultValue: QueryFormModel<TFields>;

  /** Start syncing with the URL. Returns the form, so it can be chained onto the definition. */
  observe(options?: QueryFormSignalsObserveOptions): QueryFormSignals<TFields>;

  /**
   * Stop syncing and strip the form's params from the URL. A pending debounced edit is committed to `value`
   * but not written to the URL. Only an explicit call strips the params - the
   * form stops syncing when it is destroyed, but leaves the URL alone, because the route it lands on
   * owns the params by then.
   */
  unobserve(): void;

  setValue(value: QueryFormModel<TFields>, options?: QueryFormSignalsWriteOptions): void;
  patchValue(value: Partial<QueryFormModel<TFields>>, options?: QueryFormSignalsWriteOptions): void;
  resetFieldToDefault(key: keyof QueryFormModel<TFields>, options?: QueryFormSignalsWriteOptions): void;
  resetFieldsToDefault(keys: (keyof QueryFormModel<TFields>)[], options?: QueryFormSignalsWriteOptions): void;
  resetAllFieldsToDefault(
    options?: QueryFormSignalsWriteOptions & { skipFields?: (keyof QueryFormModel<TFields>)[] },
  ): void;

  /** Create a detached editor over the same fields, seeded from the current committed value. */
  branch(injector?: Injector): QueryFormBranch<TFields>;
};

/**
 * Per-name sequence behind the devtools id of a form, mirroring the registry's own scheme so the
 * panel can restore the selected form after a reload.
 */
const devtoolsIdCounters = /* @__PURE__ */ new Map<string, number>();

const nextQueryFormDevtoolsId = (name: string) => {
  const seq = devtoolsIdCounters.get(name) ?? 0;

  devtoolsIdCounters.set(name, seq + 1);

  return `query-form|${name}#${seq}`;
};

/**
 * Define a {@link QueryFormSignals}. Call `.observe()` to start syncing with the
 * URL. Must be called in an injection context.
 *
 * @example
 * const qf = defineQueryForm({
 *   fields: {
 *     search: searchQueryField(),
 *     sort: sortQueryField(),
 *     page: queryField<number>({ defaultValue: 1, isResetBy: ['search', 'sort'] }),
 *   },
 * }).observe();
 * // template: <input etInput [formField]="qf.fields.search" />
 */
export const defineQueryForm = <TFields extends QueryFormFields>(
  config: DefineQueryFormConfig<TFields>,
): QueryFormSignals<TFields> => {
  assertInInjectionContext(defineQueryForm);

  const router = inject(Router);
  const route = inject(ActivatedRoute);
  const injector = inject(Injector);
  const destroyRef = inject(DestroyRef);
  const queryParamChanges = injectQueryParamChanges();

  const fieldDefs = config.fields;
  const prefix = config.queryParamPrefix;
  const defaults = buildDefaults(fieldDefs);
  const defaultValue = clone(defaults) as QueryFormModel<TFields>;
  const defaultFor = (key: string) => {
    const value = resolveDefault(fieldDefs[key] as QueryFieldDef<unknown>);

    defaults[key] = value;
    (defaultValue as Dict)[key] = clone(value);

    return value;
  };

  /** Live field values (updated immediately by bound controls). */
  const model = signal(clone(defaults) as QueryFormModel<TFields>);

  /** The committed (debounced) value that drives `value`, the URL and the filter count. */
  const committed = signal(clone(defaults) as QueryFormModel<TFields>);
  const previous = signal<QueryFormModel<TFields> | null>(null);

  const observing = signal(false);
  const commitPending = signal(false);

  let observeOptions: QueryFormSignalsObserveOptions | undefined;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;
  const skipResetsFor = new Set<string>();
  let skipNextResetsFor: ReadonlySet<string> | undefined;
  let urlWriteVersion = 0;
  let changesSeenAtObserve: unknown;
  const urlNavigationMarker = {};
  const pathOf = (tree: UrlTree) => router.serializeUrl(tree).split(/[?#]/)[0];

  const fields = form(model);

  const activeFilterCount = computed(() => computeFilterCount(fieldDefs, committed() as Dict, defaults));

  const paramKey = (key: string) => {
    if (!prefix) return key;

    return `${typeof prefix === 'string' ? prefix : prefix()}-${key}`;
  };

  /** What a field puts in the URL for a given value, or `undefined` when it writes nothing. */
  const queryParamFor = (key: string, def: QueryFieldDef<unknown>, value: unknown) => {
    const isDefault = equal(value, defaults[key]);
    const writeToUrl = def.appendToUrl !== false;
    const writeDefault = def.appendDefaultValueToUrl === true;

    if (!writeToUrl || (isDefault && !writeDefault)) return undefined;

    return serialize(key, def, value);
  };

  const serialize = (key: string, def: QueryFieldDef<unknown>, value: unknown) => {
    if (def.valueToQueryParam) return def.valueToQueryParam(value);
    if (value === '' && defaults[key] === null) return undefined;
    if (Array.isArray(value) && value.length === 0) return ET_EMPTY_ARRAY_VALUE;

    return value === null ? ET_NULL_VALUE : value;
  };

  const persistedKeys = () => {
    const keys = observeOptions?.persistence?.fields ?? Object.keys(fieldDefs);

    return keys.filter((key) => key in fieldDefs);
  };

  const persist = () => {
    const persistence = observeOptions?.persistence;

    if (!persistence || !observing()) return;

    const value = committed() as Dict;
    const stored: Dict = {};

    for (const key of persistedKeys()) {
      if (equal(value[key], defaults[key])) continue;

      stored[key] = serialize(key, fieldDefs[key] as QueryFieldDef<unknown>, value[key]);
    }

    writeStoredParams(persistence, stored);
  };

  const restoreFromStorage = (persistence: QueryFormPersistence, urlParams: Dict) => {
    const keys = persistedKeys();

    if (keys.some((key) => urlParams[paramKey(key)] !== undefined)) return;

    const stored = readStoredParams(persistence);

    if (!stored) return;

    const params: Dict = {};

    for (const key of keys) {
      if (stored[key] !== undefined) params[paramKey(key)] = stored[key];
    }

    applyFromUrl(params, { base: model() as Dict });
  };

  const deserialize = (def: QueryFieldDef<unknown>, raw: unknown): unknown => {
    if (!def.skipAutoTransform && raw === ET_NULL_VALUE) return null;
    if (!def.skipAutoTransform && raw === ET_EMPTY_ARRAY_VALUE) return [];
    if (def.queryParamToValue) return def.queryParamToValue(raw);
    if (def.skipAutoTransform) return raw;

    return autoCoerce(raw, resolveDefault(def));
  };

  const clearTimer = () => {
    if (pendingTimer !== null) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }

    commitPending.set(false);
  };

  /**
   * Merged onto the navigation still in flight, not onto the committed URL: the router supersedes an unfinished
   * navigation with the next one, so a second form (or a second commit) writing in the same tick would otherwise
   * drop the first one's params.
   */
  const navigateWithParams = (params: Dict, extras: Pick<NavigationExtras, 'replaceUrl' | 'info'>) => {
    queueMicrotask(() => {
      const pending = router.getCurrentNavigation();
      const base = pending?.finalUrl ?? pending?.extractedUrl ?? router.parseUrl(router.url);

      // Writing onto a navigation that lands on another route would supersede it: the user's navigation
      // resolves `false` and that route's own same-named params (`page`, `search`) are lost.
      if (pathOf(base) !== pathOf(router.parseUrl(router.url))) return;

      const queryParams: Dict = { ...base.queryParams, ...params };

      for (const key of Object.keys(queryParams)) {
        if (queryParams[key] === undefined) delete queryParams[key];
      }

      router.navigate([], {
        queryParams,
        queryParamsHandling: 'replace',
        fragment: base.fragment ?? undefined,
        ...extras,
      });
    });
  };

  const writeToUrl = (value: Dict) => {
    const queryParams: Dict = {};
    const version = ++urlWriteVersion;

    for (const [key, def] of Object.entries(fieldDefs)) {
      // Not `undefined`: `navigateWithParams` deletes an undefined key, which would strip a param of
      // that name the form never owned.
      if (def.appendToUrl === false) continue;

      queryParams[paramKey(key)] = queryParamFor(key, def, value[key]);
    }

    navigateWithParams(queryParams, {
      replaceUrl: observeOptions?.replaceUrl,
      info: { queryForm: urlNavigationMarker, version },
    });
  };

  const flush = () => {
    clearTimer();

    const rawLive = model() as Dict;
    const live = normalizeLive(fieldDefs, rawLive, defaults);
    const prev = committed() as Dict;

    if (equal(live, prev)) {
      skipResetsFor.clear();
      skipNextResetsFor = undefined;

      if (!equal(live, rawLive)) {
        model.set(clone(live) as QueryFormModel<TFields>);
      }

      return;
    }

    const next = resolveResets(fieldDefs, prev, live, defaultFor, skipNextResetsFor, skipResetsFor);

    skipResetsFor.clear();
    skipNextResetsFor = undefined;

    previous.set(clone(prev) as QueryFormModel<TFields>);
    committed.set(clone(next) as QueryFormModel<TFields>);

    // Reflect any reset overrides back into the bound controls. The effect re-runs
    // but no-ops because the model now equals the committed value.
    if (!equal(next, rawLive)) {
      model.set(clone(next) as QueryFormModel<TFields>);
    }

    if (observing() && observeOptions?.writeToQueryParams !== false) {
      writeToUrl(next);
    }

    persist();
  };

  const onLiveChange = (live: Dict) => {
    if (equal(live, committed())) {
      skipResetsFor.clear();
      skipNextResetsFor = undefined;

      return;
    }

    const changedKeys = changedKeysBetween(committed() as Dict, live);
    const debounceMs = resolveDebounce(fieldDefs, changedKeys, live);

    clearTimer();

    if (debounceMs === null) {
      flush();
    } else {
      commitPending.set(true);
      pendingTimer = setTimeout(() => {
        pendingTimer = null;
        flush();
      }, debounceMs);
    }
  };

  const commitFromUrl = (parsed: Dict) => {
    const next = normalizeLive(fieldDefs, parsed, defaults);

    clearTimer();
    skipResetsFor.clear();
    skipNextResetsFor = undefined;
    previous.set(clone(committed()) as QueryFormModel<TFields>);
    committed.set(clone(next) as QueryFormModel<TFields>);
    // Feed the URL value into the live model & bound controls; the effect no-ops (model === committed).
    model.set(clone(next) as QueryFormModel<TFields>);
    persist();
  };

  const applyFromUrl = (params: Dict, options?: { base?: Dict; onlyFieldsTheFormNeverWrites?: boolean }) => {
    const current = { ...(options?.base ?? (committed() as Dict)) };
    let changed = false;

    for (const [key, def] of Object.entries(fieldDefs)) {
      if (options?.onlyFieldsTheFormNeverWrites && def.appendToUrl !== false) continue;

      const raw = params[paramKey(key)];

      if (raw === undefined) continue;

      const value = raw === ET_PROPERTY_REMOVED ? defaults[key] : deserialize(def, raw);

      if (!equal(current[key], value)) {
        current[key] = value;
        changed = true;
      }
    }

    if (!changed) return;

    commitFromUrl(current);
  };

  const cleanup = (removeQueryParams = true) => {
    clearTimer();

    if (!observing()) return;

    observing.set(false);

    if (!removeQueryParams || observeOptions?.writeToQueryParams === false) return;

    const queryParams: Dict = {};

    for (const [key, def] of Object.entries(fieldDefs)) {
      if (def.appendToUrl === false) continue;

      queryParams[paramKey(key)] = undefined;
    }

    navigateWithParams(queryParams, { replaceUrl: true });
  };

  const writeModel = (next: Dict, options?: QueryFormSignalsWriteOptions) => {
    for (const key of changedKeysBetween(model() as Dict, next)) {
      if (options?.skipResets) {
        skipResetsFor.add(key);
      } else {
        skipResetsFor.delete(key);
      }
    }

    model.set(next as QueryFormModel<TFields>);

    if (options?.debounce) {
      onLiveChange(next);
    } else {
      flush();
    }
  };

  const setValue = (value: QueryFormModel<TFields>, options?: QueryFormSignalsWriteOptions) =>
    writeModel(clone(value) as Dict, options);

  const patchValue = (value: Partial<QueryFormModel<TFields>>, options?: QueryFormSignalsWriteOptions) =>
    writeModel({ ...(model() as Dict), ...value }, options);

  const resetFieldsToDefault = (keys: (keyof QueryFormModel<TFields>)[], options?: QueryFormSignalsWriteOptions) => {
    const next = { ...(model() as Dict) };

    for (const key of keys) {
      next[key as string] = defaultFor(key as string);
    }

    writeModel(next, options);
  };

  const devtoolsName = config.name ?? (typeof prefix === 'string' ? prefix : 'form');
  const devtoolsId = isQueryDevtoolsEnabled() ? nextQueryFormDevtoolsId(devtoolsName) : null;

  const queryForm: QueryFormSignals<TFields> = {
    fields,

    // Reading `value` is how a query's args pick the form up, so the devtools learn which query a form
    // drives by noting the read - see `QueryDevtoolsFormLinksHandle`.
    value: devtoolsId ? noteQueryFormReads(devtoolsId, committed) : committed.asReadonly(),

    previousValue: previous.asReadonly(),
    changes: computed(() => ({ previousValue: previous(), currentValue: committed() })),
    activeFilterCount,
    defaultValue,

    observe: (options) => {
      if (observing()) {
        if (isDevMode()) {
          console.warn('defineQueryForm: observe() was called more than once. Ignoring the extra call.');
        }

        return queryForm;
      }

      observeOptions = options;
      observing.set(true);
      changesSeenAtObserve = untracked(queryParamChanges);

      if (options?.persistence) {
        restoreFromStorage(options.persistence, route.snapshot.queryParams as Dict);
      }

      if (options?.syncOnNavigation !== false) {
        // A value written before `observe()` sits in the model only, so the URL merges onto the model
        // here. Against `committed()` any single URL param would drop that value.
        applyFromUrl(route.snapshot.queryParams as Dict, { base: model() as Dict });
      }

      // Commit whatever the model holds now (URL-restored or programmatic defaults).
      flush();

      // `flush()` writes the URL only when it commits a change, and a value written before
      // `observe()` is committed already - so this is the only write that can put it in the URL.
      // Nothing to put there means no write: an empty one merges onto a navigation in flight and
      // deletes that route's own params.
      const writesAnyParam = Object.entries(fieldDefs).some(
        ([key, def]) => queryParamFor(key, def, (committed() as Dict)[key]) !== undefined,
      );

      if (options?.writeToQueryParams !== false && writesAnyParam) {
        writeToUrl(committed() as Dict);
      }

      persist();

      return queryForm;
    },

    unobserve: () => {
      const hasPendingCommit = pendingTimer !== null;

      cleanup();

      if (hasPendingCommit) flush();
    },

    setValue,
    patchValue,
    resetFieldToDefault: (key, options) => resetFieldsToDefault([key], options),
    resetFieldsToDefault,

    resetAllFieldsToDefault: (options) => {
      const skip = new Set((options?.skipFields ?? []).map((key) => key as string));
      const keys = Object.keys(fieldDefs).filter((key) => !skip.has(key)) as (keyof QueryFormModel<TFields>)[];

      if (skip.size) skipNextResetsFor = skip;

      resetFieldsToDefault(keys, options);
    },

    branch: (branchInjector = injector) => createBranch(fieldDefs, clone(committed()), branchInjector),
  };

  // React to live control edits: schedule a debounced commit.
  effect(() => {
    const live = model();

    untracked(() => onLiveChange(live as Dict));
  });

  // React to navigation (back/forward, external links): apply URL → form immediately.
  effect(() => {
    const changes = queryParamChanges();

    untracked(() => {
      if (!observing() || observeOptions?.syncOnNavigation === false) return;

      // The changes are shared app-wide, so the diff present at `observe()` describes a navigation this
      // form never saw - applying its removals would wipe a restored or seeded value.
      if (changes === changesSeenAtObserve) return;

      const info = router.lastSuccessfulNavigation()?.extras.info as
        { queryForm?: object; version?: number } | undefined;
      // Including the newest write: re-parsing the form's own output would coerce a committed
      // string back to a number and drop the milliseconds of a committed Date.
      if (info?.queryForm === urlNavigationMarker && (info.version ?? 0) <= urlWriteVersion) {
        // A field with `appendToUrl: false` mirrors a param another owner writes, and the commit
        // merges onto the navigation in flight - so this is the only place a foreign write to that
        // param can still reach the form.
        applyFromUrl(changes as Dict, { onlyFieldsTheFormNeverWrites: true });

        return;
      }

      applyFromUrl(changes as Dict);
    });
  });

  destroyRef.onDestroy(() => cleanup(false));

  if (devtoolsId) {
    /**
     * The live view `<et-query-devtools>` renders. Only built while the devtools are installed - it walks
     * every field on every change, which an app without them should not pay for.
     */
    const handle: QueryDevtoolsFormHandle = {
      fields: computed(() => {
        const committedValue = committed() as Dict;
        const live = model() as Dict;

        return Object.entries(fieldDefs).map(([key, def]): QueryDevtoolsFormField => {
          const value = committedValue[key];

          return {
            key,
            paramKey: paramKey(key),
            value,
            liveValue: live[key],
            defaultValue: defaults[key],
            isDefault: equal(value, defaults[key]),
            queryParam: queryParamFor(key, def, value),
            debounceMs: def.debounce ?? null,
            isResetBy: def.isResetBy ?? [],
            countsAsFilter: !IGNORED_FILTER_COUNT_FIELDS.includes(key) && !def.skipInFilterCount,
          };
        });
      }),
      // Not `queryForm.value` - reading that from the panel would link the form to whichever query happens
      // to be building its args at the time.
      value: computed(() => committed() as Dict),
      previousValue: computed(() => (previous() as Dict | null) ?? null),
      defaultValue: defaults,
      activeFilterCount,
      isAtDefaults: computed(() => equal(committed(), defaults)),
      isCommitPending: commitPending.asReadonly(),
      isObserving: observing.asReadonly(),
      resetField: (key) => queryForm.resetFieldToDefault(key as keyof QueryFormModel<TFields>),
      resetAll: () => queryForm.resetAllFieldsToDefault(),
    };

    destroyRef.onDestroy(
      registerQueryDevtoolsEntry({
        id: devtoolsId,
        kind: 'query-form',
        handle,
        meta: { name: devtoolsName },
      }),
    );
  }

  return queryForm;
};
