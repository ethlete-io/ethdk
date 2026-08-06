import { Signal, signal } from '@angular/core';
import {
  AnyQueryBuilder,
  BearerAuthFeatureType,
  BearerAuthProviderEarlySetup,
  BearerAuthProviderEarlySetupContext,
  BearerAuthProviderFeatureContext,
} from '../bearer-auth-provider';
import { defaultSyncChannelName, setupLeaderElection, setupMultiTabSync } from '../internal';

export type BearerAuthMultiTabSyncConfig = {
  /**
   * Channel name for BroadcastChannel. Defaults to a channel of the provider's own, so two providers
   * reachable from the same origin do not sync each other's sessions.
   * @default `ethlete-auth-sync:<provider name>`
   */
  channelName?: string;

  /**
   * Whether to sync token updates across tabs
   * @default true
   */
  syncTokens?: boolean;

  /**
   * Whether to sync logout across tabs
   * @default true
   */
  syncLogout?: boolean;

  /**
   * Whether to elect one tab to perform the automatic token refreshes. With this off every tab
   * refreshes on its own.
   * @default true
   */
  leaderElection?: boolean;
};

export type BearerAuthMultiTabSyncFeature = {
  /** Whether this tab is the one performing the automatic token refresh. */
  isLeader: Signal<boolean>;

  /** How many tabs of this app currently take part in the election. Telemetry only. */
  instanceCount: Signal<number>;
};

const SINGLE_TAB = /* @__PURE__ */ (() => {
  const isLeader = signal(true).asReadonly();
  const instanceCount = signal(1).asReadonly();

  return { isLeader, instanceCount };
})();

/**
 * Keeps one browser session consistent across the user's tabs: a login in one tab logs the others in,
 * a logout logs them out, and only one tab (the leader) performs the automatic token refresh so a
 * single-use refresh token is not spent twice.
 *
 * Off by default - a single-tab app, a kiosk or an embedded webview ships neither the
 * `BroadcastChannel` sync nor the Web Locks leader election without it. Degrades to "this tab is the
 * leader" in a browser without Web Locks, and warns in dev mode without `BroadcastChannel`.
 *
 * Without this feature every tab is its own leader, which is exactly right when there is only one.
 *
 * @example
 * export const AUTH_PROVIDER = createBearerAuthProvider({
 *   name: 'my-auth',
 *   queryClientRef: MY_CLIENT,
 *   queries: [loginQuery, refreshQuery],
 *   features: [withBearerAuthMultiTabSync()],
 * });
 *
 * // provider.features.multiTabSync.isLeader()
 */
export const withBearerAuthMultiTabSync = <TBuilders extends readonly AnyQueryBuilder[]>(
  config: BearerAuthMultiTabSyncConfig = {},
) => {
  let instance: BearerAuthMultiTabSyncFeature = SINGLE_TAB;
  let channelName = config.channelName ?? '';

  const setup = (_context: BearerAuthProviderFeatureContext<unknown, TBuilders>) => ({
    type: BearerAuthFeatureType.MULTI_TAB_SYNC,
    instance,
    devtools: () => [
      { label: 'channel', value: channelName },
      { label: 'tokens', value: config.syncTokens === false ? 'tab local' : 'synced' },
      { label: 'logout', value: config.syncLogout === false ? 'tab local' : 'synced' },
      {
        label: 'leader election',
        value: config.leaderElection === false ? 'every tab refreshes' : 'one tab refreshes',
      },
    ],
  });

  // The elected leader gates the auth queries' automatic refresh, which is wired up before the
  // regular feature setup runs - so this half has to happen earlier than `setup`.
  const earlySetup: BearerAuthProviderEarlySetup['earlySetup'] = (context: BearerAuthProviderEarlySetupContext) => {
    channelName = config.channelName ?? defaultSyncChannelName(context.name);

    setupMultiTabSync(
      { channelName, syncTokens: config.syncTokens, syncLogout: config.syncLogout },
      {
        accessToken: context.accessToken,
        refreshToken: context.refreshToken,
        name: context.name,
        applyTokens: context.applyTokens,
        logout: context.logout,
      },
    );

    if (config.leaderElection === false) return {};

    const election = setupLeaderElection({ name: context.name });

    instance = { isLeader: election.isLeader, instanceCount: election.instanceCount };

    return { isLeader: () => election.isLeader(), leaderElection: instance };
  };

  return Object.assign(setup, { earlySetup });
};
