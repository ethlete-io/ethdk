import { effect, isDevMode, Signal, untracked } from '@angular/core';
import { QueryArgs, QueryErrorResponse, QuerySnapshot, RequestArgs } from '../../http';
import {
  AnyQueryBuilder,
  BearerAuthFeatureType,
  BearerAuthProviderFeatureContext,
  BearerAuthSessionEndCause,
  ExtractQueryArgs,
  ExtractQueryKey,
} from '../bearer-auth-provider';

export type TrackingEventName<TBuilders extends readonly AnyQueryBuilder[]> =
  | `${ExtractQueryKey<TBuilders[number]>}Execute`
  | `${ExtractQueryKey<TBuilders[number]>}Success`
  | `${ExtractQueryKey<TBuilders[number]>}Failure`
  | 'tokenRefreshSuccess'
  | 'logout'
  | 'leaderStatusChange'
  | 'leaderInstanceCountChange';

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
  args: RequestArgs<TArgs> | null;
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

export type LogoutEventData = {
  cause: BearerAuthSessionEndCause | null;
};

export type LeaderStatusChangeEventData = {
  isLeader: boolean;
};

export type LeaderInstanceCountChangeEventData = {
  count: number;
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
            ? LogoutEventData
            : K extends 'leaderStatusChange'
              ? LeaderStatusChangeEventData
              : K extends 'leaderInstanceCountChange'
                ? LeaderInstanceCountChangeEventData
                : never;
};

export type TrackingEventHandler<TData> = (data: TData) => void;

export type TrackingConfig<TBuilders extends readonly AnyQueryBuilder[] = readonly AnyQueryBuilder[]> = {
  /**
   * Whether executions the provider starts itself - the persistent auto-login, the proactive token
   * refresh, the token revocation - also raise their `<key>Execute` / `<key>Success` / `<key>Failure`
   * events.
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
    const handledEvents = Object.keys(config?.on ?? {});

    return {
      type: BearerAuthFeatureType.TRACKING,
      instance,
      devtools: () => [
        { label: 'internal events', value: config?.trackInternalEvents === false ? 'ignored' : 'tracked' },
        ...(handledEvents.length ? [{ label: 'handlers', value: handledEvents.join(', ') }] : []),
      ],
    };
  };
};

export const createTrackingFeature = <TBuilders extends readonly AnyQueryBuilder[]>(
  context: BearerAuthProviderFeatureContext<unknown, TBuilders>,
  config?: TrackingConfig<TBuilders>,
): TrackingFeature<TBuilders> => {
  const handlers = new Map<string, Set<TrackingEventHandler<any>>>(); // eslint-disable-line @typescript-eslint/no-explicit-any
  const trackInternalEvents = config?.trackInternalEvents !== false;

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
  ) => {
    const eventHandlers = handlers.get(event);
    if (eventHandlers) {
      eventHandlers.delete(handler);
      if (eventHandlers.size === 0) {
        handlers.delete(event);
      }
    }
  };

  const fireHandlers = (event: string, data: unknown) => {
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

  type ForwardedMessage = { event: string; data: unknown };
  const pendingForwardedMessages: ForwardedMessage[] = [];
  const forwardingChannel =
    context.leaderElection && typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel(`ethlete-auth-tracking:${context.name}`)
      : null;

  if (forwardingChannel) {
    forwardingChannel.onmessage = (messageEvent: MessageEvent<ForwardedMessage>) => {
      if (context.isLeader()) {
        fireHandlers(messageEvent.data.event, messageEvent.data.data);
      }
    };
    context.destroyRef.onDestroy(() => forwardingChannel.close());
  }

  const forward = (message: ForwardedMessage) => {
    if (!forwardingChannel) return false;

    try {
      forwardingChannel.postMessage(message);

      return true;
    } catch (error) {
      if (isDevMode()) {
        console.warn(
          `[@ethlete/query] Could not forward the "${message.event}" tracking event to the leader tab.`,
          error,
        );
      }

      return false;
    }
  };

  if (context.leaderElection) {
    effect(
      () => {
        const isLeader = context.leaderElection?.isLeader() ?? false;
        const instanceCount = context.leaderElection?.instanceCount() ?? 1;

        if (!pendingForwardedMessages.length || (!isLeader && instanceCount <= 1)) return;

        untracked(() => {
          const pending = pendingForwardedMessages.splice(0);

          for (const message of pending) {
            if (isLeader || !forward(message)) fireHandlers(message.event, message.data);
          }
        });
      },
      { injector: context.injector },
    );
  }

  const emit = (event: string, data: unknown) => {
    if (forwardingChannel && !context.isLeader()) {
      const message = { event, data } satisfies ForwardedMessage;

      if ((context.leaderElection?.instanceCount() ?? 1) <= 1) {
        pendingForwardedMessages.push(message);

        return;
      }

      if (forward(message)) return;
    }

    fireHandlers(event, data);
  };

  const emitDirect = (event: string, data: unknown) => {
    fireHandlers(event, data);
  };

  const trackedQueries = new Map<
    string,
    { lastResult: 'success' | 'error' | null; snapshot: QuerySnapshot<QueryArgs> }
  >();

  Object.entries(context.queries).forEach(([key, queryEntry]) => {
    const query = queryEntry as { snapshot: Signal<any>; execute: (...args: any[]) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

    effect(() => {
      const snapshot = query.snapshot();
      if (!snapshot) return;

      const triggeredBy = snapshot.triggeredBy();
      if (triggeredBy && !trackInternalEvents) return;

      const loading = snapshot.loading();
      const error = snapshot.error();
      const response = snapshot.response();

      const prevState = trackedQueries.get(key);

      if (prevState?.snapshot !== snapshot) {
        trackedQueries.set(key, { snapshot, lastResult: null });
        emit(`${key}Execute`, { queryKey: key, args: snapshot.args() });
      }

      if (response && !loading && !error && prevState?.lastResult !== 'success') {
        trackedQueries.set(key, { snapshot, lastResult: 'success' });
        emit(`${key}Success`, { snapshot });
      }

      if (error && !loading && prevState?.lastResult !== 'error') {
        trackedQueries.set(key, { snapshot, lastResult: 'error' });
        emit(`${key}Failure`, { error });
      }
    });
  });

  let hadTokens = false;
  effect(() => {
    const accessToken = context.accessToken();
    const refreshToken = context.refreshToken();
    const hasTokens = !!(accessToken || refreshToken);

    if (hadTokens && !hasTokens) {
      emit('logout', { cause: untracked(context.sessionEndCause) });
    }

    hadTokens = hasTokens;
  });

  let lastTrackedRefreshState: unknown = null;
  effect(() => {
    const state = context.executionState();

    if (state === lastTrackedRefreshState || state?.type !== 'tokenRefresh' || state.state !== 'success') return;

    lastTrackedRefreshState = state;
    emit('tokenRefreshSuccess', {
      automatic: !!untracked(context.latestExecutedQuery)?.snapshot.triggeredBy(),
    } satisfies TokenRefreshEventData);
  });

  if (config?.on) {
    Object.entries(config.on).forEach(([event, handler]) => {
      if (handler) {
        on(event as TrackingEventName<TBuilders>, handler);
      }
    });
  }

  if (context.leaderElection) {
    const { isLeader: isLeaderSignal, instanceCount: instanceCountSignal } = context.leaderElection;

    effect(() => {
      emitDirect('leaderStatusChange', { isLeader: isLeaderSignal() } satisfies LeaderStatusChangeEventData);
    });

    effect(() => {
      emitDirect('leaderInstanceCountChange', {
        count: instanceCountSignal(),
      } satisfies LeaderInstanceCountChangeEventData);
    });
  }

  return {
    on,
    off,
  };
};
