import { computed, DestroyRef, effect, inject, isDevMode, Signal, signal, untracked } from '@angular/core';
import { previousSignalValue } from '@ethlete/core';
import { io } from 'socket.io-client';
import { WebSocketClientConfig } from './web-socket-client-config';
import { messageMalformed, roomAlreadyJoined, roomNotJoined } from './web-socket-errors';

export type SocketMessageView = {
  room: string;
  event: string;
  data: unknown | null;
};

export type WebSocketClient<T extends SocketMessageView> = {
  joinRoom: (room: string) => void;
  joinComputedRoom: (room: () => string | null) => void;
  leaveRoom: (room: string) => void;
  leaveAllRooms: () => void;
  currentEvent: Signal<T | null>;
  isConnected: Signal<boolean>;
};

export const createWebSocketClient = <T extends SocketMessageView>(config: WebSocketClientConfig) => {
  const joinedRooms = new Set<string>();
  const socket = io(config.url, {
    withCredentials: true,
    autoConnect: false,
  });

  const currentEvent = signal<T | null>(null);
  const isConnected = signal(false);

  const joinRoom = (room: string) => {
    if (joinedRooms.has(room)) {
      if (isDevMode()) throw roomAlreadyJoined(room);
      return;
    }

    socket.emit('join-room', room);

    joinedRooms.add(room);
  };

  const joinComputedRoom = (room: () => string | null) => {
    const pre = previousSignalValue(computed(() => room()));

    effect(() => {
      const current = room();

      untracked(() => {
        const previous = pre();

        if (previous === current) return;

        if (previous) leaveRoom(previous);
        if (current) joinRoom(current);
      });
    });

    inject(DestroyRef).onDestroy(() => {
      const current = room();

      if (current) leaveRoom(current);
    });
  };

  const leaveRoom = (room: string) => {
    if (!joinedRooms.has(room)) {
      if (isDevMode()) throw roomNotJoined(room);
      return;
    }

    socket.emit('leave-room', room);

    joinedRooms.delete(room);
  };

  const leaveAllRooms = () => {
    joinedRooms.forEach((room) => leaveRoom(room));
    joinedRooms.clear();
  };

  const setupWebSocketConnectionListener = () => {
    socket.on('connect', () => {
      isConnected.set(true);

      joinedRooms.forEach((room) => joinRoom(room));
    });
    socket.on('disconnect', () => isConnected.set(false));
  };

  const setupWebSocketListener = () => {
    socket.onAny((data: string) => {
      try {
        const json = JSON.parse(data) as T;

        currentEvent.set(json);
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

  const client: WebSocketClient<T> = {
    joinRoom,
    joinComputedRoom,
    leaveRoom,
    leaveAllRooms,
    currentEvent: currentEvent.asReadonly(),
    isConnected: isConnected.asReadonly(),
  };

  return client;
};

export const provideWebSocketClient = (config: WebSocketClientConfig) => {
  return {
    provide: config.token,
    useFactory: () => createWebSocketClient(config),
  };
};
