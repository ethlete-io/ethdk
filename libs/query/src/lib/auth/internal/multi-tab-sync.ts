import { DestroyRef, effect, inject, isDevMode, Signal, untracked } from '@angular/core';
import { BearerAuthSessionEndCause } from '../bearer-auth-provider';
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
   * Applies an incoming token pair. Must be the provider's `applyTokens` rather than a write to the
   * token signals: a tab that received tokens has to emit `afterTokenRefresh$` too, or its secure
   * queries that already failed with a 401 never retry.
   */
  applyTokens: (access: string, refresh: string) => void;

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

export type InternalMultiTabSync = {
  cleanup: () => void;
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

  channel.onmessage = (event: MessageEvent<SyncMessage>) => {
    const message = event.data;

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

    lastSyncedState = tokenState(access, refresh);
    hadTokens = true;
    context.applyTokens(access, refresh);
  };

  const cleanup = () => {
    channel.close();
  };

  destroyRef.onDestroy(cleanup);

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

  return { cleanup };
};
