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
import { previousSignalValue } from '@ethlete/core';
import { io } from 'socket.io-client';
import { WebSocketClientConfig } from './web-socket-client-config';
import { messageMalformed, roomNotJoined } from './web-socket-errors';

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

export const createWebSocketClient = <TMessageData extends SocketMessageView>(config: WebSocketClientConfig) => {
  const socket = io(config.url, {
    withCredentials: true,
    autoConnect: false,
  });

  const rooms = new Map<string, InternalWebSocketRoom<TMessageData>>();
  const isConnected = signal(false);

  const joinRoom = (room: string | (() => string | null)) => {
    const roomFn = typeof room === 'function' ? room : () => room;

    const join = (name: string) => {
      socket.emit('join-room', name);

      const existingRoom = rooms.get(name);

      if (existingRoom) return existingRoom;

      const message = signal<TMessageData | null>(null);

      const newRoom: InternalWebSocketRoom<TMessageData> = {
        latestMessage: message,
      };

      rooms.set(name, newRoom);

      return newRoom;
    };

    const pre = previousSignalValue(computed(() => roomFn()));
    const roomData = signal<InternalWebSocketRoom<TMessageData> | null>(null);

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
  };

  const setupWebSocketConnectionListener = () => {
    socket.on('connect', () => {
      isConnected.set(true);

      for (const room of rooms.keys()) {
        joinRoom(room);
      }
    });
    socket.on('disconnect', () => isConnected.set(false));
  };

  const setupWebSocketListener = () => {
    socket.onAny((data: string) => {
      try {
        const json = JSON.parse(data) as TMessageData;

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

  return client;
};

export const provideWebSocketClient = (config: WebSocketClientConfig) => {
  return {
    provide: config.token,
    useFactory: () => createWebSocketClient(config),
  };
};
