import { EnvironmentProviders, isDevMode, makeEnvironmentProviders, Signal, signal } from '@angular/core';
import { randomId } from '@ethlete/core';
import type { AnyCreateQueryClientResult } from '../http/query-client';
import type { CreateQueryCreatorOptions, QueryConfig } from '../http/query-creator';
import type { QueryFeatureType } from '../http/query-features';
import type { QueryRepository } from '../http/query-repository';

/**
 * The kind of object a {@link QueryDevtoolsEntry} describes. Part of the devtools contract consumed
 * by `<et-query-devtools>` — not a general-purpose query API.
 */
export type QueryDevtoolsEntryKind = 'query' | 'query-stack' | 'paged-query-stack' | 'query-sequence' | 'auth-provider';

/**
 * Descriptive, mostly-static metadata about a registered devtools entry. The live, reactive state
 * is read from the entry's {@link QueryDevtoolsEntry.handle} instead.
 */
export type QueryDevtoolsEntryMeta = {
  /** Display name of the owning query client, where known. */
  clientName?: string;

  /** Human readable display name (e.g. an auth provider name). */
  name?: string;

  /** Stringified route with path params rendered as `:param`, for queries. */
  route?: string;

  /** Human readable HTTP/GQL method, for queries (e.g. `GET`, `GQL QUERY`). */
  method?: string;

  /** The feature types applied at creation, for queries. */
  featureTypes?: QueryFeatureType[];

  /** The query config passed at creation, for queries. */
  queryConfig?: QueryConfig;

  /** The creator options passed at creation, for queries. */
  creator?: CreateQueryCreatorOptions;

  /** The owning client's repository, where known (queries and auth providers). */
  repository?: QueryRepository;
};

/**
 * A single entry in the {@link queryDevtoolsEntries} registry. The `handle` is the live object
 * (query, stack, sequence or auth provider) so its signals stay reactive when read by the UI.
 */
export type QueryDevtoolsEntry = {
  id: string;
  kind: QueryDevtoolsEntryKind;
  meta: QueryDevtoolsEntryMeta;
  handle: unknown;
  createdAt: number;
};

const noop = () => undefined;

let devtoolsEnabled = false;

/**
 * Whether {@link provideQueryDevtools} has been called. When `false`, every `register*` call is a
 * no-op so the devtools instrumentation retains no references and adds no overhead in production.
 * @internal
 */
export const isQueryDevtoolsEnabled = () => devtoolsEnabled;

const entries = signal<QueryDevtoolsEntry[]>([]);

/**
 * The reactive list of every registered devtools entry, consumed by the `<et-query-devtools>` UI.
 */
export const queryDevtoolsEntries: Signal<QueryDevtoolsEntry[]> = entries.asReadonly();

/**
 * Registers an entry with the devtools registry. Returns an unregister callback. A no-op (returning
 * a no-op callback) unless {@link provideQueryDevtools} has been called.
 * @internal
 */
export const registerQueryDevtoolsEntry = (
  entry: Omit<QueryDevtoolsEntry, 'id' | 'createdAt'> & { id?: string },
): (() => void) => {
  if (!devtoolsEnabled) return noop;

  const id = entry.id ?? randomId();
  const fullEntry: QueryDevtoolsEntry = { ...entry, id, createdAt: Date.now() };

  entries.update((list) => [...list, fullEntry]);

  return () => entries.update((list) => list.filter((e) => e.id !== id));
};

let suppressStackRegistration = false;

/**
 * Suppresses devtools registration for the next {@link createQueryStack} call. Used by
 * `createPagedQueryStack` so its backing stack is not registered as a separate `query-stack` entry.
 * @internal
 */
export const suppressNextQueryStackDevtools = () => {
  suppressStackRegistration = true;
};

/**
 * Reads and clears the suppress-next-stack flag. Always call this from `createQueryStack` (even when
 * devtools are disabled) so a suppression request never leaks into a later stack.
 * @internal
 */
export const consumeSuppressQueryStackDevtools = () => {
  const value = suppressStackRegistration;
  suppressStackRegistration = false;

  return value;
};

/**
 * Stringifies a query creator route. Function routes are invoked with an empty args object and any
 * resulting `undefined` path segments are rendered as `:param`, matching the legacy devtools.
 * @internal
 */
export const stringifyQueryRoute = (route: unknown): string => {
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
export const getQueryClientName = (client: AnyCreateQueryClientResult): string => {
  const token = client[2];
  const desc = token?.toString?.() ?? '';

  return desc.replace('InjectionToken ', '').replace('QueryClient_', '') || 'unknown';
};

/**
 * Enables the `@ethlete/query` devtools. Add this to your application providers (e.g. in
 * `bootstrapApplication`) to make query clients, queries, stacks, sequences and auth providers
 * appear in the `<et-query-devtools>` panel.
 *
 * When omitted, all devtools instrumentation is a no-op — no references are retained and there is no
 * runtime overhead — so it is safe to leave out of production builds.
 *
 * @example
 * ```ts
 * bootstrapApplication(AppComponent, {
 *   providers: [provideQueryDevtools()],
 * });
 * ```
 */
export const provideQueryDevtools = (): EnvironmentProviders => {
  devtoolsEnabled = true;

  if (!isDevMode()) {
    console.warn(
      'You are using the Query Devtools in production mode. This increases the size of your bundle and should only be used for development purposes.',
    );
  }

  return makeEnvironmentProviders([]);
};
