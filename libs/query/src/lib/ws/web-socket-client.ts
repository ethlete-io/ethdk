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
import { io } from 'socket.io-client';
import { isQueryDevtoolsEnabled, registerQueryDevtoolsEntry } from '../devtools/query-devtools-hook';
import { messageMalformed, roomNotJoined } from './web-socket-errors';

/** A single message captured for the devtools web socket inspector. */
export type WebSocketDevtoolsMessage = {
  id: number;
  timestamp: number;
  room: string;
  event: string;
  data: unknown;
};

/**
 * The live handle a web socket client registers with the devtools. Read by the `<et-query-devtools>`
 * Sockets tab. Not part of the general public contract.
 */
export type WebSocketDevtoolsHandle = {
  connected: Signal<boolean>;
  rooms: Signal<string[]>;
  messages: Signal<WebSocketDevtoolsMessage[]>;
};

const MAX_DEVTOOLS_MESSAGES = 100;

export type CreateWebSocketClientTransport = 'polling' | 'websocket' | 'webtransport';

export type CreateWebSocketClientConfigOptions = {
  /** A unique name for the client */
  name: string;

  /** The URL of the socket io server */
  url: string;

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
  /** Leave a socket io room */
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
      const socket = io(options.url, {
        withCredentials: true,
        autoConnect: false,
        transports: options.transports,
      });

      const rooms = new Map<string, InternalWebSocketRoom<TMessageData>>();
      const isConnected = signal(false);

      // Devtools instrumentation (no-op unless provideQueryDevtools() was called).
      const devtoolsEnabled = isQueryDevtoolsEnabled();
      const devtoolsRooms = signal<string[]>([]);
      const devtoolsMessages = signal<WebSocketDevtoolsMessage[]>([]);
      let devtoolsMessageId = 0;
      const syncDevtoolsRooms = () => {
        if (devtoolsEnabled) devtoolsRooms.set([...rooms.keys()]);
      };

      const joinRoom = (room: string | (() => string | null)) => {
        const roomFn = typeof room === 'function' ? room : () => room;
        const pre = previousSignalValue(computed(() => roomFn()));
        const roomData = signal<InternalWebSocketRoom<TMessageData> | null>(null);

        const join = (name: string) => {
          socket.emit('join-room', name);

          const existingRoom = rooms.get(name);

          if (existingRoom) return existingRoom;

          const message = signal<TMessageData | null>(null);

          const newRoom: InternalWebSocketRoom<TMessageData> = {
            latestMessage: message,
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

            if (previous) leaveRoom(previous);

            if (current) {
              const joinedRoom = join(current);
              if (joinedRoom) roomData.set(joinedRoom);
            } else {
              roomData.set(null);
            }
          });
        });

        inject(DestroyRef).onDestroy(() => {
          const current = roomFn();

          if (current) {
            leaveRoom(current);
            roomData.set(null);
          }
        });

        return roomData.asReadonly() as Signal<WebSocketRoom<TMessageData> | null>;
      };

      const leaveRoom = (room: string) => {
        if (!rooms.has(room)) {
          if (isDevMode()) throw roomNotJoined(room);
        }

        socket.emit('leave-room', room);

        rooms.delete(room);
        syncDevtoolsRooms();
      };

      const setupWebSocketConnectionListener = () => {
        socket.on('connect', () => {
          isConnected.set(true);

          for (const room of rooms.keys()) {
            socket.emit('join-room', room);
          }
        });
        socket.on('disconnect', () => isConnected.set(false));
      };

      const setupWebSocketListener = () => {
        socket.onAny((data: string) => {
          try {
            const json = JSON.parse(data) as TMessageData;

            if (devtoolsEnabled) {
              const message: WebSocketDevtoolsMessage = {
                id: devtoolsMessageId++,
                timestamp: Date.now(),
                room: json.room,
                event: json.event,
                data: json.data,
              };
              devtoolsMessages.update((log) => [message, ...log].slice(0, MAX_DEVTOOLS_MESSAGES));
            }

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
