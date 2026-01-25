import { DestroyRef, effect, inject, isDevMode, WritableSignal } from '@angular/core';
import { QueryClient } from '../../http';
import { decryptToken, encryptToken } from '../utils';

type SyncMessage =
  | {
      type: 'tokens-updated';
      accessToken: string;
      refreshToken: string;
    }
  | {
      type: 'logout';
    };

export type MultiTabSyncConfig = {
  channelName?: string;
  syncTokens?: boolean;
  syncLogout?: boolean;
};

export type InternalMultiTabSync = {
  cleanup: () => void;
};

export const setupMultiTabSync = (
  config: MultiTabSyncConfig,
  accessToken: WritableSignal<string | null>,
  refreshToken: WritableSignal<string | null>,
  queryClient: QueryClient,
): InternalMultiTabSync => {
  const destroyRef = inject(DestroyRef);

  const channelName = config.channelName ?? 'ethlete-auth-sync';
  const syncTokens = config.syncTokens ?? true;
  const syncLogout = config.syncLogout ?? true;

  let channel: BroadcastChannel | null = null;
  let isProcessingExternalUpdate = false;

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

  channel = new BroadcastChannel(channelName);

  channel.onmessage = (event: MessageEvent<SyncMessage>) => {
    const message = event.data;

    // Prevent infinite loops
    if (isProcessingExternalUpdate) return;

    isProcessingExternalUpdate = true;

    try {
      if (message.type === 'logout' && syncLogout) {
        accessToken.set(null);
        refreshToken.set(null);
        queryClient.repository.unbindAllSecure();
      } else if (message.type === 'tokens-updated' && syncTokens) {
        accessToken.set(decryptToken(message.accessToken));
        refreshToken.set(decryptToken(message.refreshToken));
      }
    } finally {
      isProcessingExternalUpdate = false;
    }
  };

  const cleanup = () => {
    channel?.close();
  };

  destroyRef.onDestroy(cleanup);

  if (syncTokens) {
    effect(() => {
      const access = accessToken();
      const refresh = refreshToken();

      if (access && refresh && !isProcessingExternalUpdate && channel) {
        const message: SyncMessage = {
          type: 'tokens-updated',
          accessToken: encryptToken(access),
          refreshToken: encryptToken(refresh),
        };
        channel.postMessage(message);
      }
    });
  }

  if (syncLogout) {
    let hadTokens = false;

    effect(() => {
      const access = accessToken();

      if (access) {
        hadTokens = true;
      } else if (hadTokens && !isProcessingExternalUpdate && channel) {
        const message: SyncMessage = {
          type: 'logout',
        };
        channel.postMessage(message);
        hadTokens = false;
      }
    });
  }

  return { cleanup };
};
