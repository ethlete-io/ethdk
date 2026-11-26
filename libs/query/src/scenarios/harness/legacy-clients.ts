import { Injector, WritableSignal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  AnyLegacyQuery,
  AnyV2Query,
  createLegacyQueryCreator,
  def,
  QueryContainerConfig,
  V2QueryClient,
  V2QueryClientConfig,
} from '../../index';
import { Scenario } from './scenario';

export const LEGACY_CLIENT_KINDS = ['native', 'interop'] as const;

export type LegacyClientKind = (typeof LEGACY_CLIENT_KINDS)[number];

export type LegacyClientQuery = AnyV2Query | AnyLegacyQuery;

export type LegacyClientArgs = {
  pathParams?: Record<string, string>;
  queryParams?: Record<string, unknown>;
  body?: unknown;
};

export type LegacyClientRoute<TArgs extends LegacyClientArgs> =
  string | ((pathParams: NonNullable<TArgs['pathParams']>) => string);

export type LegacyClientCreator<TArgs extends LegacyClientArgs> = {
  prepare: (args: TArgs & { injector?: Injector }) => LegacyClientQuery;
  createSignal: (
    initialValue?: LegacyClientQuery | null,
    config?: QueryContainerConfig,
  ) => WritableSignal<LegacyClientQuery | null>;
  behaviorSubject: (initialValue?: LegacyClientQuery | null) => BehaviorSubject<LegacyClientQuery | null>;
};

export type LegacyClient = {
  kind: LegacyClientKind;
  get: <TArgs extends LegacyClientArgs>(route: LegacyClientRoute<TArgs>) => LegacyClientCreator<TArgs>;
  post: <TArgs extends LegacyClientArgs>(route: LegacyClientRoute<TArgs>) => LegacyClientCreator<TArgs>;
  /** Every query a `prepare()` returned, once per instance, in creation order. */
  prepared: () => LegacyClientQuery[];
  /**
   * The prepared queries still alive: held by a container on the native client, not yet destroyed
   * (`s.liveQueries()`) on the interop one.
   */
  liveQueries: () => LegacyClientQuery[];
  destroy: () => void;
};

export type LegacyClientOptions = {
  baseUrl?: string;
  config?: Omit<V2QueryClientConfig, 'baseRoute'>;
};

type AnyLegacyClientCreator = LegacyClientCreator<LegacyClientArgs>;

const trackPrepare = (creator: AnyLegacyClientCreator, track: (query: LegacyClientQuery) => void) => {
  const prepare = creator.prepare;

  creator.prepare = (args) => {
    const query = prepare(args);

    track(query);

    return query;
  };

  return creator;
};

/**
 * Builds the legacy `prepare()` surface on one of the two clients an app can run it on: the native
 * `V2QueryClient`, or `createLegacyQueryCreator` wrapping the scenario's own creators. Pair it with
 * `describe.each(LEGACY_CLIENT_KINDS)` so one scenario body runs on both.
 */
export const createLegacyClient = (
  s: Scenario,
  kind: LegacyClientKind,
  options: LegacyClientOptions = {},
): LegacyClient => {
  const prepared: LegacyClientQuery[] = [];
  const track = (query: LegacyClientQuery) => {
    if (!prepared.includes(query)) prepared.push(query);
  };

  if (kind === 'interop') {
    const wrap = (creator: unknown, name: string) =>
      trackPrepare(
        createLegacyQueryCreator({ creator: creator as never, name }) as unknown as AnyLegacyClientCreator,
        track,
      );

    return {
      kind,
      get: (route) => wrap(s.get(route as never), 'legacyGet') as never,
      post: (route) => wrap(s.post(route as never), 'legacyPost') as never,
      prepared: () => [...prepared],
      liveQueries: () => {
        const live = s.liveQueries();

        return prepared.filter((query) => live.includes((query as AnyLegacyQuery).newQuery));
      },
      destroy: () => undefined,
    };
  }

  const owner = s.consumer();
  const client = owner.run(
    () => new V2QueryClient({ baseRoute: options.baseUrl ?? 'https://api.test', ...options.config }),
  );
  const native = (method: 'get' | 'post', route: unknown) =>
    trackPrepare(
      client[method]({
        route: route as never,
        types: { args: def<LegacyClientArgs>(), response: def<unknown>() },
      }) as unknown as AnyLegacyClientCreator,
      track,
    );

  return {
    kind,
    get: (route) => native('get', route) as never,
    post: (route) => native('post', route) as never,
    prepared: () => [...prepared],
    liveQueries: () => prepared.filter((query) => query._hasDependents()),
    destroy: () => {
      for (const query of prepared) {
        query.stopPolling();
        query.abort();
      }

      client._store.forEach((query, key) => {
        query.stopPolling();
        query.abort();
        client._store.remove(key);
      });

      owner.destroy();
    },
  };
};
