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
};

/** The slice of a socket io `Socket` this client drives. */
export type WebSocketClientSocket = {
  connect: () => void;
  disconnect: () => void;
  emit: (event: string, data: unknown) => void;
  on: (event: 'connect' | 'disconnect', listener: () => void) => void;
  onAny: (listener: (eventName: string, ...args: unknown[]) => void) => void;
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
   * Join a socket io room
   * If a function is passed, it will be evaluated in a reactive signal context.
   * If the function returns null, no room will be joined.
   * If the function returns a string, the previous room will be left and the new room will be joined.
   */
  joinRoom: (room: string | (() => string | null)) => Signal<WebSocketRoom<TMessageData> | null>;

  /** Whether the client is connected to the server */
  isConnected: Signal<boolean>;

  /** Advanced web socket features. **WARNING!** Incorrectly using these features will likely **BREAK** your application. You have been warned! */
  subtle: WebSocketClientSubtle;
};

export type InternalWebSocketRoom<TMessageData extends SocketMessageView> = {
  latestMessage: WritableSignal<TMessageData | null>;

  /**
   * How many callers currently hold this room. Joiners share one room object, so the room may only be
   * left once this reaches zero - otherwise the first caller to unmount stops the messages for the rest.
   */
  joinCount: number;
};

export type WebSocketRoom<TMessageData extends SocketMessageView> = {
  /** The latest message received in the room */
  latestMessage: Signal<TMessageData | null>;
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
      const socket = options.io(options.url, {
        withCredentials: true,
        autoConnect: false,
        transports: options.transports,
      });

      const rooms = new Map<string, InternalWebSocketRoom<TMessageData>>();
      const bufferedJoins = new Set<string>();
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

          if (!isConnected()) bufferedJoins.add(name);

          const message = signal<TMessageData | null>(null);

          const newRoom: InternalWebSocketRoom<TMessageData> = {
            latestMessage: message,
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

        emit({ event: 'leave-room', data: room, room });

        rooms.delete(room);
        bufferedJoins.delete(room);
        syncDevtoolsRooms();
      };

      const setupWebSocketConnectionListener = () => {
        socket.on('connect', () => {
          isConnected.set(true);

          // socket.io delivers a join buffered while disconnected on this connect; re-emitting it would send it twice.
          for (const room of rooms.keys()) {
            if (bufferedJoins.delete(room)) continue;

            emit({ event: 'join-room', data: room, room });
          }
        });
        socket.on('disconnect', () => isConnected.set(false));
      };

      const setupWebSocketListener = () => {
        socket.onAny((_eventName: string, ...args: unknown[]) => {
          try {
            const data = args[0];

            if (typeof data !== 'string') throw messageMalformed();

            const json = JSON.parse(data) as TMessageData;

            recordDevtoolsMessage({ room: json.room, event: json.event, data: json.data, direction: 'in' });

            const room = rooms.get(json.room);

            if (room) room.latestMessage.set(json);
          } catch (error) {
            console.error(error);
            if (isDevMode()) throw messageMalformed();
          }
        });
      };

      inject(DestroyRef).onDestroy(() => socket.disconnect());

      setupWebSocketConnectionListener();
      setupWebSocketListener();
      socket.connect();

      const client: WebSocketClient<TMessageData> = {
        joinRoom,
        isConnected: isConnected.asReadonly(),
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
