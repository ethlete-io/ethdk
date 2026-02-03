import { DestroyRef, inject, isDevMode, signal, Signal } from '@angular/core';

type LeaderMessage =
  | {
      type: 'heartbeat';
      tabId: string;
    }
  | {
      type: 'leader-claim';
      tabId: string;
    }
  | {
      type: 'leader-release';
      tabId: string;
    };

export type InternalLeaderElection = {
  isLeader: Signal<boolean>;
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

  let channel: BroadcastChannel | null = null;
  let heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
  let leaderCheckIntervalId: ReturnType<typeof setInterval> | null = null;

  if (typeof BroadcastChannel === 'undefined' || typeof localStorage === 'undefined') {
    isLeader.set(true);
    return {
      isLeader: isLeader.asReadonly(),
      becomeLeader: () => {
        /* no-op */
      },
      cleanup: () => {
        /* no-op */
      },
    };
  }

  channel = new BroadcastChannel(channelName);

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
      // No leader or leader is dead
      if (!isLeader()) {
        becomeLeader();
      }
    } else if (heartbeat.tabId === tabId) {
      // We are the leader, update heartbeat
      if (!isLeader()) {
        isLeader.set(true);
      }
      updateLeaderHeartbeat();
    } else {
      // Another tab is leader
      if (isLeader()) {
        isLeader.set(false);
      }
    }
  };

  // Handle messages from other tabs
  channel.onmessage = (event: MessageEvent<LeaderMessage>) => {
    const message = event.data;

    if (message.type === 'heartbeat') {
      if (message.tabId !== tabId && isLeader()) {
        // Another tab claims to be leader, resolve conflict
        const heartbeat = getLeaderHeartbeat();
        if (heartbeat && heartbeat.tabId === message.tabId) {
          // Other tab is legitimate leader
          releaseLeadership();
        }
      }
    } else if (message.type === 'leader-claim') {
      if (message.tabId !== tabId && isLeader()) {
        // Conflict: both tabs think they're leader
        // Let the tab with earlier heartbeat win
        const heartbeat = getLeaderHeartbeat();
        if (heartbeat && heartbeat.tabId === message.tabId) {
          releaseLeadership();
        } else {
          // We were leader first, send heartbeat to assert dominance
          const assertMessage: LeaderMessage = {
            type: 'heartbeat',
            tabId,
          };
          channel?.postMessage(assertMessage);
        }
      }
    } else if (message.type === 'leader-release') {
      if (message.tabId !== tabId) {
        // Leader released, try to become new leader
        setTimeout(() => checkLeaderStatus(), 100);
      }
    }
  };

  // Try to become leader on startup
  checkLeaderStatus();

  // Send heartbeat periodically if we're the leader
  heartbeatIntervalId = setInterval(() => {
    if (isLeader()) {
      updateLeaderHeartbeat();

      const message: LeaderMessage = {
        type: 'heartbeat',
        tabId,
      };
      channel?.postMessage(message);
    }
  }, heartbeatInterval);

  // Check leader status periodically
  leaderCheckIntervalId = setInterval(() => {
    checkLeaderStatus();
  }, heartbeatInterval);

  // Handle tab visibility changes
  const handleVisibilityChange = () => {
    if (document.hidden && isLeader()) {
      // Tab is hidden but we're leader - keep leadership but other tabs will take over if we die
    } else if (!document.hidden && !isLeader()) {
      // Tab became visible and we're not leader - check if we should become leader
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

    releaseLeadership();

    document.removeEventListener('visibilitychange', handleVisibilityChange);
    channel?.close();

    // Clean up storage if we were the leader
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
    becomeLeader,
    cleanup,
  };
};
