import { effect, Signal } from '@angular/core';
import { QueryArgs, QueryErrorResponse, QuerySnapshot } from '../../http';
import {
  AnyQueryBuilder,
  BearerAuthFeatureType,
  BearerAuthProviderFeatureContext,
  ExtractQueryArgs,
  ExtractQueryKey,
} from '../bearer-auth-provider';

export type TrackingEventName<TBuilders extends readonly AnyQueryBuilder[]> =
  | `${ExtractQueryKey<TBuilders[number]>}Execute`
  | `${ExtractQueryKey<TBuilders[number]>}Success`
  | `${ExtractQueryKey<TBuilders[number]>}Failure`
  | 'tokenRefreshSuccess'
  | 'logout';

type ExtractKeyFromEventName<TEventName extends string> = TEventName extends `${infer K}Execute`
  ? K
  : TEventName extends `${infer K}Success`
    ? K
    : TEventName extends `${infer K}Failure`
      ? K
      : never;

type ExtractArgsForEvent<TBuilders extends readonly AnyQueryBuilder[], TEventName extends string> = ExtractQueryArgs<
  Extract<TBuilders[number], { key: ExtractKeyFromEventName<TEventName> }>
>;

export type QueryExecuteEventData<TArgs extends QueryArgs = QueryArgs> = {
  queryKey: string;
  args: TArgs;
};

export type QuerySuccessEventData<TArgs extends QueryArgs = QueryArgs> = {
  snapshot: QuerySnapshot<TArgs>;
};

export type QueryFailureEventData = {
  error: QueryErrorResponse;
};

export type TokenRefreshEventData = {
  automatic: boolean;
};

export type TrackingEventDataMap<TBuilders extends readonly AnyQueryBuilder[]> = {
  [K in TrackingEventName<TBuilders>]: K extends `${string}Execute`
    ? QueryExecuteEventData<ExtractArgsForEvent<TBuilders, K>>
    : K extends `${string}Success`
      ? QuerySuccessEventData<ExtractArgsForEvent<TBuilders, K>>
      : K extends `${string}Failure`
        ? QueryFailureEventData
        : K extends 'tokenRefreshSuccess'
          ? TokenRefreshEventData
          : K extends 'logout'
            ? void
            : never;
};

export type TrackingEventHandler<TData> = (data: TData) => void;

export type TrackingConfig<TBuilders extends readonly AnyQueryBuilder[] = readonly AnyQueryBuilder[]> = {
  /**
   * Whether to track internal events (auto token refresh, etc.)
   * @default true
   */
  trackInternalEvents?: boolean;

  /**
   * Event handlers to register immediately
   */
  on?: {
    [K in TrackingEventName<TBuilders>]?: TrackingEventHandler<TrackingEventDataMap<TBuilders>[K]>;
  };
};

export type TrackingFeature<TBuilders extends readonly AnyQueryBuilder[]> = {
  /**
   * Register an event handler for a specific event
   * @returns Unsubscribe function
   */
  on<TEvent extends TrackingEventName<TBuilders>>(
    event: TEvent,
    handler: TrackingEventHandler<TrackingEventDataMap<TBuilders>[TEvent]>,
  ): () => void;

  /**
   * Unregister an event handler
   */
  off<TEvent extends TrackingEventName<TBuilders>>(
    event: TEvent,
    handler: TrackingEventHandler<TrackingEventDataMap<TBuilders>[TEvent]>,
  ): void;
};

export const withTracking = <TBuilders extends readonly AnyQueryBuilder[]>(config?: TrackingConfig<TBuilders>) => {
  return (context: BearerAuthProviderFeatureContext<unknown, TBuilders>) => {
    const instance = createTrackingFeature<TBuilders>(context, config);
    return {
      type: BearerAuthFeatureType.TRACKING,
      instance,
    };
  };
};

export const createTrackingFeature = <TBuilders extends readonly AnyQueryBuilder[]>(
  context: BearerAuthProviderFeatureContext<unknown, TBuilders>,
  config?: TrackingConfig<TBuilders>,
): TrackingFeature<TBuilders> => {
  const handlers = new Map<string, Set<TrackingEventHandler<any>>>(); // eslint-disable-line @typescript-eslint/no-explicit-any

  const on = <TEvent extends TrackingEventName<TBuilders>>(
    event: TEvent,
    handler: TrackingEventHandler<TrackingEventDataMap<TBuilders>[TEvent]>,
  ): (() => void) => {
    if (!handlers.has(event)) {
      handlers.set(event, new Set());
    }
    const eventHandlers = handlers.get(event);
    if (eventHandlers) {
      eventHandlers.add(handler);
    }

    return () => off(event, handler);
  };

  const off = <TEvent extends TrackingEventName<TBuilders>>(
    event: TEvent,
    handler: TrackingEventHandler<TrackingEventDataMap<TBuilders>[TEvent]>,
  ): void => {
    const eventHandlers = handlers.get(event);
    if (eventHandlers) {
      eventHandlers.delete(handler);
      if (eventHandlers.size === 0) {
        handlers.delete(event);
      }
    }
  };

  const emit = (event: string, data: unknown): void => {
    const eventHandlers = handlers.get(event);
    if (eventHandlers) {
      eventHandlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in tracking event handler for "${event}":`, error);
        }
      });
    }
  };

  const trackedQueries = new Map<string, { loading: boolean; lastResult: 'success' | 'error' | null }>();

  Object.entries(context.queries).forEach(([key, queryEntry]) => {
    const query = queryEntry as { snapshot: Signal<any>; execute: (...args: any[]) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

    effect(() => {
      const snapshot = query.snapshot();
      if (!snapshot) return;

      const triggeredBy = snapshot.triggeredBy();
      if (triggeredBy) return;

      const loading = snapshot.loading();
      const error = snapshot.error();
      const response = snapshot.response();

      const prevState = trackedQueries.get(key);

      if (response && !loading && !error && prevState?.lastResult !== 'success') {
        trackedQueries.set(key, { loading: false, lastResult: 'success' });
        emit(`${key}Success`, { snapshot });
      }

      if (error && !loading && prevState?.lastResult !== 'error') {
        trackedQueries.set(key, { loading: false, lastResult: 'error' });
        emit(`${key}Failure`, { error });
      }

      if (loading) {
        trackedQueries.set(key, { loading: true, lastResult: null });
      }
    });
  });

  let hadTokens = false;
  effect(() => {
    const accessToken = context.accessToken();
    const refreshToken = context.refreshToken();
    const hasTokens = !!(accessToken || refreshToken);

    if (hadTokens && !hasTokens) {
      emit('logout', undefined);
    }

    hadTokens = hasTokens;
  });

  context.afterTokenRefresh$.subscribe(() => {
    emit('tokenRefreshSuccess', {
      queryKey: 'refresh',
      snapshot: undefined,
    });
  });

  if (config?.on) {
    Object.entries(config.on).forEach(([event, handler]) => {
      if (handler) {
        on(event as TrackingEventName<TBuilders>, handler);
      }
    });
  }

  return {
    on,
    off,
  };
};
