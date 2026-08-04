import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createWebSocketTestDouble } from '@ethlete/query/testing';
import { provideQueryDevtools, queryDevtoolsEntries } from '../devtools/query-devtools-registry';
import { createWebSocketClient, WebSocketDevtoolsHandle } from './web-socket-client';

describe('web socket devtools instrumentation', () => {
  const setup = (name: string) => {
    const socket = createWebSocketTestDouble();
    const client = createWebSocketClient({ name, url: 'ws://localhost:3000', io: socket.io });

    TestBed.configureTestingModule({ providers: [provideQueryDevtools(), client.provide()] });

    // The entry is registered by the provider's factory, so it only exists once the client is injected.
    const injected = TestBed.runInInjectionContext(() => client.inject());
    const entry = queryDevtoolsEntries().find((e) => e.kind === 'ws-client' && e.meta.name === name);

    if (!entry) throw new Error('the socket was not registered');

    return { socket, client: injected, handle: entry.handle as WebSocketDevtoolsHandle };
  };

  afterEach(() => TestBed.resetTestingModule());

  it('should record the room joins and leaves the client sends', () => {
    const { client, handle } = setup('outgoing');
    const room = signal<string | null>('lobby');

    TestBed.runInInjectionContext(() => client.joinRoom(room));
    TestBed.tick();

    expect(handle.rooms()).toEqual(['lobby']);
    expect(handle.messages()[0]).toMatchObject({ direction: 'out', event: 'join-room', room: 'lobby' });

    room.set(null);
    TestBed.tick();

    expect(handle.rooms()).toEqual([]);
    expect(handle.messages()[0]).toMatchObject({ direction: 'out', event: 'leave-room', room: 'lobby' });
  });

  it('should record a received message as incoming', () => {
    const { socket, handle } = setup('incoming');

    socket.serverSend({ room: 'lobby', event: 'score', data: { home: 1 } });

    expect(handle.messages()[0]).toMatchObject({
      direction: 'in',
      event: 'score',
      room: 'lobby',
      data: { home: 1 },
    });
  });

  it('should send a message the panel emits and record it', () => {
    const { socket, handle } = setup('emitter');

    handle.emit({ event: 'ping', data: { id: 7 } });

    expect(socket.sent()).toContainEqual({ event: 'ping', data: { id: 7 } });
    expect(handle.messages()[0]).toMatchObject({ direction: 'out', event: 'ping', data: { id: 7 }, room: '' });
  });
});
