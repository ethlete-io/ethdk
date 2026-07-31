import { isDevMode } from '@angular/core';
import { QuerySyncMessage, unwrapQuerySyncMessage, wrapQuerySyncMessage } from './query-sync-message';

export type QuerySyncMessageListener = (message: QuerySyncMessage) => void;

/**
 * The channel a query client talks to its other tabs over. Wraps `BroadcastChannel` so the message
 * envelope, the version check and the "not available here" case all live in one place.
 */
export type QuerySyncTransport = {
  /** Broadcasts a message to every other tab listening on the same channel. */
  post: (message: QuerySyncMessage) => void;

  /** Registers a listener for messages from other tabs. Returns an unlisten function. */
  listen: (listener: QuerySyncMessageListener) => () => void;

  /** Closes the underlying channel and drops every listener. */
  destroy: () => void;

  /**
   * Whether a real channel backs this transport. `false` means every method is a no-op — no
   * `BroadcastChannel` in this environment (the server, or a very old browser).
   */
  isSupported: boolean;
};

const noop = () => undefined;

export const createQuerySyncTransport = (channelName: string): QuerySyncTransport => {
  if (typeof BroadcastChannel === 'undefined') {
    return { post: noop, listen: () => noop, destroy: noop, isSupported: false };
  }

  const channel = new BroadcastChannel(channelName);
  const listeners = new Set<QuerySyncMessageListener>();

  // One `onmessage` fanning out to a Set rather than letting each caller own the property: the sync
  // engine and (later) other internals all need to listen, and the last one to assign would win.
  channel.onmessage = (event: MessageEvent<unknown>) => {
    const message = unwrapQuerySyncMessage(event.data);

    if (!message) return;

    for (const listener of listeners) {
      listener(message);
    }
  };

  const post = (message: QuerySyncMessage) => {
    try {
      channel.postMessage(wrapQuerySyncMessage(message));
    } catch (error) {
      // A body the structured clone algorithm cannot handle throws `DataCloneError`. Swallowing it
      // keeps the repository event subscription this runs inside alive — the only cost of a
      // non-cloneable response is that the other tabs do not learn about it.
      if (isDevMode()) {
        console.warn(`[@ethlete/query] Could not broadcast a message on "${channelName}".`, error);
      }
    }
  };

  const listen = (listener: QuerySyncMessageListener) => {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  };

  const destroy = () => {
    listeners.clear();
    channel.close();
  };

  return { post, listen, destroy, isSupported: true };
};
