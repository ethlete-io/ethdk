import type { SocketMessageView, WebSocketClientIo, WebSocketClientSocket } from '@ethlete/query';

/** A scripted stand-in for `socket.io-client`'s `io`, driven from a spec. */
export type WebSocketTestDouble = {
  /** Pass this as `createWebSocketClient({ io })`. */
  io: WebSocketClientIo;

  /** The url and options the client called the factory with, or `null` until it did. */
  connection: () => { url: string; transports: string[] | undefined } | null;

  /** Every message the client sent, newest last - room joins and leaves included. */
  sent: () => { event: string; data: unknown }[];

  /** Whether the client asked the socket to connect, and whether it has since disconnected it. */
  state: () => { connectRequested: boolean; disconnected: boolean };

  /** Complete the handshake, so the client's `isConnected` turns true and queued rooms re-join. */
  serverConnect: () => void;

  /** Drop the connection, so `isConnected` turns false. */
  serverDisconnect: () => void;

  /** Deliver a message the way the server would. */
  serverSend: (message: SocketMessageView) => void;

  /** Deliver a raw frame, for the malformed-payload path. */
  serverSendRaw: (frame: string) => void;
};

/**
 * A socket io test double, for specs around `createWebSocketClient` - which takes its `io` factory as
 * an option precisely so a spec (or an app that never opens a socket) needs no `socket.io-client`.
 *
 * Nothing here connects on its own: the client's own `connect()` only flips
 * {@link WebSocketTestDouble.state}, and it is {@link WebSocketTestDouble.serverConnect} that fires
 * the `connect` listener. That split is what makes "joined a room while disconnected, and the join
 * was re-sent on connect" testable.
 */
export const createWebSocketTestDouble = (): WebSocketTestDouble => {
  const sent: { event: string; data: unknown }[] = [];
  const listeners = new Map<'connect' | 'disconnect', () => void>();
  const anyListeners: ((eventName: string, ...args: unknown[]) => void)[] = [];

  let connection: { url: string; transports: string[] | undefined } | null = null;
  let connectRequested = false;
  let disconnected = false;

  const socket: WebSocketClientSocket = {
    connect: () => void (connectRequested = true),
    disconnect: () => void (disconnected = true),
    emit: (event, data) => void sent.push({ event, data }),
    on: (event, listener) => void listeners.set(event, listener),
    onAny: (listener) => void anyListeners.push(listener),
  };

  return {
    io: (url, options) => {
      connection = { url, transports: options.transports };
      return socket;
    },
    connection: () => connection,
    sent: () => [...sent],
    state: () => ({ connectRequested, disconnected }),
    serverConnect: () => listeners.get('connect')?.(),
    serverDisconnect: () => listeners.get('disconnect')?.(),
    serverSend: (message) => {
      const frame = JSON.stringify(message);
      for (const listener of anyListeners) listener('message', frame);
    },
    serverSendRaw: (frame) => {
      for (const listener of anyListeners) listener('message', frame);
    },
  };
};
