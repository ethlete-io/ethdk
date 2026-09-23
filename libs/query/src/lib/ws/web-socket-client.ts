import {
  computed,
  DestroyRef,
  effect,
  inject,
  isDevMode,
  Signal,
  signal,
  untracked,
  WritableSignal,
} from '@angular/core';
import { defineRootProvider, previousSignalValue, ProviderDefinition } from '@ethlete/core';
import { Observable, Subject } from 'rxjs';
import { isQueryDevtoolsEnabled, registerQueryDevtoolsEntry } from '../devtools/query-devtools-hook';
import { messageMalformed, roomNotJoined } from './web-socket-errors';

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
  on: (event: 'connect' | 'disconnect', listener: () => void) => void;
  onAny: (listener: (eventName: string, ...args: unknown[]) => void) => void;
  onAnyOutgoing: (listener: (eventName: string, ...args: unknown[]) => void) => void;
  readonly recovered: boolean;
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
   * (e.g. the current access token) each time.
   *
   * @example
   * ```ts
   * createWebSocketClient({ name: 'match', url, io, auth: () => ({ token: auth.accessToken() }) });
   * ```
   */
  auth?: WebSocketClientAuth | (() => WebSocketClientAuth);
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

  /** Sends a message to the server. socket.io buffers it while the connection is down. */
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
      const auth = options.auth;
      const socket = options.io(options.url, {
        withCredentials: options.withCredentials ?? true,
        autoConnect: false,
        transports: options.transports,
        auth: auth ? (cb) => cb(typeof auth === 'function' ? auth() : auth) : undefined,
      });

      const rooms = new Map<string, InternalWebSocketRoom<TMessageData>>();
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

      const joinRoom = (room: string | (() => string | null)) => {
        const roomFn = typeof room === 'function' ? room : () => room;
        // Must stay above the effect below: `previousSignalValue` registers a `toObservable` effect that has to run
        // first in the same flush. Registered later, it leaves `pre()` on the room from the flush before, and the
        // effect joins the new room without ever leaving the old one.
        const pre = previousSignalValue(computed(() => roomFn()));
        const roomData = signal<InternalWebSocketRoom<TMessageData> | null>(null);
        let joinedRoomName: string | null = null;

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

        effect(() => {
          const current = roomFn();

          untracked(() => {
            const previous = pre();

            if (previous === current) return;

            if (previous) {
              leaveRoom(previous);
              joinedRoomName = null;
            }

            if (current) {
              const joinedRoom = join(current);
              if (joinedRoom) {
                joinedRoomName = current;
                roomData.set(joinedRoom);
              }
            } else {
              roomData.set(null);
            }
          });
        });

        inject(DestroyRef).onDestroy(() => {
          if (joinedRoomName) {
            leaveRoom(joinedRoomName);
            joinedRoomName = null;
            roomData.set(null);
          }
        });

        return roomData.asReadonly() as Signal<WebSocketRoom<TMessageData> | null>;
      };

      const leaveRoom = (room: string) => {
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

      const setupWebSocketConnectionListener = () => {
        socket.onAnyOutgoing((eventName, room) => {
          if (eventName === 'join-room' && typeof room === 'string') joinsDeliveredThisConnection.add(room);
        });

        // socket.io flushes the joins it buffered before firing `connect`, so by now they are in the set.
        socket.on('connect', () => {
          isConnected.set(true);

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
        socket.on('disconnect', () => {
          isConnected.set(false);

          for (const room of joinsDeliveredThisConnection) joinsDeliveredToClosedConnection.add(room);
          joinsDeliveredThisConnection.clear();
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
        socket.disconnect();

        for (const room of rooms.values()) room.messages.complete();
      });

      setupWebSocketConnectionListener();
      setupWebSocketListener();
      socket.connect();

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
