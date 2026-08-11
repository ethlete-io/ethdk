import { DestroyRef, effect, inject, isDevMode, Signal, untracked } from '@angular/core';
import { Subject } from 'rxjs';
import { BearerAuthActivityCoordination, BearerAuthSessionEndCause } from '../bearer-auth-provider';
import { decryptToken, encryptToken } from '../utils';

type SyncMessage =
  | {
      type: 'tokens-updated';
      accessToken: string;
      refreshToken: string;
    }
  | {
      type: 'logout';
      cause?: BearerAuthSessionEndCause;
    }
  | {
      /** A tab that just started asking whoever holds the session to send it over. */
      type: 'state-request';
    }
  | {
      /** The user did something in the sending tab, so nobody's idle countdown should be running. */
      type: 'activity';
    };

export type MultiTabSyncConfig = {
  channelName?: string;
  syncTokens?: boolean;
  syncLogout?: boolean;
};

/**
 * What the sync needs of the provider: the tokens to watch for outgoing messages, and the provider's own
 * two entry points to write an incoming one through.
 */
export type MultiTabSyncContext = {
  accessToken: Signal<string | null>;
  refreshToken: Signal<string | null>;

  /** Why the session this tab is broadcasting the end of ended, so the receiving tabs can report it too. */
  sessionEndCause: Signal<BearerAuthSessionEndCause | null>;

  /** The provider's name, which the default channel name is derived from. */
  name: string;

  /**
   * Whether this tab is the one that answers a joining tab's `state-request`. Leader-only, or every
   * open tab replies to every join at once. Reads `true` where there is no election, which is the
   * same thing: a tab that refreshes for itself also speaks for itself.
   */
  isLeader: () => boolean;

  /**
   * Applies an incoming token pair. Must be the provider's `applyTokens` rather than a write to the
   * token signals: a tab that received tokens has to emit `afterTokenRefresh$` too, or its secure
   * queries that already failed with a 401 never retry.
   */
  applyTokens: (access: string, refresh: string) => void;

  /**
   * Applies an incoming token pair that is this tab's whole session rather than a rotation of one it
   * already holds. Must be the provider's `setTokens`, so the session is reported as a token seed:
   * a tab that adopted its session never executed an auth query of its own, and everything waiting
   * for one - the secure queries, the app's own post-login handling - would wait forever.
   */
  setTokens: (access: string, refresh: string) => void;

  /**
   * Ends the session on an incoming logout. Must be the provider's own `logout`, so a tab that was
   * logged out elsewhere reports `{ type: 'logout' }` and abandons its unsaved changes like the tab
   * the logout started in.
   */
  logout: (cause?: BearerAuthSessionEndCause) => void;
};

/**
 * How an incoming logout reads in the receiving tab: a deliberate logout elsewhere is this tab's
 * `otherTab`, while a session that ended on its own ended for every tab, so that cause is carried
 * through. A message without one comes from a tab running an older version.
 */
const incomingCause = (cause: BearerAuthSessionEndCause | undefined): BearerAuthSessionEndCause =>
  !cause || cause === 'user' ? 'otherTab' : cause;

/**
 * The bounded wait a joining tab gives the leader to send the live session over. Short enough to be
 * invisible in front of the network request it defers, long enough for a same-origin channel message
 * plus the answer to come back.
 */
const sessionAdoptionTimeoutMs = 250;

/**
 * The join handshake, from the joining tab's side: it asked for the session and is holding anything
 * that would start a competing one until the answer arrives, or the wait runs out.
 */
export type BearerAuthSessionAdoption = {
  /** Whether the answer is still outstanding. `false` once tokens arrived, or the wait elapsed. */
  isPending: () => boolean;

  /** Resolves when tokens arrived or the wait elapsed - never rejects, and never waits forever. */
  settled: Promise<void>;
};

export type InternalMultiTabSync = {
  cleanup: () => void;

  /** Absent when there is nothing to adopt: no `BroadcastChannel`, or tokens are not synced. */
  sessionAdoption?: BearerAuthSessionAdoption;

  /**
   * Absent when no tab can end another one's session anyway: no `BroadcastChannel`, or
   * `syncLogout: false`.
   */
  activityCoordination?: BearerAuthActivityCoordination;
};

/**
 * The channel a provider syncs on unless the consumer names one. Carries the provider's name, so two
 * providers reachable from the same origin do not push each other's tokens around.
 */
export const defaultSyncChannelName = (name: string) => `ethlete-auth-sync:${name}`;

/** How a logout is recorded in {@link lastSyncedState}, where a token pair records its two tokens. */
const LOGGED_OUT = 'logout';

const tokenState = (access: string, refresh: string) => `${access}\0${refresh}`;

export const setupMultiTabSync = (config: MultiTabSyncConfig, context: MultiTabSyncContext): InternalMultiTabSync => {
  const destroyRef = inject(DestroyRef);

  const channelName = config.channelName ?? defaultSyncChannelName(context.name);
  const syncTokens = config.syncTokens ?? true;
  const syncLogout = config.syncLogout ?? true;

  if (typeof BroadcastChannel === 'undefined') {
    if (isDevMode()) {
      console.warn('BroadcastChannel is not supported in this environment. Multi-tab sync will be disabled.');
    }

    return {
      cleanup: () => {
        // No cleanup needed when BroadcastChannel is not available
      },
    };
  }

  const channel = new BroadcastChannel(channelName);

  // The session state this tab last sent or received, which is what stops an incoming message from being
  // echoed straight back out. A flag cleared once the message handler returns cannot do that job: the
  // broadcasting effects below run after it, so they would always see it cleared.
  let lastSyncedState: string | null = null;

  let hadTokens = false;

  let isAdoptionPending = false;
  let settleAdoption = () => {
    /* replaced below when the handshake actually runs */
  };

  const remoteActivity = new Subject<void>();

  channel.onmessage = (event: MessageEvent<SyncMessage>) => {
    const message = event.data;

    if (message.type === 'activity') {
      if (syncLogout) remoteActivity.next();

      return;
    }

    if (message.type === 'state-request') {
      if (!syncTokens || !context.isLeader()) return;

      const access = context.accessToken();
      const refresh = context.refreshToken();

      if (!access || !refresh) return;

      channel.postMessage({
        type: 'tokens-updated',
        accessToken: encryptToken(access),
        refreshToken: encryptToken(refresh),
      } satisfies SyncMessage);

      return;
    }

    if (message.type === 'logout' && syncLogout) {
      lastSyncedState = LOGGED_OUT;
      hadTokens = false;
      context.logout(incomingCause(message.cause));

      return;
    }

    if (message.type !== 'tokens-updated' || !syncTokens) return;

    const access = decryptToken(message.accessToken);
    const refresh = decryptToken(message.refreshToken);

    if (!access || !refresh) return;

    const isNewSession = !context.accessToken();

    lastSyncedState = tokenState(access, refresh);
    hadTokens = true;

    if (isNewSession) {
      context.setTokens(access, refresh);
    } else {
      context.applyTokens(access, refresh);
    }

    settleAdoption();
  };

  let adoptionTimeout: ReturnType<typeof setTimeout> | undefined;

  const cleanup = () => {
    clearTimeout(adoptionTimeout);
    settleAdoption();
    remoteActivity.complete();
    channel.close();
  };

  destroyRef.onDestroy(cleanup);

  // Sync is push-only otherwise: a tab only broadcasts tokens that just changed, so a tab joining a
  // live session would hear nothing and start its own login. Asking is the missing half.
  const sessionAdoption = syncTokens
    ? (() => {
        isAdoptionPending = true;

        const settled = new Promise<void>((resolve) => {
          settleAdoption = () => {
            if (!isAdoptionPending) return;

            isAdoptionPending = false;
            resolve();
          };
        });

        adoptionTimeout = setTimeout(settleAdoption, sessionAdoptionTimeoutMs);

        channel.postMessage({ type: 'state-request' } satisfies SyncMessage);

        return { isPending: () => isAdoptionPending, settled } satisfies BearerAuthSessionAdoption;
      })()
    : undefined;

  if (syncTokens) {
    effect(() => {
      const access = context.accessToken();
      const refresh = context.refreshToken();

      if (!access || !refresh) return;

      const state = tokenState(access, refresh);

      if (state === lastSyncedState) return;

      lastSyncedState = state;

      const message: SyncMessage = {
        type: 'tokens-updated',
        accessToken: encryptToken(access),
        refreshToken: encryptToken(refresh),
      };

      channel.postMessage(message);
    });
  }

  if (syncLogout) {
    effect(() => {
      const access = context.accessToken();

      if (access) {
        hadTokens = true;

        return;
      }

      if (!hadTokens) return;

      hadTokens = false;

      if (lastSyncedState === LOGGED_OUT) return;

      lastSyncedState = LOGGED_OUT;

      const message: SyncMessage = { type: 'logout', cause: untracked(context.sessionEndCause) ?? undefined };

      channel.postMessage(message);
    });
  }

  // Only where a logout travels: with `syncLogout: false` each tab already ends its own session and
  // nothing else's, so its idleness is genuinely its own.
  const activityCoordination = syncLogout
    ? {
        announce: () => channel.postMessage({ type: 'activity' } satisfies SyncMessage),
        activity$: remoteActivity.asObservable(),
      }
    : undefined;

  return { cleanup, sessionAdoption, activityCoordination };
};
