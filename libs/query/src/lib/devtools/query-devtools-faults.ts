import { Signal, signal } from '@angular/core';
import { QueryDevtoolsFaultTarget, QueryDevtoolsResolvedFault } from './query-devtools-hook';
import {
  clearQueryDevtoolsStore,
  QueryDevtoolsStorageScope,
  queryDevtoolsSettings,
  readQueryDevtoolsStore,
  setQueryDevtoolsSettings,
  writeQueryDevtoolsStore,
} from './query-devtools-settings';

/**
 * A fault armed on one query client from the devtools panel. Unlike the panel's forced states - which
 * write a query's signals directly - an armed fault is applied inside the request pipeline, so retries,
 * error handling features and the cache all see it exactly as they would see a real one.
 */
export type QueryDevtoolsFault = {
  /** Extra latency in ms added before every attempt starts. `0` disables it. */
  latencyMs: number;

  /**
   * How many upcoming attempts fail before the client is let through again, counted down as they are
   * consumed. `0` disables it.
   */
  failNext: number;

  /** The percentage of attempts that fail, rolled per attempt. `0` disables it, `100` fails everything. */
  failRate: number;

  /** The status an injected failure responds with. */
  status: number;
};

/** The neutral fault: nothing armed. */
export const EMPTY_QUERY_DEVTOOLS_FAULT: QueryDevtoolsFault = {
  latencyMs: 0,
  failNext: 0,
  failRate: 0,
  status: 503,
};

/**
 * Statuses worth injecting, and whether the SDK's default retry policy retries them. A picker built from
 * this cannot arm a 500 and then leave you wondering why no retry fired.
 * @see runDefaultQueryRetry
 */
export const QUERY_DEVTOOLS_FAULT_STATUSES: { status: number; label: string; retryable: boolean }[] = [
  { status: 0, label: 'Network error', retryable: true },
  { status: 400, label: 'Bad Request', retryable: false },
  { status: 401, label: 'Unauthorized', retryable: false },
  { status: 403, label: 'Forbidden', retryable: false },
  { status: 404, label: 'Not Found', retryable: false },
  { status: 408, label: 'Request Timeout', retryable: true },
  { status: 429, label: 'Too Many Requests', retryable: true },
  { status: 500, label: 'Internal Server Error', retryable: false },
  { status: 502, label: 'Bad Gateway', retryable: true },
  { status: 503, label: 'Service Unavailable', retryable: true },
];

const STORAGE_KEY = 'ethlete:query:devtools:faults:v1';

const faults = /* @__PURE__ */ signal<Record<string, QueryDevtoolsFault>>({});
const restored = /* @__PURE__ */ signal(false);

const scope = () => queryDevtoolsSettings().armedFaults;

/**
 * The faults armed per client name, consumed by the `<et-query-devtools>` UI. Clients with nothing armed
 * are absent rather than present with an {@link EMPTY_QUERY_DEVTOOLS_FAULT}.
 */
export const queryDevtoolsFaults: Signal<Record<string, QueryDevtoolsFault>> = /* @__PURE__ */ faults.asReadonly();

/**
 * Whether what is armed right now came back from a previous page load rather than being armed by hand.
 * The panel's armed bar says so, because injected failures nobody remembers arming look exactly like a
 * broken API.
 */
export const queryDevtoolsFaultsRestored: Signal<boolean> = /* @__PURE__ */ restored.asReadonly();

const write = () => {
  if (scope() === 'none') {
    clearQueryDevtoolsStore(STORAGE_KEY);

    return;
  }

  writeQueryDevtoolsStore(scope(), STORAGE_KEY, faults());
};

const asFault = (value: unknown): QueryDevtoolsFault | null => {
  const fault = value as Partial<QueryDevtoolsFault> | null;

  if (!fault || typeof fault !== 'object') return null;

  const next: QueryDevtoolsFault = {
    latencyMs: Number(fault.latencyMs) || 0,
    failNext: Number(fault.failNext) || 0,
    failRate: Number(fault.failRate) || 0,
    status: Number.isFinite(Number(fault.status)) ? Number(fault.status) : EMPTY_QUERY_DEVTOOLS_FAULT.status,
  };

  return isQueryDevtoolsFaultArmed(next) ? next : null;
};

/**
 * Reads the armed faults back, when the `armedFaults` setting asks for them. Called by
 * `provideQueryDevtools()` after the settings it takes its scope from; nothing else may call it.
 * @internal
 */
export const initQueryDevtoolsFaults = () => {
  const stored = readQueryDevtoolsStore<Record<string, unknown>>(scope(), STORAGE_KEY);
  const inherited: Record<string, QueryDevtoolsFault> = {};

  for (const [clientName, value] of Object.entries(stored ?? {})) {
    const fault = asFault(value);

    if (fault) inherited[clientName] = fault;
  }

  faults.set(inherited);
  restored.set(Object.keys(inherited).length > 0);
};

/**
 * Where the armed faults are kept. Switching to a scope that keeps them stores whatever is armed right
 * now; switching to `none` empties the store and leaves this page's faults exactly where they are.
 */
export const setQueryDevtoolsFaultsScope = (next: QueryDevtoolsStorageScope) => {
  if (next === scope()) return;

  // Off both stores first: whichever the previous scope was, its copy must not outlive the change.
  clearQueryDevtoolsStore(STORAGE_KEY);
  setQueryDevtoolsSettings({ armedFaults: next });
  write();
};

/** Whether anything at all is armed on a fault. */
export const isQueryDevtoolsFaultArmed = (fault: QueryDevtoolsFault) =>
  fault.latencyMs > 0 || fault.failNext > 0 || fault.failRate > 0;

const patchFault = (options: { clientName: string; patch: Partial<QueryDevtoolsFault> }) => {
  const { clientName, patch } = options;

  faults.update((current) => {
    const next = { ...(current[clientName] ?? EMPTY_QUERY_DEVTOOLS_FAULT), ...patch };

    if (!isQueryDevtoolsFaultArmed(next)) {
      const { [clientName]: _removed, ...rest } = current;

      return rest;
    }

    return { ...current, [clientName]: next };
  });

  write();
};

/**
 * Arms (or updates) the fault of one client. Only the given fields change; the rest keep their current
 * value. A client whose resulting fault has nothing armed is dropped from {@link queryDevtoolsFaults}.
 *
 * Part of the devtools contract consumed by `<et-query-devtools>`; a fault is a debugging tool, not
 * something an application should arm on itself.
 */
export const setQueryDevtoolsFault = (options: { clientName: string; patch: Partial<QueryDevtoolsFault> }) => {
  patchFault(options);
  restored.set(false);
};

/**
 * Disarms every fault of one client, or of all clients when no name is given.
 *
 * @see setQueryDevtoolsFault
 */
export const clearQueryDevtoolsFaults = (clientName?: string) => {
  faults.update((current) => {
    if (clientName === undefined) return {};

    const { [clientName]: _removed, ...rest } = current;

    return rest;
  });

  restored.set(false);
  write();
};

/**
 * Resolves what to do with one upcoming attempt, consuming a `failNext` budget in the process - so this
 * must be called once per attempt and never speculatively.
 *
 * Installed as the fault resolver by `provideQueryDevtools()`; nothing else may call it.
 * @internal
 */
export const resolveQueryDevtoolsFaultForAttempt = (
  target: QueryDevtoolsFaultTarget,
): QueryDevtoolsResolvedFault | null => {
  const fault = faults()[target.clientName];

  if (!fault || !isQueryDevtoolsFaultArmed(fault)) return null;

  let shouldFail = false;

  if (fault.failNext > 0) {
    shouldFail = true;
    // Not the public setter: spending the budget is the armed fault doing its job, not someone re-arming
    // it, so it must not clear what the panel's bar says about where the fault came from.
    patchFault({ clientName: target.clientName, patch: { failNext: fault.failNext - 1 } });
  } else if (fault.failRate > 0) {
    shouldFail = Math.random() * 100 < fault.failRate;
  }

  return {
    latencyMs: fault.latencyMs,
    status: shouldFail ? fault.status : null,
  };
};
