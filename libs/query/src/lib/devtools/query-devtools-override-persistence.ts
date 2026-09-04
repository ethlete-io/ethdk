import { computed, Signal, signal } from '@angular/core';
import { OverrideOp, QueryDevtoolsOverridesRecorder } from './query-devtools-overrides';
import {
  clearQueryDevtoolsStore,
  QueryDevtoolsStorageScope,
  queryDevtoolsSettings,
  readQueryDevtoolsStore,
  setQueryDevtoolsSettings,
  writeQueryDevtoolsStore,
} from './query-devtools-settings';

/**
 * Not persisted at all unless asked for, and then in `sessionStorage`: "survives a reload" and "survives
 * until I notice" are different promises, and an app that stays tampered with across days is hours of
 * debugging the wrong thing. `local` is offered in Settings for the dev who has a reason, and the
 * restored-overrides bar names the scope whatever it is.
 */
const STORAGE_KEY = 'ethlete:query:devtools:overrides:v1';

type PersistedOverrides = {
  enabled: boolean;

  /** Armed ops per devtools entry id, in arming order. */
  ops: Record<string, OverrideOp[]>;
};

/** One entry id the last page load left ops for, as the panel's banner reports it. */
export type RestoredQueryDevtoolsOverrides = {
  /** The devtools entry id the ops were stored under. */
  id: string;

  /** How many ops were stored for it. */
  count: number;

  /**
   * Whether a query with this id has registered and taken them. `false` means the store outlived the
   * query it was written for - a route that no longer runs, or a creation order that shifted - so those
   * ops are sitting on nothing rather than quietly landing somewhere else.
   */
  armed: boolean;
};

const restored = /* @__PURE__ */ signal<readonly RestoredQueryDevtoolsOverrides[]>([]);
const restoredScope = /* @__PURE__ */ signal<QueryDevtoolsStorageScope | null>(null);

const scope = () => queryDevtoolsSettings().overrides;

/** Where "Keep across reloads" puts them back when it is switched on again. */
let lastPersistentScope: Exclude<QueryDevtoolsStorageScope, 'none'> = 'session';

/** Every recorder that currently holds at least one op, so switching persistence on can capture them. */
const armedRecorders = /* @__PURE__ */ new Map<string, QueryDevtoolsOverridesRecorder>();

/** What the store held when this page loaded, per id - the banner's subject, not the live registry. */
const carriedOver = /* @__PURE__ */ new Map<string, number>();

/** Of those, the ids a registering query actually took. */
const replayed = /* @__PURE__ */ new Set<string>();

let ops: Record<string, OverrideOp[]> = {};

const readStore = (): PersistedOverrides => {
  const parsed = readQueryDevtoolsStore<Partial<PersistedOverrides>>(scope(), STORAGE_KEY);
  const stored = parsed?.ops;
  const usable = !!stored && typeof stored === 'object' && !Array.isArray(stored);

  return { enabled: parsed?.enabled === true, ops: usable ? (stored as Record<string, OverrideOp[]>) : {} };
};

const writeStore = () => {
  if (scope() === 'none') {
    clearQueryDevtoolsStore(STORAGE_KEY);

    return;
  }

  writeQueryDevtoolsStore(scope(), STORAGE_KEY, { enabled: true, ops } satisfies PersistedOverrides);
};

const publishRestored = () =>
  restored.set([...carriedOver].map(([id, count]) => ({ id, count, armed: replayed.has(id) })));

const forgetCarriedOver = () => {
  carriedOver.clear();
  replayed.clear();
  restoredScope.set(null);
  publishRestored();
};

const writeOps = (id: string, list: OverrideOp[]) => {
  if (list.length) ops = { ...ops, [id]: list };
  else {
    const { [id]: _dropped, ...rest } = ops;
    ops = rest;
  }

  writeStore();
};

/**
 * Reads the store, so entries can replay from it as they register. Called by `provideQueryDevtools()`,
 * which is what keeps an app without devtools from ever touching storage.
 * @internal
 */
export const initQueryDevtoolsOverridePersistence = () => {
  const store = readStore();

  ops = store.enabled ? store.ops : {};
  armedRecorders.clear();
  carriedOver.clear();
  replayed.clear();

  for (const [id, list] of Object.entries(ops)) {
    if (list.length) carriedOver.set(id, list.length);
  }

  const current = scope();

  if (current !== 'none') lastPersistentScope = current;

  restoredScope.set(carriedOver.size ? current : null);
  publishRestored();
};

/**
 * Whether armed response overrides are stored and replayed on the next page load - that is, whether
 * their scope is anything other than `none`. Off by default.
 */
export const queryDevtoolsOverridePersistence: Signal<boolean> = /* @__PURE__ */ computed(() => scope() !== 'none');

/**
 * Where armed response overrides are kept. Switching to a scope that keeps them captures whatever is
 * armed right now, so the choice reads as "keep these" rather than "keep the next ones"; switching
 * between `session` and `local` moves the store; switching to `none` empties it and leaves every armed
 * op exactly where it is for the rest of this page.
 */
export const setQueryDevtoolsOverridesScope = (next: QueryDevtoolsStorageScope) => {
  const previous = scope();

  if (next === previous) return;

  // Off both stores first: whichever the previous scope was, its copy must not outlive the change.
  clearQueryDevtoolsStore(STORAGE_KEY);
  setQueryDevtoolsSettings({ overrides: next });

  if (next === 'none') {
    ops = {};
    forgetCarriedOver();

    return;
  }

  lastPersistentScope = next;

  if (previous === 'none') {
    ops = {};

    for (const [id, recorder] of armedRecorders) {
      const list = recorder.list().map((entry) => entry.op);

      if (list.length) ops[id] = list;
    }
  }

  writeStore();
};

/**
 * Turns persistence on or off - the panel's "Keep across reloads" toggle. On restores the last scope
 * that kept them (`session` unless Settings picked `local`).
 */
export const setQueryDevtoolsOverridePersistence = (value: boolean) => {
  setQueryDevtoolsOverridesScope(value ? lastPersistentScope : 'none');
};

/**
 * Empties the override store in both browser stores and disarms everything a reload brought back,
 * without changing where overrides are kept - the panel's "Reset devtools".
 */
export const clearQueryDevtoolsOverrideStore = () => {
  clearRestoredQueryDevtoolsOverrides();
  ops = {};
  clearQueryDevtoolsStore(STORAGE_KEY);
};

/**
 * The ops this page load inherited from the previous one, and for each id whether a live query has taken
 * it. Overrides that outlive the page that armed them have to announce themselves, because an app being
 * lied to looks exactly like an app that is broken.
 */
export const restoredQueryDevtoolsOverrides: Signal<readonly RestoredQueryDevtoolsOverrides[]> =
  /* @__PURE__ */ restored.asReadonly();

/**
 * The scope those ops came back from, or `null` when this page inherited none. `local` is the one worth
 * naming in the banner: it means they outlived closing the tab, not just a reload.
 */
export const queryDevtoolsRestoredOverridesScope: Signal<QueryDevtoolsStorageScope | null> =
  /* @__PURE__ */ restoredScope.asReadonly();

/** Disarms every op this page load inherited and empties the store - the banner's one-click way out. */
export const clearRestoredQueryDevtoolsOverrides = () => {
  for (const id of replayed) {
    armedRecorders.get(id)?.clearAll();
    armedRecorders.delete(id);
  }

  for (const id of carriedOver.keys()) writeOps(id, []);

  forgetCarriedOver();
};

/**
 * Forgets a destroyed query's recorder. Ops already persisted stay in the store on purpose - they are
 * keyed by an id the next page load re-derives, which is what "Keep across reloads" replays them from.
 * @internal
 */
export const releaseQueryDevtoolsOverridePersistence = (id: string) => {
  armedRecorders.delete(id);

  if (scope() !== 'none') return;

  const { [id]: _dropped, ...rest } = ops;
  ops = rest;
};

/**
 * Wraps a query's overrides recorder so its armed ops are stored and replayed. Replay happens here, at
 * registration, rather than in the panel - a query can run long before the panel is ever opened.
 *
 * Ids are reload-deterministic (descriptor + per-descriptor counter), so the same queries created in the
 * same order re-arm correctly; an id the store holds that nobody claims is reported by
 * {@link restoredQueryDevtoolsOverrides} rather than guessed at.
 * @internal
 */
export const withQueryDevtoolsOverridePersistence = (
  id: string,
  recorder: QueryDevtoolsOverridesRecorder,
): QueryDevtoolsOverridesRecorder => {
  const inherited = ops[id];

  if (scope() !== 'none' && inherited?.length) {
    for (const op of inherited) recorder.arm(op);

    armedRecorders.set(id, recorder);
    replayed.add(id);
    publishRestored();
  }

  const sync = () => {
    const list = recorder.list().map((entry) => entry.op);

    if (list.length) armedRecorders.set(id, recorder);
    else armedRecorders.delete(id);

    if (scope() !== 'none') writeOps(id, list);
  };

  return {
    ...recorder,
    arm: (op) => {
      recorder.arm(op);
      sync();
    },
    clear: (opId) => {
      recorder.clear(opId);
      sync();
    },
    clearAll: () => {
      recorder.clearAll();

      if (replayed.delete(id)) publishRestored();

      sync();
    },
  };
};
