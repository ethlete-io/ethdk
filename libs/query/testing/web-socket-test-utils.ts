import type {
  SocketMessageView,
  WebSocketClientIo,
  WebSocketClientIoOptions,
  WebSocketClientSocket,
} from '@ethlete/query';

/** A scripted stand-in for `socket.io-client`'s `io`, driven from a spec. */
export type WebSocketTestDouble = {
  /** Pass this as `createWebSocketClient({ io })`. */
  io: WebSocketClientIo;

  /** The url and options the client called the factory with, or `null` until it did. */
  connection: () => { url: string; transports: string[] | undefined } | null;

  /** The `withCredentials` the client asked the factory for, or `null` until it called it. */
  withCredentials: () => boolean | null;

  /** The auth payload of every handshake, oldest first - `null` for one made without `auth`. */
  handshakes: () => (object | null)[];

  /** Every message the client emitted, newest last - room joins and leaves included, buffered ones too. */
  sent: () => { event: string; data: unknown }[];

  /** Every message that reached the server, newest last. An emit buffered while offline lands here on the next connect. */
  delivered: () => { event: string; data: unknown }[];

  /**
   * Whether the client asked the socket to connect, and whether it has since disconnected it. `active` is
   * socket.io's own flag - `false` after a server disconnect or a rejected handshake, until the next
   * `connect()`; `connectCalls` counts every `connect()`.
   */
  state: () => { connectRequested: boolean; disconnected: boolean; active: boolean; connectCalls: number };

  /**
   * Complete the handshake: flush every buffered emit, then turn the client's `isConnected` true. Pass
   * `recovered: true` for a connection-state-recovered reconnect, in which the server kept the rooms.
   */
  serverConnect: (options?: { recovered?: boolean }) => void;

  /**
   * Drop the connection, so `isConnected` turns false. The default reason, `'transport close'`, is one
   * socket.io recovers from itself; `'io server disconnect'` is the server kicking the socket, after which
   * socket.io only reconnects when `connect()` is called again.
   */
  serverDisconnect: (options?: { reason?: 'transport close' | 'io server disconnect' }) => void;

  /**
   * Reject the handshake the way a server middleware does: the `auth` payload is recorded in
   * {@link handshakes}, `connect_error` fires and the socket stops reconnecting on its own.
   */
  serverRejectHandshake: (message?: string) => void;

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
  const listeners = {
    connect: [] as (() => void)[],
    disconnect: [] as ((reason: string) => void)[],
    connect_error: [] as ((error: Error) => void)[],
  };
  const anyListeners: ((eventName: string, ...args: unknown[]) => void)[] = [];
  const outgoingListeners: ((eventName: string, ...args: unknown[]) => void)[] = [];

  let connection: { url: string; transports: string[] | undefined } | null = null;
  let withCredentials: boolean | null = null;
  let auth: WebSocketClientIoOptions['auth'];
  const handshakes: (object | null)[] = [];
  let connectRequested = false;
  let disconnected = false;
  let connected = false;
  let active = false;
  let connectCalls = 0;
  let pingExpired = false;
  let recovered = false;

  const deliver = (message: { event: string; data: unknown }) => {
    for (const listener of outgoingListeners) listener(message.event, message.data);
    delivered.push(message);
  };

  const recordHandshake = () => {
    if (auth) auth((data) => handshakes.push(data));
    else handshakes.push(null);
  };

  const disconnect = (reason: string) => {
    connected = false;
    pingExpired = false;
    for (const listener of listeners.disconnect) listener(reason);
  };

  const socket: WebSocketClientSocket = {
    connect: () => {
      connectRequested = true;
      active = true;
      connectCalls++;
    },
    disconnect: () => {
      disconnected = true;
      active = false;
      if (connected) disconnect('io client disconnect');
    },
    emit: (event, data) => {
      sent.push({ event, data });

      if (connected && !pingExpired) deliver({ event, data });
      else buffered.push({ event, data });
    },
    on: (event: 'connect' | 'disconnect' | 'connect_error', listener: (arg: never) => void) =>
      void (listeners[event] as ((arg: never) => void)[]).push(listener),
    onAny: (listener) => void anyListeners.push(listener),
    onAnyOutgoing: (listener) => void outgoingListeners.push(listener),
    get recovered() {
      return recovered;
    },
    get active() {
      return active;
    },
  };

  return {
    io: (url, options) => {
      connection = { url, transports: options.transports };
      withCredentials = options.withCredentials;
      auth = options.auth;
      return socket;
    },
    connection: () => connection,
    withCredentials: () => withCredentials,
    handshakes: () => [...handshakes],
    sent: () => [...sent],
    delivered: () => [...delivered],
    state: () => ({ connectRequested, disconnected, active, connectCalls }),
    serverConnect: (options) => {
      recordHandshake();

      active = true;
      recovered = options?.recovered ?? false;
      connected = true;
      pingExpired = false;

      for (const message of buffered.splice(0)) deliver(message);

      for (const listener of listeners.connect) listener();
    },
    serverDisconnect: (options) => {
      const reason = options?.reason ?? 'transport close';

      if (reason === 'io server disconnect') active = false;

      disconnect(reason);
    },
    serverRejectHandshake: (message) => {
      recordHandshake();

      active = false;

      for (const listener of listeners.connect_error) listener(new Error(message ?? 'unauthorized'));
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
