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
  /**
   * Whether this tab is the one performing the automatic token refresh. It follows the user: a tab
   * that becomes hidden gives the leadership up, a tab that becomes visible claims it, and a tab that
   * stopped running has it taken off it.
   */
  isLeader: Signal<boolean>;

  /** How many tabs of this app currently take part in the election. Telemetry only. */
  instanceCount: Signal<number>;

  /**
   * How {@link isLeader} was decided. `election` - a Web Locks election is running and exactly one
   * tab reads as the leader. `off` - `leaderElection: false`, so every tab refreshes and every tab
   * reads as the leader. `unsupported` - the browser has no Web Locks, which has the same effect,
   * and leaves {@link instanceCount} at one.
   */
  leadership: 'election' | 'off' | 'unsupported';
};

const SINGLE_TAB = /* @__PURE__ */ (() => {
  const isLeader = signal(true).asReadonly();
  const instanceCount = signal(1).asReadonly();

  return { isLeader, instanceCount, leadership: 'off' } satisfies BearerAuthMultiTabSyncFeature;
})();

/**
 * Keeps one browser session consistent across the user's tabs: a login in one tab logs the others in,
 * a logout logs them out, and only one tab (the leader) performs the automatic token refresh so a
 * single-use refresh token is not spent twice. The leadership follows the tab the user is looking at,
 * because a hidden tab has its timers throttled and a frozen one runs none at all.
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
  const pendingSetups: { instance: BearerAuthMultiTabSyncFeature; channelName: string }[] = [];

  const setup = (context: BearerAuthProviderFeatureContext<unknown, TBuilders>) => {
    const state = pendingSetups.shift() ?? {
      instance: SINGLE_TAB,
      channelName: config.channelName ?? defaultSyncChannelName(context.name),
    };

    return {
      type: BearerAuthFeatureType.MULTI_TAB_SYNC,
      instance: state.instance,
      devtools: () => [
        { label: 'channel', value: state.channelName },
        { label: 'tokens', value: config.syncTokens === false ? 'tab local' : 'synced' },
        { label: 'logout', value: config.syncLogout === false ? 'tab local' : 'synced' },
        {
          label: 'leader election',
          value: config.leaderElection === false ? 'every tab refreshes' : 'one tab refreshes',
        },
      ],
    };
  };

  // The elected leader gates the auth queries' automatic refresh, which is wired up before the
  // regular feature setup runs - so this half has to happen earlier than `setup`.
  const earlySetup: BearerAuthProviderEarlySetup['earlySetup'] = (context: BearerAuthProviderEarlySetupContext) => {
    const channelName = config.channelName ?? defaultSyncChannelName(context.name);

    // Filled in below once the election exists. Until then this tab answers as its own leader, which
    // is what it is: the sync is set up first because the auth queries read `isLeader` while being
    // wired, and a `state-request` cannot arrive before this function returns anyway.
    let isLeaderRef: () => boolean = () => true;

    const sync = setupMultiTabSync(
      { channelName, syncTokens: config.syncTokens, syncLogout: config.syncLogout },
      {
        accessToken: context.accessToken,
        refreshToken: context.refreshToken,
        sessionEndCause: context.sessionEndCause,
        name: context.name,
        isLeader: () => isLeaderRef(),
        applyTokens: context.applyTokens,
        setTokens: context.setTokens,
        logout: context.logout,
      },
    );

    if (config.leaderElection === false) {
      pendingSetups.push({ instance: SINGLE_TAB, channelName });

      return { sessionAdoption: sync.sessionAdoption, activityCoordination: sync.activityCoordination };
    }

    const election = setupLeaderElection({ name: context.name });

    isLeaderRef = () => election.isLeader();

    const instance: BearerAuthMultiTabSyncFeature = {
      isLeader: election.isLeader,
      instanceCount: election.instanceCount,
      leadership: election.isSupported ? 'election' : 'unsupported',
    };
    pendingSetups.push({ instance, channelName });

    return {
      isLeader: () => election.isLeader(),
      leaderElection: instance,
      refreshCoordination: {
        request: election.requestRefresh,
        requests$: election.refreshRequests$,
        announceStart: election.announceRefreshStart,
        starts$: election.refreshStarts$,
      },
      sessionAdoption: sync.sessionAdoption,
      activityCoordination: sync.activityCoordination,
    };
  };

  return Object.assign(setup, { earlySetup });
};
