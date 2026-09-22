import type { SocketMessageView, WebSocketClientIo, WebSocketClientSocket } from '@ethlete/query';

/** A scripted stand-in for `socket.io-client`'s `io`, driven from a spec. */
export type WebSocketTestDouble = {
  /** Pass this as `createWebSocketClient({ io })`. */
  io: WebSocketClientIo;

  /** The url and options the client called the factory with, or `null` until it did. */
  connection: () => { url: string; transports: string[] | undefined } | null;

  /** The `withCredentials` the client asked the factory for, or `null` until it called it. */
  withCredentials: () => boolean | null;

  /** Every message the client emitted, newest last - room joins and leaves included, buffered ones too. */
  sent: () => { event: string; data: unknown }[];

  /** Every message that reached the server, newest last. An emit buffered while offline lands here on the next connect. */
  delivered: () => { event: string; data: unknown }[];

  /** Whether the client asked the socket to connect, and whether it has since disconnected it. */
  state: () => { connectRequested: boolean; disconnected: boolean };

  /**
   * Complete the handshake: flush every buffered emit, then turn the client's `isConnected` true. Pass
   * `recovered: true` for a connection-state-recovered reconnect, in which the server kept the rooms.
   */
  serverConnect: (options?: { recovered?: boolean }) => void;

  /** Drop the connection, so `isConnected` turns false. */
  serverDisconnect: () => void;

  /**
   * Let the ping expire: the socket still reports itself connected, but buffers every emit like socket.io
   * does until it notices and closes. Follow it with {@link serverDisconnect}.
   */
  serverPingExpire: () => void;

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
 * the `connect` listener. That split is what makes "joined a room while disconnected, and it was
 * re-joined after a reconnect" testable.
 */
export const createWebSocketTestDouble = (): WebSocketTestDouble => {
  const sent: { event: string; data: unknown }[] = [];
  const delivered: { event: string; data: unknown }[] = [];
  const buffered: { event: string; data: unknown }[] = [];
  const listeners = new Map<'connect' | 'disconnect', () => void>();
  const anyListeners: ((eventName: string, ...args: unknown[]) => void)[] = [];
  const outgoingListeners: ((eventName: string, ...args: unknown[]) => void)[] = [];

  let connection: { url: string; transports: string[] | undefined } | null = null;
  let withCredentials: boolean | null = null;
  let connectRequested = false;
  let disconnected = false;
  let connected = false;
  let pingExpired = false;
  let recovered = false;

  const deliver = (message: { event: string; data: unknown }) => {
    for (const listener of outgoingListeners) listener(message.event, message.data);
    delivered.push(message);
  };

  const socket: WebSocketClientSocket = {
    connect: () => void (connectRequested = true),
    disconnect: () => void (disconnected = true),
    emit: (event, data) => {
      sent.push({ event, data });

      if (connected && !pingExpired) deliver({ event, data });
      else buffered.push({ event, data });
    },
    on: (event, listener) => void listeners.set(event, listener),
    onAny: (listener) => void anyListeners.push(listener),
    onAnyOutgoing: (listener) => void outgoingListeners.push(listener),
    get recovered() {
      return recovered;
    },
  };

  return {
    io: (url, options) => {
      connection = { url, transports: options.transports };
      withCredentials = options.withCredentials;
      return socket;
    },
    connection: () => connection,
    withCredentials: () => withCredentials,
    sent: () => [...sent],
    delivered: () => [...delivered],
    state: () => ({ connectRequested, disconnected }),
    serverConnect: (options) => {
      recovered = options?.recovered ?? false;
      connected = true;
      pingExpired = false;

      for (const message of buffered.splice(0)) deliver(message);

      listeners.get('connect')?.();
    },
    serverDisconnect: () => {
      connected = false;
      pingExpired = false;
      listeners.get('disconnect')?.();
    },
    serverPingExpire: () => void (pingExpired = true),
    serverSend: (message) => {
      const frame = JSON.stringify(message);
      for (const listener of anyListeners) listener('message', frame);
    },
    serverSendRaw: (frame) => {
      for (const listener of anyListeners) listener('message', frame);
    },
  };
};
