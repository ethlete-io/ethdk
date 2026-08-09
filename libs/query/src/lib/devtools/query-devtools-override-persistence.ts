import { Signal, signal } from '@angular/core';
import { OverrideOp, QueryDevtoolsOverridesRecorder } from './query-devtools-overrides';

/**
 * `sessionStorage`, not `localStorage`: "survives a reload" and "survives until I notice" are different
 * promises, and an app that stays tampered with across days is hours of debugging the wrong thing.
 * Session scope dies with the tab, which is the promise this feature makes.
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

const enabled = /* @__PURE__ */ signal(false);
const restored = /* @__PURE__ */ signal<readonly RestoredQueryDevtoolsOverrides[]>([]);

/** Every recorder that currently holds at least one op, so switching persistence on can capture them. */
const armedRecorders = /* @__PURE__ */ new Map<string, QueryDevtoolsOverridesRecorder>();

/** What the store held when this page loaded, per id - the banner's subject, not the live registry. */
const carriedOver = /* @__PURE__ */ new Map<string, number>();

/** Of those, the ids a registering query actually took. */
const replayed = /* @__PURE__ */ new Set<string>();

let ops: Record<string, OverrideOp[]> = {};

const readStore = (): PersistedOverrides => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<PersistedOverrides> | null) : null;
    const stored = parsed?.ops;
    const usable = !!stored && typeof stored === 'object' && !Array.isArray(stored);

    return { enabled: parsed?.enabled === true, ops: usable ? (stored as Record<string, OverrideOp[]>) : {} };
  } catch {
    return { enabled: false, ops: {} };
  }
};

const writeStore = () => {
  try {
    if (!enabled()) {
      sessionStorage.removeItem(STORAGE_KEY);

      return;
    }

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: true, ops } satisfies PersistedOverrides));
  } catch {
    // ignore (private mode / disabled storage)
  }
};

const publishRestored = () =>
  restored.set([...carriedOver].map(([id, count]) => ({ id, count, armed: replayed.has(id) })));

const forgetCarriedOver = () => {
  carriedOver.clear();
  replayed.clear();
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

  enabled.set(store.enabled);
  ops = store.enabled ? store.ops : {};
  armedRecorders.clear();
  carriedOver.clear();
  replayed.clear();

  for (const [id, list] of Object.entries(ops)) {
    if (list.length) carriedOver.set(id, list.length);
  }

  publishRestored();
};

/**
 * Whether armed response overrides are written to `sessionStorage` and replayed on the next page load.
 * Off unless the panel's "Keep across reloads" toggle turned it on - and the flag itself is part of what
 * is stored, since otherwise nothing could ever be replayed.
 */
export const queryDevtoolsOverridePersistence: Signal<boolean> = /* @__PURE__ */ enabled.asReadonly();

/**
 * Turns persistence on or off. Turning it on captures whatever is armed right now, so the toggle reads
 * as "keep these" rather than "keep the next ones"; turning it off empties the store and leaves every
 * armed op exactly where it is for the rest of this page.
 */
export const setQueryDevtoolsOverridePersistence = (value: boolean) => {
  enabled.set(value);
  ops = {};

  if (value) {
    for (const [id, recorder] of armedRecorders) {
      const list = recorder.list().map((entry) => entry.op);

      if (list.length) ops[id] = list;
    }
  } else {
    forgetCarriedOver();
  }

  writeStore();
};

/**
 * The ops this page load inherited from the previous one, and for each id whether a live query has taken
 * it. Overrides that outlive the page that armed them have to announce themselves, because an app being
 * lied to looks exactly like an app that is broken.
 */
export const restoredQueryDevtoolsOverrides: Signal<readonly RestoredQueryDevtoolsOverrides[]> =
  /* @__PURE__ */ restored.asReadonly();

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

  if (enabled() && inherited?.length) {
    for (const op of inherited) recorder.arm(op);

    armedRecorders.set(id, recorder);
    replayed.add(id);
    publishRestored();
  }

  const sync = () => {
    const list = recorder.list().map((entry) => entry.op);

    if (list.length) armedRecorders.set(id, recorder);
    else armedRecorders.delete(id);

    if (enabled()) writeOps(id, list);
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
