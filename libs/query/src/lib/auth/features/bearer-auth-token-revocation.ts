import { HttpHeaders } from '@angular/common/http';
import { computed, effect, Signal, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, take } from 'rxjs';
import {
  AnyQuerySnapshot,
  QueryArgs,
  QuerySnapshot,
  RequestArgs,
  resolveQueryHeaders,
  wrapAsObservableSignal,
} from '../../http';
import {
  AnyQueryBuilder,
  BearerAuthFeatureType,
  BearerAuthSessionEndCause,
  BearerAuthProviderFeatureContext,
  ExtractQueryArgs,
  ExtractQueryKey,
} from '../bearer-auth-provider';
import { readSessionEnd, SessionEndEvent } from '../internal';

const AUTH_HEADER = 'Authorization';

type RevocationTokens = { accessToken: string | null; refreshToken: string | null };

const isSamePair = (a: RevocationTokens | null | undefined, b: RevocationTokens) =>
  !!a && a.accessToken === b.accessToken && a.refreshToken === b.refreshToken;

export type TokenRevocationConfig<
  TBuilders extends readonly AnyQueryBuilder[],
  TKey extends ExtractQueryKey<TBuilders[number]> = ExtractQueryKey<TBuilders[number]>,
> = {
  /**
   * The query key to use for token revocation (must reference a registered query)
   */
  queryKey: TKey;
  /**
   * Function to build the revocation request args from tokens. Leave it out for a query that takes no args.
   */
  buildArgs?: (tokens: {
    accessToken: string | null;
    refreshToken: string | null;
  }) => RequestArgs<ExtractQueryArgs<Extract<TBuilders[number], { key: TKey }>>>;
  /**
   * Whether to revoke on logout
   * @default true
   */
  revokeOnLogout?: boolean;
  /**
   * The session end causes that revoke automatically. Leave it out to revoke on every cause but
   * `otherTab`. A tab that multi-tab sync logged out reads as `otherTab` here whatever the cause was, so
   * only the tab the logout started in revokes unless this names `otherTab`.
   * @example revokeOn: ['user'] // for an API whose revocation ends the sessions on all devices
   */
  revokeOn?: readonly BearerAuthSessionEndCause[];
  /**
   * Send the revoked access token as `Authorization: Bearer <token>`, unless the built args already set that header.
   * @default false
   */
  bearer?: boolean;
};

export type TokenRevocationFeature<TQuerySnapshot extends AnyQuerySnapshot> = {
  /**
   * Manually revoke the current tokens.
   * Returns `null` if there are no tokens to revoke, else the snapshot of the revocation that sends them -
   * one queued behind a revocation in flight stays `isAlive()` until its own request settles.
   */
  revoke: () => TQuerySnapshot | null;
  /**
   * Enable automatic revocation on logout
   */
  enable: () => void;
  /**
   * Disable automatic revocation on logout
   */
  disable: () => void;
  /**
   * Whether automatic revocation is enabled
   */
  enabled: Signal<boolean>;
};

export const withTokenRevocation = <
  TBuilders extends readonly AnyQueryBuilder[],
  TKey extends ExtractQueryKey<TBuilders[number]> = ExtractQueryKey<TBuilders[number]>,
>(
  config: TokenRevocationConfig<TBuilders, TKey>,
) => {
  return (context: BearerAuthProviderFeatureContext<unknown, TBuilders>) => {
    type RevocationArgs = ExtractQueryArgs<Extract<TBuilders[number], { key: TKey }>>;
    type RevocationSnapshot = QuerySnapshot<RevocationArgs>;

    const revokeOnLogout = config.revokeOnLogout ?? true;
    const sessionEnd = readSessionEnd(context) ?? signal<SessionEndEvent | null>(null);

    const withBearerHeader = (args: RequestArgs<RevocationArgs>, accessToken: string | null) => {
      if (!config.bearer || !accessToken) return args;

      const argHeaders = (args as Pick<QueryArgs, 'headers'>).headers;
      const headers = () => {
        const base = resolveQueryHeaders(argHeaders) ?? new HttpHeaders();

        return base.has(AUTH_HEADER) ? base : base.set(AUTH_HEADER, `Bearer ${accessToken}`);
      };

      return { ...args, headers };
    };

    const shouldRevokeFor = ({ cause, fromOtherTab }: SessionEndEvent) => {
      if (config.revokeOn) return config.revokeOn.includes(fromOtherTab ? 'otherTab' : cause);

      return !fromOtherTab && cause !== 'otherTab';
    };

    const enabled = signal(true);
    let previousAccessToken: string | null = null;
    let previousRefreshToken: string | null = null;
    let currentRevocationSnapshot: RevocationSnapshot | null = null;
    let currentTokens: RevocationTokens | null = null;

    type QueuedRevocation = {
      tokens: RevocationTokens;
      snapshot: RevocationSnapshot;
      start: (snapshot: RevocationSnapshot) => void;
    };

    const queue: QueuedRevocation[] = [];
    const queueDropped = signal(false);

    const queueRevocation = (tokens: RevocationTokens): QueuedRevocation => {
      const target = signal<RevocationSnapshot | null>(null);
      const follow = <T>(read: (snapshot: RevocationSnapshot) => T) =>
        wrapAsObservableSignal(
          computed(() => {
            const snapshot = target();

            return snapshot ? read(snapshot) : null;
          }),
          context.injector,
        );

      const snapshot: RevocationSnapshot = {
        args: follow((s) => s.args()),
        response: follow((s) => s.response()),
        latestHttpEvent: follow((s) => s.latestHttpEvent()),
        loading: follow((s) => s.loading()),
        error: follow((s) => s.error()),
        lastTimeExecutedAt: follow((s) => s.lastTimeExecutedAt()),
        triggeredBy: follow((s) => s.triggeredBy()),
        id: follow((s) => s.id()),
        executionState: follow((s) => s.executionState()),
        isAlive: wrapAsObservableSignal(
          computed(() => target()?.isAlive() ?? !queueDropped()),
          context.injector,
        ),
      };

      const queued = { tokens, snapshot, start: (started: RevocationSnapshot) => target.set(started) };

      queue.push(queued);

      return queued;
    };

    context.destroyRef.onDestroy(() => queueDropped.set(true));

    const executeRevocation = (tokens: RevocationTokens) => {
      const args = withBearerHeader(
        config.buildArgs?.(tokens) ?? ({} as RequestArgs<RevocationArgs>),
        tokens.accessToken,
      );

      context.executionState.set({ type: 'revocation', state: 'loading' });

      const snapshot = context.queries[config.queryKey].execute(args, {
        triggeredBy: 'token-revocation',
      });

      currentRevocationSnapshot = snapshot;
      currentTokens = tokens;

      snapshot.isAlive
        .asObservable()
        .pipe(
          filter((isAlive) => !isAlive),
          take(1),
          takeUntilDestroyed(context.destroyRef),
        )
        .subscribe(() => {
          currentRevocationSnapshot = null;
          currentTokens = null;

          const next = queue.shift();

          if (next) next.start(executeRevocation(next.tokens));
        });

      return snapshot;
    };

    const revokeWithTokens = (accessToken: string | null, refreshToken: string | null) => {
      if (!accessToken && !refreshToken) {
        return currentRevocationSnapshot?.isAlive() ? currentRevocationSnapshot : null;
      }

      const tokens: RevocationTokens = { accessToken, refreshToken };

      if (currentRevocationSnapshot?.isAlive()) {
        if (isSamePair(currentTokens, tokens)) return currentRevocationSnapshot;

        return (queue.find((queued) => isSamePair(queued.tokens, tokens)) ?? queueRevocation(tokens)).snapshot;
      }

      return executeRevocation(tokens);
    };

    const revoke = () => {
      return revokeWithTokens(context.accessToken(), context.refreshToken());
    };

    const enable = () => {
      enabled.set(true);
    };

    const disable = () => {
      enabled.set(false);
    };

    if (revokeOnLogout) {
      effect(
        () => {
          const currentToken = context.accessToken();
          const currentRefreshToken = context.refreshToken();

          if (previousAccessToken && !currentToken && enabled()) {
            const end = untracked(sessionEnd);

            if (end && shouldRevokeFor(end)) {
              untracked(() => revokeWithTokens(previousAccessToken, previousRefreshToken));
            }
          }

          previousAccessToken = currentToken;
          previousRefreshToken = currentRefreshToken;
        },
        { injector: context.injector },
      );
    }

    const instance: TokenRevocationFeature<RevocationSnapshot> = {
      revoke,
      enable,
      disable,
      enabled: enabled.asReadonly(),
    };

    return {
      type: BearerAuthFeatureType.TOKEN_REVOCATION,
      instance,
      devtools: () => [
        { label: 'query', value: config.queryKey },
        { label: 'on logout', value: revokeOnLogout ? (config.revokeOn?.join(', ') ?? 'yes') : 'no' },
        { label: 'bearer', value: config.bearer ? 'yes' : 'no' },
      ],
    };
  };
};
