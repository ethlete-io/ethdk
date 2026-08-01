import { EnvironmentProviders, isDevMode, makeEnvironmentProviders, Signal, signal } from '@angular/core';
import { AnyCreateQueryClientResult } from '../http/query-client';
import { QueryDevtoolsEntry, QueryDevtoolsRegistration, setQueryDevtoolsRegistrar } from './query-devtools-hook';

const entries = /* @__PURE__ */ signal<QueryDevtoolsEntry[]>([]);

/**
 * The reactive list of every registered devtools entry, consumed by the `<et-query-devtools>` UI.
 */
export const queryDevtoolsEntries: Signal<QueryDevtoolsEntry[]> = /* @__PURE__ */ entries.asReadonly();

// Per-descriptor counter used to derive stable, reload-deterministic ids. Reset on page load (module
// re-eval), so the same queries created in the same order get the same ids across reloads - which is
// what lets the devtools restore the selected query after a reload.
const idCounters = /* @__PURE__ */ new Map<string, number>();

const descriptorOf = (entry: Pick<QueryDevtoolsEntry, 'kind' | 'meta'>) => {
  const { kind, meta } = entry;

  if (kind === 'query') return `query|${meta.clientName ?? ''}|${meta.method ?? ''}|${meta.route ?? ''}`;
  if (kind === 'auth-provider') return `auth-provider|${meta.name ?? ''}`;
  if (kind === 'ws-client') return `ws-client|${meta.name ?? ''}`;

  return kind;
};

/**
 * Stringifies a query creator route. Function routes are invoked with an empty args object and any
 * resulting `undefined` path segments are rendered as `:param`, matching the legacy devtools.
 * @internal
 */
export const stringifyQueryRoute = (route: unknown) => {
  if (route === undefined || route === null) return '';

  try {
    if (typeof route === 'function') {
      return (route as (args: unknown) => string)({}).replace(/undefined/g, ':param');
    }

    return String(route);
  } catch {
    return typeof route === 'function' ? '(dynamic route)' : String(route);
  }
};

/**
 * Extracts the human readable client name from a query client tuple. The client's DI token is named
 * `QueryClient_<name>`, so we strip the prefix to recover the original name.
 * @internal
 */
export const getQueryClientName = (client: AnyCreateQueryClientResult) => {
  const token = client.token;
  const desc = token?.toString?.() ?? '';

  return desc.replace('InjectionToken ', '').replace('QueryClient_', '') || 'unknown';
};

/**
 * Ids are derived deterministically from a stable descriptor + a per-descriptor sequence number, so
 * they survive a page reload (letting the UI restore the selected entry) instead of being random.
 */
const registerEntry = (registration: QueryDevtoolsRegistration): (() => void) => {
  const meta = { ...registration.meta };

  if (registration.route !== undefined) meta.route = stringifyQueryRoute(registration.route);
  if (registration.clientRef) meta.clientName = getQueryClientName(registration.clientRef);

  let id = registration.id;

  if (!id) {
    const descriptor = descriptorOf({ kind: registration.kind, meta });
    const seq = idCounters.get(descriptor) ?? 0;
    idCounters.set(descriptor, seq + 1);
    id = `${descriptor}#${seq}`;
  }

  const fullEntry: QueryDevtoolsEntry = {
    id,
    kind: registration.kind,
    handle: registration.handle,
    meta,
    createdAt: Date.now(),
  };

  entries.update((list) => [...list, fullEntry]);

  return () => entries.update((list) => list.filter((e) => e.id !== fullEntry.id));
};

/**
 * Enables the `@ethlete/query` devtools. Add this to your application providers (e.g. in
 * `bootstrapApplication`) to make query clients, queries, stacks, sequences and auth providers
 * appear in the `<et-query-devtools>` panel.
 *
 * When omitted, all devtools instrumentation is a no-op: the registry is never installed, so nothing
 * is retained at runtime and the registry itself is dropped from the bundle.
 *
 * @example
 * ```ts
 * bootstrapApplication(AppComponent, {
 *   providers: [provideQueryDevtools()],
 * });
 * ```
 */
export const provideQueryDevtools = (): EnvironmentProviders => {
  setQueryDevtoolsRegistrar(registerEntry);

  if (!isDevMode()) {
    console.warn(
      'You are using the Query Devtools in production mode. This increases the size of your bundle and should only be used for development purposes.',
    );
  }

  return makeEnvironmentProviders([]);
};
