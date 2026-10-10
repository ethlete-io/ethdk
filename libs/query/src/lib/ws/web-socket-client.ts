import { isPlatformServer } from '@angular/common';
import {
  assertInInjectionContext,
  DestroyRef,
  effect,
  inject,
  isDevMode,
  PLATFORM_ID,
  Signal,
  signal,
  untracked,
  WritableSignal,
} from '@angular/core';
import { defineRootProvider, ProviderDefinition } from '@ethlete/core';
import { Observable, Subject } from 'rxjs';
import { isQueryDevtoolsEnabled, registerQueryDevtoolsEntry } from '../devtools/query-devtools-hook';
import { AnyCreateBearerAuthProviderResult } from '../auth';
import { authAndAuthProvider, messageMalformed, roomNotJoined } from './web-socket-errors';

/** A single message captured for the devtools web socket inspector. */
export type WebSocketDevtoolsMessage = {
  id: number;
  timestamp: number;
  room: string;
  event: string;
  data: unknown;

  /**
   * Whether the message arrived from the server or was sent by this client - room joins and leaves
   * included, which is what makes "the room was never joined" tellable from "the room is quiet".
   */
  direction: 'in' | 'out';
};

/**
 * The live handle a web socket client registers with the devtools. Read by the `<et-query-devtools>`
 * Sockets tab. Not part of the general public contract.
 */
export type WebSocketDevtoolsHandle = {
  connected: Signal<boolean>;
  rooms: Signal<string[]>;
  messages: Signal<WebSocketDevtoolsMessage[]>;

  /**
   * Sends a message the way the app would, so the panel can provoke a server that only answers a
   * client that asked. Recorded in {@link messages} like any other outgoing one.
   */
  emit: (options: { event: string; data: unknown }) => void;
};

const MAX_DEVTOOLS_MESSAGES = 100;
const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30_000;
const RECONNECT_STABLE_AFTER = 10_000;

export type CreateWebSocketClientTransport = 'polling' | 'websocket' | 'webtransport';

/** The options {@link createWebSocketClient} passes to the socket io factory. */
export type WebSocketClientIoOptions = {
  withCredentials: boolean;
  autoConnect: boolean;
  transports: CreateWebSocketClientTransport[] | undefined;
  auth?: (cb: (data: object) => void) => void;
};

/** The payload socket.io sends in the handshake of every (re)connect. */
export type WebSocketClientAuth = Record<string, unknown>;

/** The slice of a socket io `Socket` this client drives. */
export type WebSocketClientSocket = {
  connect: () => void;
  disconnect: () => void;
  emit: (event: string, data: unknown) => void;
  on: {
    (event: 'connect', listener: () => void): void;
    (event: 'disconnect', listener: (reason: string) => void): void;
    (event: 'connect_error', listener: (error: Error) => void): void;
  };
  onAny: (listener: (eventName: string, ...args: unknown[]) => void) => void;
  onAnyOutgoing: (listener: (eventName: string, ...args: unknown[]) => void) => void;
  readonly recovered: boolean;

  /** `false` once socket.io gave up reconnecting on its own - after a rejected handshake, for example. */
  readonly active?: boolean;

  /** The emits socket.io holds while disconnected and flushes on the next connect. */
  readonly sendBuffer?: unknown[];
};

/**
 * The `io` factory of `socket.io-client`, declared structurally.
 *
 * `@ethlete/query` never imports `socket.io-client` itself: the package ships no `sideEffects: false`,
 * so a single static import of it is unshakeable and would cost *every* consumer ~13 kB gz - a
 * REST-only app included, which could then not even build without installing the optional peer.
 * Passing `io` in keeps that cost with the apps that actually open a socket.
 */
export type WebSocketClientIo = (url: string, options: WebSocketClientIoOptions) => WebSocketClientSocket;

export type CreateWebSocketClientConfigOptions = {
  /** A unique name for the client */
  name: string;

  /** The URL of the socket io server */
  url: string;

  /**
   * The `io` factory, imported by the app: `import { io } from 'socket.io-client'`.
   *
   * @example
   * ```ts
   * import { io } from 'socket.io-client';
   *
   * const MATCH_SOCKET = createWebSocketClient({ name: 'match', url: env.wsUrl, io });
   * ```
   */
  io: WebSocketClientIo;

  /** A list of transports to try (in order). Engine.io always attempts to connect directly with the first one, provided the feature detection test for it passes. */
  transports?: CreateWebSocketClientTransport[];

  /**
   * Whether the polling transport sends cookies to a cross-origin server. Defaults to `true`.
   */
  withCredentials?: boolean;

  /**
   * The handshake payload, sent on every connect and reconnect. Pass a function to read a fresh value
   * each time; it runs outside an injection context, so it cannot call `injectAuthProvider()`. For a
   * bearer auth provider use {@link authProvider} instead. Setting both is a dev-mode error and
   * `authProvider` wins.
   *
   * @example
   * ```ts
   * createWebSocketClient({ name: 'match', url, io, auth: () => ({ token: readCookieToken() }) });
   * ```
   */
  auth?: WebSocketClientAuth | (() => WebSocketClientAuth);

  /**
   * A bearer auth provider whose session the socket follows. The handshake carries
   * `{ token: accessToken() }`. The socket does not connect while the session is `'unknown'` or
   * `'restoring'` and reconnects when a session starts (a login, a seed, or a different user). On logout
   * it completes its rooms, sets every `joinRoom()` signal to `null` until the next session re-joins it,
   * and reconnects as anonymous. Emits still buffered from the ended session are dropped. A token
   * rotation within a session does not reconnect; the next reconnect reads the fresh token. A client
   * without `authProvider` ignores the auth session entirely.
   *
   * @example
   * ```ts
   * createWebSocketClient({ name: 'match', url, io, authProvider: myAuthProviderRef });
   * ```
   */
  authProvider?: AnyCreateBearerAuthProviderResult;
};

/** A default socket io message view */
export type SocketMessageView<TMessageData = unknown> = {
  room: string;
  event: string;
  data: TMessageData;
};

export type WebSocketClientSubtle = {
  /**
   * Releases one join of a socket io room. Joiners of the same room share it, so the room is only
   * actually left once every one of them has released it.
   */
  leaveRoom: (room: string) => void;
};

export type WebSocketClient<TMessageData extends SocketMessageView> = {
  /**
   * Join a socket io room. Must be called in an injection context, because the room is released when
   * that context is destroyed.
   * If a function is passed, it will be evaluated in a reactive signal context.
   * If the function returns null, no room will be joined.
   * If the function returns a string, the previous room will be left and the new room will be joined.
   */
  joinRoom: (room: string | (() => string | null)) => Signal<WebSocketRoom<TMessageData> | null>;

  /** Whether the client is connected to the server */
  isConnected: Signal<boolean>;

  /**
   * Sends a message to the server. socket.io buffers it while the connection is down; with an
   * `authProvider`, a buffered message is dropped when the session ends.
   */
  send: (message: { event: string; data: unknown }) => void;

  /** Advanced web socket features. **WARNING!** Incorrectly using these features will likely **BREAK** your application. You have been warned! */
  subtle: WebSocketClientSubtle;
};

export type InternalWebSocketRoom<TMessageData extends SocketMessageView> = {
  latestMessage: WritableSignal<TMessageData | null>;
  messages: Subject<TMessageData>;
  messages$: Observable<TMessageData>;

  /**
   * How many callers currently hold this room. Joiners share one room object, so the room may only be
   * left once this reaches zero - otherwise the first caller to unmount stops the messages for the rest.
   */
  joinCount: number;
};

export type WebSocketRoom<TMessageData extends SocketMessageView> = {
  /** The latest message received in the room. Messages that arrive in one tick collapse into the last. */
  latestMessage: Signal<TMessageData | null>;

  /** Every message received in the room from the moment of subscribing. Completes when the room is left. */
  messages$: Observable<TMessageData>;
};

export type WebSocketClientResult<TMessageData extends SocketMessageView = SocketMessageView> = ProviderDefinition<
  WebSocketClient<TMessageData>
>;

export type AnyWebSocketClient<TMessageData extends SocketMessageView = SocketMessageView> =
  WebSocketClientResult<TMessageData>;

export const createWebSocketClient = <TMessageData extends SocketMessageView = SocketMessageView>(
  options: CreateWebSocketClientConfigOptions,
): WebSocketClientResult<TMessageData> => {
  return defineRootProvider(
    () => {
      if (isPlatformServer(inject(PLATFORM_ID))) return createServerWebSocketClient<TMessageData>();

      if (options.auth && options.authProvider && isDevMode()) throw authAndAuthProvider(options.name);

      const authProvider = options.authProvider?.inject();
      const auth = authProvider ? () => ({ token: authProvider.accessToken() }) : options.auth;
      const socket = options.io(options.url, {
        withCredentials: options.withCredentials ?? true,
        autoConnect: false,
        transports: options.transports,
        auth: auth ? (cb) => cb(typeof auth === 'function' ? auth() : auth) : undefined,
      });

      const rooms = new Map<string, InternalWebSocketRoom<TMessageData>>();
      const holds = new Set<RoomHold<TMessageData>>();
      const joinsDeliveredThisConnection = new Set<string>();
      const joinsDeliveredToClosedConnection = new Set<string>();
      const isConnected = signal(false);

      // Devtools instrumentation (no-op unless provideQueryDevtools() was called).
      const devtoolsEnabled = isQueryDevtoolsEnabled();
      const devtoolsRooms = signal<string[]>([]);
      const devtoolsMessages = signal<WebSocketDevtoolsMessage[]>([]);
      let devtoolsMessageId = 0;
      const syncDevtoolsRooms = () => {
        if (devtoolsEnabled) devtoolsRooms.set([...rooms.keys()]);
      };

      const recordDevtoolsMessage = (message: Omit<WebSocketDevtoolsMessage, 'id' | 'timestamp'>) => {
        if (!devtoolsEnabled) return;

        devtoolsMessages.update((log) =>
          [{ ...message, id: devtoolsMessageId++, timestamp: Date.now() }, ...log].slice(0, MAX_DEVTOOLS_MESSAGES),
        );
      };

      /** Every outgoing message goes through here, so the devtools log covers both directions. */
      const emit = (message: { event: string; data: unknown; room?: string }) => {
        socket.emit(message.event, message.data);

        recordDevtoolsMessage({
          room: message.room ?? '',
          event: message.event,
          data: message.data,
          direction: 'out',
        });
      };

      const join = (name: string) => {
        const existingRoom = rooms.get(name);

        if (existingRoom) {
          existingRoom.joinCount++;

          return existingRoom;
        }

        emit({ event: 'join-room', data: name, room: name });
        joinsDeliveredToClosedConnection.delete(name);

        const messages = new Subject<TMessageData>();

        const newRoom: InternalWebSocketRoom<TMessageData> = {
          latestMessage: signal<TMessageData | null>(null),
          messages,
          messages$: messages.asObservable(),
          joinCount: 1,
        };

        rooms.set(name, newRoom);
        syncDevtoolsRooms();

        return newRoom;
      };

      const holdRoom = (hold: RoomHold<TMessageData>, name: string | null) => {
        if (name === hold.name) return;

        if (hold.name !== null && !hold.parked) leaveRoom(hold.name);

        hold.name = name;

        if (name === null) hold.parked = false;
        if (hold.parked) return;

        hold.room.set(name === null ? null : join(name));
      };

      const createHold = () => {
        const hold: RoomHold<TMessageData> = { name: null, parked: false, room: signal(null) };

        holds.add(hold);
        inject(DestroyRef).onDestroy(() => {
          holdRoom(hold, null);
          holds.delete(hold);
        });

        return hold;
      };

      const joinRoom = (room: string | (() => string | null)) => {
        const hold = createHold();

        if (typeof room === 'string') {
          holdRoom(hold, room);
        } else {
          effect(() => {
            const current = room() || null;

            untracked(() => holdRoom(hold, current));
          });
        }

        return hold.room.asReadonly() as Signal<WebSocketRoom<TMessageData> | null>;
      };

      const leaveRoom = (room: string) => {
        const parkedHold = [...holds].find((hold) => hold.parked && hold.name === room);

        if (parkedHold) {
          parkedHold.name = null;
          parkedHold.parked = false;

          return;
        }

        const joinedRoom = rooms.get(room);

        if (!joinedRoom) {
          if (isDevMode()) throw roomNotJoined(room);

          return;
        }

        joinedRoom.joinCount--;

        if (joinedRoom.joinCount > 0) return;

        // A buffered leave would reach the next session, which only knows this room after a recovered reconnect.
        if (!joinsDeliveredToClosedConnection.has(room)) emit({ event: 'leave-room', data: room, room });

        rooms.delete(room);
        syncDevtoolsRooms();
        joinedRoom.messages.complete();
      };

      let reconnectAttempt = 0;
      let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
      let connectedAt: number | null = null;
      let destroyed = false;

      /** socket.io stops reconnecting after a server disconnect or a rejected handshake, so the client takes over. */
      const scheduleReconnect = () => {
        if (reconnectTimer !== null || destroyed) return;

        const delay = Math.min(RECONNECT_BASE_DELAY * 2 ** reconnectAttempt, RECONNECT_MAX_DELAY);
        reconnectAttempt++;

        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          socket.connect();
        }, delay);
      };

      const setupWebSocketConnectionListener = () => {
        socket.onAnyOutgoing((eventName, room) => {
          if (eventName === 'join-room' && typeof room === 'string') joinsDeliveredThisConnection.add(room);
        });

        // socket.io flushes the joins it buffered before firing `connect`, so by now they are in the set.
        socket.on('connect', () => {
          isConnected.set(true);
          connectedAt = Date.now();

          const joinedByClosedConnection = [...joinsDeliveredToClosedConnection];
          joinsDeliveredToClosedConnection.clear();

          if (socket.recovered) {
            for (const room of joinedByClosedConnection) {
              if (!rooms.has(room)) emit({ event: 'leave-room', data: room, room });
            }

            return;
          }

          for (const room of rooms.keys()) {
            if (joinsDeliveredThisConnection.has(room)) continue;

            emit({ event: 'join-room', data: room, room });
          }
        });
        socket.on('disconnect', (reason) => {
          isConnected.set(false);

          // A server that accepts and then kicks right away must keep backing off, not be hit every second.
          if (connectedAt !== null && Date.now() - connectedAt >= RECONNECT_STABLE_AFTER) reconnectAttempt = 0;
          connectedAt = null;

          for (const room of joinsDeliveredThisConnection) joinsDeliveredToClosedConnection.add(room);
          joinsDeliveredThisConnection.clear();

          if (reason !== 'io server disconnect') return;

          scheduleReconnect();
        });
        socket.on('connect_error', () => {
          if (socket.active === false) scheduleReconnect();
        });
      };

      const setupWebSocketListener = () => {
        socket.onAny((_eventName: string, ...args: unknown[]) => {
          let json: TMessageData;

          try {
            const data = args[0];

            if (typeof data !== 'string') throw messageMalformed();

            const parsed: unknown = JSON.parse(data);

            if (
              typeof parsed !== 'object' ||
              parsed === null ||
              typeof (parsed as SocketMessageView).room !== 'string'
            ) {
              throw messageMalformed();
            }

            json = parsed as TMessageData;
          } catch (error) {
            if (!isDevMode()) return;

            console.error(error);
            throw messageMalformed();
          }

          recordDevtoolsMessage({ room: json.room, event: json.event, data: json.data, direction: 'in' });

          const room = rooms.get(json.room);

          if (!room) return;

          room.latestMessage.set(json);
          room.messages.next(json);
        });
      };

      inject(DestroyRef).onDestroy(() => {
        destroyed = true;
        if (reconnectTimer !== null) clearTimeout(reconnectTimer);
        socket.disconnect();

        for (const room of rooms.values()) room.messages.complete();
      });

      setupWebSocketConnectionListener();
      setupWebSocketListener();

      const dropBufferedEmits = () => {
        if (socket.sendBuffer) socket.sendBuffer.length = 0;
      };

      const endSession = () => {
        if (reconnectTimer !== null) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }

        dropBufferedEmits();
        socket.disconnect();

        for (const hold of holds) {
          if (hold.name === null || hold.parked) continue;

          hold.parked = true;
          hold.room.set(null);
        }

        for (const room of rooms.values()) room.messages.complete();

        rooms.clear();
        joinsDeliveredThisConnection.clear();
        joinsDeliveredToClosedConnection.clear();
        syncDevtoolsRooms();
      };

      const rejoinParkedRooms = () => {
        for (const hold of holds) {
          if (!hold.parked || hold.name === null) continue;

          hold.parked = false;
          hold.room.set(join(hold.name));
        }
      };

      const startConnection = () => {
        reconnectAttempt = 0;
        socket.connect();
      };

      if (authProvider) {
        let hasConnected = false;
        let wasAuthenticated = false;
        let handledLogin: unknown = null;
        let handledSessionId: number | null = null;

        effect(() => {
          const status = authProvider.sessionStatus();
          const execution = authProvider.executionState();
          const sessionId = authProvider.sessionId();

          untracked(() => {
            if (destroyed || status === 'unknown' || status === 'restoring') return;

            if (status === 'anonymous') {
              if (wasAuthenticated) {
                endSession();
                startConnection();
              } else if (!hasConnected) {
                startConnection();
              }

              wasAuthenticated = false;
              hasConnected = true;

              return;
            }

            const login =
              (execution?.type === 'login' || execution?.type === 'tokenSeed') && execution.state === 'success'
                ? execution
                : null;
            const startedSession =
              !wasAuthenticated || sessionId !== handledSessionId || (login !== null && login !== handledLogin);

            if (login) handledLogin = login;
            handledSessionId = sessionId;
            wasAuthenticated = true;

            if (!hasConnected) {
              startConnection();
            } else if (startedSession) {
              dropBufferedEmits();
              socket.disconnect();
              rejoinParkedRooms();
              startConnection();
            }

            hasConnected = true;
          });
        });
      } else {
        socket.connect();
      }

      const client: WebSocketClient<TMessageData> = {
        joinRoom,
        isConnected: isConnected.asReadonly(),
        send: (message) => emit({ event: message.event, data: message.data }),
        subtle: {
          leaveRoom,
        },
      };

      if (devtoolsEnabled) {
        const handle: WebSocketDevtoolsHandle = {
          connected: isConnected.asReadonly(),
          rooms: devtoolsRooms.asReadonly(),
          messages: devtoolsMessages.asReadonly(),
          emit,
        };

        const unregister = registerQueryDevtoolsEntry({
          kind: 'ws-client',
          handle,
          meta: { name: options.name, url: options.url },
        });

        inject(DestroyRef).onDestroy(unregister);
      }

      return client;
    },
    {
      name: `WebSocketClient_${options.name}`,
    },
  );
};

type RoomHold<TMessageData extends SocketMessageView> = {
  name: string | null;
  parked: boolean;
  room: WritableSignal<InternalWebSocketRoom<TMessageData> | null>;
};

const createServerWebSocketClient = <TMessageData extends SocketMessageView>(): WebSocketClient<TMessageData> => {
  const noRoom = signal<WebSocketRoom<TMessageData> | null>(null).asReadonly();

  return {
    joinRoom: () => {
      assertInInjectionContext(createServerWebSocketClient);

      return noRoom;
    },
    isConnected: signal(false).asReadonly(),
    send: () => undefined,
    subtle: {
      leaveRoom: () => undefined,
    },
  };
};
