import { DestroyRef, inject, isDevMode, signal, Signal } from '@angular/core';

type LeaderMessage =
  | {
      type: 'heartbeat';
      tabId: string;
    }
  | {
      type: 'tab-heartbeat';
      tabId: string;
    }
  | {
      type: 'leader-claim';
      tabId: string;
    }
  | {
      type: 'leader-release';
      tabId: string;
    }
  | {
      type: 'instance-register';
      tabId: string;
    }
  | {
      type: 'instance-unregister';
      tabId: string;
    };

export type InternalLeaderElection = {
  isLeader: Signal<boolean>;
  instanceCount: Signal<number>;
  becomeLeader: () => void;
  cleanup: () => void;
};

export const setupLeaderElection = (): InternalLeaderElection => {
  const destroyRef = inject(DestroyRef);

  const channelName = 'ethlete-auth-leader';
  const heartbeatInterval = 1000;
  const leaderTimeout = 3000;
  const storageKey = 'ethlete-auth-leader-heartbeat';

  const tabId = `tab-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const isLeader = signal(false);
  const instanceCount = signal(1);
  const knownTabs = new Map<string, number>();
  knownTabs.set(tabId, Date.now());

  let channel: BroadcastChannel | null = null;
  let heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
  let leaderCheckIntervalId: ReturnType<typeof setInterval> | null = null;

  if (typeof BroadcastChannel === 'undefined' || typeof localStorage === 'undefined') {
    isLeader.set(true);
    return {
      isLeader: isLeader.asReadonly(),
      instanceCount: instanceCount.asReadonly(),
      becomeLeader: () => {
        /* no-op */
      },
      cleanup: () => {
        /* no-op */
      },
    };
  }

  channel = new BroadcastChannel(channelName);

  channel.postMessage({ type: 'instance-register', tabId } as LeaderMessage);

  const updateLeaderHeartbeat = (newTabId: string = tabId) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ tabId: newTabId, timestamp: Date.now() }));
    } catch (error) {
      if (isDevMode()) {
        console.error('Failed to update leader heartbeat:', error);
      }
    }
  };

  const getLeaderHeartbeat = (): { tabId: string; timestamp: number } | null => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch {
      return null;
    }
  };

  const becomeLeader = () => {
    if (isLeader()) return;

    isLeader.set(true);
    updateLeaderHeartbeat();

    const message: LeaderMessage = {
      type: 'leader-claim',
      tabId,
    };
    channel?.postMessage(message);
  };

  const releaseLeadership = () => {
    if (!isLeader()) return;

    isLeader.set(false);

    const message: LeaderMessage = {
      type: 'leader-release',
      tabId,
    };
    channel?.postMessage(message);
  };

  const checkLeaderStatus = () => {
    const heartbeat = getLeaderHeartbeat();
    const now = Date.now();

    if (!heartbeat || now - heartbeat.timestamp > leaderTimeout) {
      if (!isLeader()) {
        becomeLeader();
      }
    } else if (heartbeat.tabId === tabId) {
      if (!isLeader()) {
        isLeader.set(true);
      }
      updateLeaderHeartbeat();
    } else {
      if (isLeader()) {
        isLeader.set(false);
      }
    }
  };

  channel.onmessage = (event: MessageEvent<LeaderMessage>) => {
    const message = event.data;

    if (message.type === 'heartbeat') {
      if (message.tabId !== tabId) {
        knownTabs.set(message.tabId, Date.now());
      }
      if (message.tabId !== tabId && isLeader()) {
        const heartbeat = getLeaderHeartbeat();
        if (heartbeat && heartbeat.tabId === message.tabId) {
          releaseLeadership();
        }
      }
    } else if (message.type === 'tab-heartbeat') {
      if (message.tabId !== tabId) {
        knownTabs.set(message.tabId, Date.now());
      }
    } else if (message.type === 'instance-register') {
      if (message.tabId !== tabId) {
        knownTabs.set(message.tabId, Date.now());
        instanceCount.set(knownTabs.size);
        channel?.postMessage({ type: 'tab-heartbeat', tabId } as LeaderMessage);
      }
    } else if (message.type === 'instance-unregister') {
      if (message.tabId !== tabId) {
        knownTabs.delete(message.tabId);
        instanceCount.set(knownTabs.size);
      }
    } else if (message.type === 'leader-claim') {
      if (message.tabId !== tabId && isLeader()) {
        const heartbeat = getLeaderHeartbeat();
        if (heartbeat && heartbeat.tabId === message.tabId) {
          releaseLeadership();
        } else {
          const assertMessage: LeaderMessage = {
            type: 'heartbeat',
            tabId,
          };
          channel?.postMessage(assertMessage);
        }
      }
    } else if (message.type === 'leader-release') {
      if (message.tabId !== tabId) {
        setTimeout(() => checkLeaderStatus(), 100);
      }
    }
  };

  checkLeaderStatus();

  heartbeatIntervalId = setInterval(() => {
    knownTabs.set(tabId, Date.now());

    if (isLeader()) {
      updateLeaderHeartbeat();
      channel?.postMessage({ type: 'heartbeat', tabId } as LeaderMessage);
    } else {
      channel?.postMessage({ type: 'tab-heartbeat', tabId } as LeaderMessage);
    }

    const now = Date.now();
    let changed = false;
    for (const [id, lastSeen] of knownTabs) {
      if (id !== tabId && now - lastSeen > leaderTimeout) {
        knownTabs.delete(id);
        changed = true;
      }
    }
    if (changed) {
      instanceCount.set(knownTabs.size);
    }
  }, heartbeatInterval);

  leaderCheckIntervalId = setInterval(() => {
    checkLeaderStatus();
  }, heartbeatInterval);

  const handleVisibilityChange = () => {
    if (document.hidden && isLeader()) {
      // Tab is hidden but we're leader - keep leadership but other tabs will take over if we die
    } else if (!document.hidden && !isLeader()) {
      checkLeaderStatus();
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  const cleanup = () => {
    if (heartbeatIntervalId) {
      clearInterval(heartbeatIntervalId);
    }
    if (leaderCheckIntervalId) {
      clearInterval(leaderCheckIntervalId);
    }

    channel?.postMessage({ type: 'instance-unregister', tabId } as LeaderMessage);

    releaseLeadership();

    document.removeEventListener('visibilitychange', handleVisibilityChange);
    channel?.close();

    const heartbeat = getLeaderHeartbeat();
    if (heartbeat?.tabId === tabId) {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // Ignore
      }
    }
  };

  destroyRef.onDestroy(cleanup);

  return {
    isLeader: isLeader.asReadonly(),
    instanceCount: instanceCount.asReadonly(),
    becomeLeader,
    cleanup,
  };
};
