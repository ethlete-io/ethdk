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
import { QueryDevtoolsFormField, QueryDevtoolsFormHandle } from '../devtools/query-devtools-form';
import { isQueryDevtoolsEnabled, noteQueryFormRead, registerQueryDevtoolsEntry } from '../devtools/query-devtools-hook';
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

const MAX_RESET_PASSES = 10;

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
 * whole chain, not one per hop. The cap only guards a cyclic `isResetBy` graph; a field already at
 * its default stops triggering, so a well-formed graph settles in as many passes as it is deep.
 * A key the commit itself changed (`explicitKeys`) is never reset, in any pass.
 */
const resolveResets = (
  fieldDefs: QueryFormFields,
  prev: Dict,
  live: Dict,
  defaultFor: (key: string) => unknown,
): Dict => {
  const explicitKeys = new Set(changedKeysBetween(prev, live));
  const resetDefaults = new Map<string, unknown>();
  let next = live;

  for (let pass = 0; pass < MAX_RESET_PASSES; pass++) {
    const applied = applyResets(
      fieldDefs,
      next,
      changedKeysBetween(prev, next),
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
 * with no URL sync but the same `isResetBy` graph. Written back to the source
 * form via `source.setValue(branch.value())`. Powers the filter-overlay
 * "edit then apply" pattern (see `10-filter.md`).
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
  const defaultFor = (key: string) => {
    const value = resolveDefault(fields[key] as QueryFieldDef<unknown>);

    defaults[key] = value;

    return value;
  };

  const commit = (next: Dict) =>
    model.set(clone(resolveResets(fields, model() as Dict, next, defaultFor)) as QueryFormModel<TFields>);

  return {
    fields: tree,
    value: model.asReadonly(),
    activeFilterCount: computed(() => computeFilterCount(fields, model() as Dict, defaults)),
    setValue: (value) => commit(value as Dict),
    patchValue: (value) => commit({ ...(model() as Dict), ...value }),
    resetFieldToDefault: (key) => commit({ ...(model() as Dict), [key]: defaultFor(key as string) }),
    resetAllFieldsToDefault: () => {
      for (const key of Object.keys(fields)) defaultFor(key);

      model.set(clone(defaults) as QueryFormModel<TFields>);
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

  /** Stop syncing and strip the form's params from the URL. Runs on destroy anyway. */
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
  let skipNextResets = false;
  let urlWriteVersion = 0;
  const urlNavigationMarker = {};

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
    if (def.valueToQueryParam) return def.valueToQueryParam(value);
    if (value === '' && defaults[key] === null) return undefined;

    return value === null ? ET_NULL_VALUE : value;
  };

  const deserialize = (def: QueryFieldDef<unknown>, raw: unknown): unknown => {
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

  const writeToUrl = (value: Dict) => {
    const queryParams: Dict = {};
    const version = ++urlWriteVersion;

    for (const [key, def] of Object.entries(fieldDefs)) {
      queryParams[paramKey(key)] = queryParamFor(key, def, value[key]);
    }

    queueMicrotask(() => {
      router.navigate([], {
        queryParams,
        queryParamsHandling: 'merge',
        replaceUrl: observeOptions?.replaceUrl,
        info: { queryForm: urlNavigationMarker, version },
      });
    });
  };

  const flush = () => {
    clearTimer();

    const rawLive = model() as Dict;
    const live = { ...rawLive };

    for (const [key, def] of Object.entries(fieldDefs)) {
      if (equal(live[key], defaults[key])) continue;

      const serialized = def.valueToQueryParam?.(live[key]);
      const serializedToNothing = !!def.valueToQueryParam && (serialized === null || serialized === undefined);
      const clearedNullableText = live[key] === '' && defaults[key] === null;

      if (serializedToNothing || clearedNullableText) {
        live[key] = defaults[key];
      }
    }

    const prev = committed() as Dict;

    if (equal(live, prev)) {
      skipNextResets = false;

      if (!equal(live, rawLive)) {
        model.set(clone(live) as QueryFormModel<TFields>);
      }

      return;
    }

    const next = skipNextResets ? { ...live } : resolveResets(fieldDefs, prev, live, defaultFor);

    skipNextResets = false;

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
  };

  /** Shortest-debounce-wins; `null` means commit immediately. */
  const resolveDebounce = (changedKeys: string[], live: Dict): number | null => {
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

  const onLiveChange = (live: Dict) => {
    if (!observing()) return;
    if (equal(live, committed())) return;

    const changedKeys = changedKeysBetween(committed() as Dict, live);
    const debounceMs = resolveDebounce(changedKeys, live);

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

  const commitFromUrl = (next: Dict) => {
    clearTimer();
    previous.set(clone(committed()) as QueryFormModel<TFields>);
    committed.set(clone(next) as QueryFormModel<TFields>);
    // Feed the URL value into the live model & bound controls; the effect no-ops (model === committed).
    model.set(clone(next) as QueryFormModel<TFields>);
  };

  const applyFromUrl = (params: Dict, base: Dict = committed() as Dict) => {
    const current = { ...base };
    let changed = false;

    for (const [key, def] of Object.entries(fieldDefs)) {
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
    if (!observing()) return;

    observing.set(false);
    clearTimer();

    if (!removeQueryParams || observeOptions?.writeToQueryParams === false) return;

    const queryParams: Dict = {};

    for (const key of Object.keys(fieldDefs)) {
      queryParams[paramKey(key)] = undefined;
    }

    queueMicrotask(() => {
      router.navigate([], { queryParams, queryParamsHandling: 'merge', replaceUrl: true });
    });
  };

  const setValue = (value: QueryFormModel<TFields>, options?: QueryFormSignalsWriteOptions) => {
    if (options?.skipResets) skipNextResets = true;

    model.set(clone(value));
  };

  const patchValue = (value: Partial<QueryFormModel<TFields>>, options?: QueryFormSignalsWriteOptions) => {
    if (options?.skipResets) skipNextResets = true;

    model.update((cur) => ({ ...cur, ...value }));
  };

  const resetFieldsToDefault = (keys: (keyof QueryFormModel<TFields>)[], options?: QueryFormSignalsWriteOptions) => {
    if (options?.skipResets) skipNextResets = true;

    model.update((cur) => {
      const next = { ...cur } as Dict;

      for (const key of keys) {
        next[key as string] = defaultFor(key as string);
      }

      return next as QueryFormModel<TFields>;
    });
  };

  const devtoolsName = config.name ?? (typeof prefix === 'string' ? prefix : 'form');
  const devtoolsId = isQueryDevtoolsEnabled() ? nextQueryFormDevtoolsId(devtoolsName) : null;

  const queryForm: QueryFormSignals<TFields> = {
    fields,

    // Reading `value` is how a query's args pick the form up, so the devtools learn which query a form
    // drives by noting the read - see `QueryDevtoolsFormLinksHandle`.
    value: devtoolsId
      ? computed(() => {
          noteQueryFormRead(devtoolsId);

          return committed();
        })
      : committed.asReadonly(),

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

      if (options?.syncOnNavigation !== false) {
        // A value written before `observe()` sits in the model only, so the URL merges onto the model
        // here. Against `committed()` any single URL param would drop that value.
        applyFromUrl(route.snapshot.queryParams as Dict, model() as Dict);
      }

      // Commit whatever the model holds now (URL-restored or programmatic defaults).
      flush();

      if (
        options?.writeToQueryParams !== false &&
        Object.values(fieldDefs).some((field) => field.appendDefaultValueToUrl === true)
      ) {
        writeToUrl(committed() as Dict);
      }

      return queryForm;
    },

    unobserve: () => cleanup(),

    setValue,
    patchValue,
    resetFieldToDefault: (key, options) => resetFieldsToDefault([key], options),
    resetFieldsToDefault,

    resetAllFieldsToDefault: (options) => {
      const skip = new Set((options?.skipFields ?? []).map((key) => key as string));
      const keys = Object.keys(fieldDefs).filter((key) => !skip.has(key)) as (keyof QueryFormModel<TFields>)[];

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

      const info = router.lastSuccessfulNavigation()?.extras.info as
        { queryForm?: object; version?: number } | undefined;
      if (info?.queryForm === urlNavigationMarker && (info.version ?? 0) < urlWriteVersion) return;

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
