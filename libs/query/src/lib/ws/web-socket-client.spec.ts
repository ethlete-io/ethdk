import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createWebSocketTestDouble } from '@ethlete/query/testing';
import { createWebSocketClient } from './web-socket-client';

describe('createWebSocketClient', () => {
  afterEach(() => TestBed.resetTestingModule());

  const setup = (options?: { name?: string; transports?: ('polling' | 'websocket' | 'webtransport')[] }) => {
    const double = createWebSocketTestDouble();
    const client = createWebSocketClient({
      name: options?.name ?? 'test',
      url: 'ws://localhost:3000',
      io: double.io,
      transports: options?.transports,
    });

    return { double, client };
  };

  const provided = (options?: Parameters<typeof setup>[0]) => {
    const { double, client } = setup(options);

    TestBed.configureTestingModule({ providers: [client.provide()] });

    return { double, client, instance: TestBed.runInInjectionContext(() => client.inject()) };
  };

  it('should create a web socket client definition', () => {
    const { client } = setup();

    expect(client.provide).toBeTruthy();
    expect(client.inject).toBeTruthy();
    expect(client.token).toBeTruthy();
  });

  it('should create client using provider', () => {
    const { client } = setup();

    TestBed.configureTestingModule({});

    const wsClient = TestBed.inject(client.token);

    expect(wsClient.isConnected).toBeTruthy();
    expect(wsClient.joinRoom).toBeTruthy();
    expect(wsClient.subtle.leaveRoom).toBeTruthy();
  });

  it('should connect through the injected io factory', () => {
    const { double } = provided();

    expect(double.connection()).toEqual({ url: 'ws://localhost:3000', transports: undefined });
    expect(double.state().connectRequested).toBe(true);
  });

  it('should pass custom transports to the io factory', () => {
    const { double } = provided({ transports: ['websocket', 'polling'] });

    expect(double.connection()?.transports).toEqual(['websocket', 'polling']);
  });

  it('should track the connection state', () => {
    const { double, instance } = provided();

    expect(instance.isConnected()).toBe(false);

    double.serverConnect();
    expect(instance.isConnected()).toBe(true);

    double.serverDisconnect();
    expect(instance.isConnected()).toBe(false);
  });

  it('should re-join every room on connect', () => {
    const { double, instance } = provided();

    TestBed.runInInjectionContext(() => instance.joinRoom('lobby'));
    TestBed.tick();

    expect(double.sent()).toEqual([{ event: 'join-room', data: 'lobby' }]);

    double.serverConnect();

    expect(double.sent()).toEqual([
      { event: 'join-room', data: 'lobby' },
      { event: 'join-room', data: 'lobby' },
    ]);
  });

  it('should expose the latest message of a joined room', () => {
    const { double, instance } = provided();

    const room = TestBed.runInInjectionContext(() => instance.joinRoom('lobby'));
    TestBed.tick();

    double.serverSend({ room: 'lobby', event: 'score', data: { goals: 1 } });

    expect(room()?.latestMessage()).toEqual({ room: 'lobby', event: 'score', data: { goals: 1 } });
  });

  it('should ignore a message for a room that was not joined', () => {
    const { double, instance } = provided();

    const room = TestBed.runInInjectionContext(() => instance.joinRoom('lobby'));
    TestBed.tick();

    double.serverSend({ room: 'other', event: 'score', data: { goals: 1 } });

    expect(room()?.latestMessage()).toBeNull();
  });

  it('should leave the previous room when the reactive room name changes', () => {
    const { double, instance } = provided();
    const room = signal<string | null>('lobby');

    TestBed.runInInjectionContext(() => instance.joinRoom(room));
    TestBed.tick();

    room.set('match-1');
    TestBed.tick();

    expect(double.sent()).toEqual([
      { event: 'join-room', data: 'lobby' },
      { event: 'leave-room', data: 'lobby' },
      { event: 'join-room', data: 'match-1' },
    ]);
  });

  it('should disconnect the socket when the injector is destroyed', () => {
    const { double } = provided();

    expect(double.state().disconnected).toBe(false);

    TestBed.resetTestingModule();

    expect(double.state().disconnected).toBe(true);
  });

  it('should create unique tokens for different clients', () => {
    const { client: client1 } = setup({ name: 'client1' });
    const { client: client2 } = setup({ name: 'client2' });

    expect(client1.token).not.toBe(client2.token);
  });
});
