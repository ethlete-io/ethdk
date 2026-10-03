import { createEnvironmentInjector, EnvironmentInjector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createWebSocketTestDouble } from '@ethlete/query/testing';
import { createWebSocketClient } from './web-socket-client';

describe('createWebSocketClient', () => {
  afterEach(() => TestBed.resetTestingModule());

  const childInjector = () => createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));

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

  describe('reconnect backoff', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const connectCallsAfter = (double: ReturnType<typeof setup>['double'], ms: number) => {
      vi.advanceTimersByTime(ms);

      return double.state().connectCalls;
    };

    it('doubles the delay after every rejected handshake and caps it at 30 seconds', () => {
      const { double } = provided();
      const delays: number[] = [];

      for (let attempt = 0; attempt < 7; attempt++) {
        const before = double.state().connectCalls;
        double.serverRejectHandshake();

        let waited = 0;
        while (double.state().connectCalls === before) {
          vi.advanceTimersByTime(500);
          waited += 500;
        }
        delays.push(waited);
      }

      expect(delays).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
    });

    it('keeps backing off when the server kicks a fresh connection, and starts over after a stable one', () => {
      const { double } = provided();
      const initial = double.state().connectCalls;

      double.serverConnect();
      double.serverDisconnect({ reason: 'io server disconnect' });
      expect(connectCallsAfter(double, 1000)).toBe(initial + 1);

      double.serverConnect();
      vi.advanceTimersByTime(500);
      double.serverDisconnect({ reason: 'io server disconnect' });
      expect(connectCallsAfter(double, 1999)).toBe(initial + 1);
      expect(connectCallsAfter(double, 1)).toBe(initial + 2);

      double.serverConnect();
      vi.advanceTimersByTime(10_000);
      double.serverDisconnect({ reason: 'io server disconnect' });
      expect(connectCallsAfter(double, 1000)).toBe(initial + 3);
    });

    it('leaves a transport close to socket.io', () => {
      const { double } = provided();
      const initial = double.state().connectCalls;

      double.serverConnect();
      double.serverDisconnect({ reason: 'transport close' });

      expect(connectCallsAfter(double, 60_000)).toBe(initial);
    });

    it('schedules one reconnect for a burst of rejections', () => {
      const { double } = provided();
      const initial = double.state().connectCalls;

      double.serverRejectHandshake();
      double.serverRejectHandshake();

      expect(connectCallsAfter(double, 1000)).toBe(initial + 1);
      expect(connectCallsAfter(double, 60_000)).toBe(initial + 1);
    });

    it('cancels a pending reconnect when destroyed', () => {
      const { double } = provided();
      const initial = double.state().connectCalls;

      double.serverRejectHandshake();
      TestBed.resetTestingModule();

      expect(connectCallsAfter(double, 60_000)).toBe(initial);
    });
  });

  it('should re-join every room on a reconnect, but not on the first connect', () => {
    const { double, instance } = provided();

    TestBed.runInInjectionContext(() => instance.joinRoom('lobby'));
    TestBed.tick();

    expect(double.sent()).toEqual([{ event: 'join-room', data: 'lobby' }]);

    double.serverConnect();

    expect(double.sent()).toEqual([{ event: 'join-room', data: 'lobby' }]);

    double.serverDisconnect();
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

  it('should keep a shared room alive until every joiner has left it', () => {
    const { double, instance } = provided();
    const first = childInjector();
    const second = childInjector();

    const roomA = runInInjectionContext(first, () => instance.joinRoom('match-42'));
    const roomB = runInInjectionContext(second, () => instance.joinRoom('match-42'));
    TestBed.tick();

    double.serverSend({ room: 'match-42', event: 'score', data: { goals: 1 } });

    expect(roomA()?.latestMessage()).toEqual({ room: 'match-42', event: 'score', data: { goals: 1 } });
    expect(roomB()?.latestMessage()).toEqual({ room: 'match-42', event: 'score', data: { goals: 1 } });

    first.destroy();

    expect(double.sent()).toEqual([{ event: 'join-room', data: 'match-42' }]);

    double.serverSend({ room: 'match-42', event: 'score', data: { goals: 2 } });

    expect(roomB()?.latestMessage()).toEqual({ room: 'match-42', event: 'score', data: { goals: 2 } });

    second.destroy();

    expect(double.sent().at(-1)).toEqual({ event: 'leave-room', data: 'match-42' });
  });

  it('does not leave a room when a joiner is destroyed before its effect joins', () => {
    const { double, instance } = provided();

    TestBed.runInInjectionContext(() => instance.joinRoom('match-42'));
    TestBed.tick();

    const pending = childInjector();
    runInInjectionContext(pending, () => instance.joinRoom(() => 'match-42'));
    pending.destroy();

    expect(double.sent()).toEqual([{ event: 'join-room', data: 'match-42' }]);
  });

  it('should re-join a room that every joiner had left', () => {
    const { double, instance } = provided();
    const first = childInjector();

    runInInjectionContext(first, () => instance.joinRoom('match-42'));
    TestBed.tick();
    first.destroy();

    const second = childInjector();
    const room = runInInjectionContext(second, () => instance.joinRoom('match-42'));
    TestBed.tick();

    double.serverSend({ room: 'match-42', event: 'score', data: { goals: 3 } });

    expect(room()?.latestMessage()).toEqual({ room: 'match-42', event: 'score', data: { goals: 3 } });
  });

  it('should not leave a room a second joiner still holds when subtle.leaveRoom is called', () => {
    const { double, instance } = provided();
    const holder = childInjector();

    const room = runInInjectionContext(holder, () => instance.joinRoom('match-42'));
    TestBed.runInInjectionContext(() => instance.joinRoom('match-42'));
    TestBed.tick();

    instance.subtle.leaveRoom('match-42');
    double.serverSend({ room: 'match-42', event: 'score', data: { goals: 4 } });

    expect(double.sent()).not.toContainEqual({ event: 'leave-room', data: 'match-42' });
    expect(room()?.latestMessage()).toEqual({ room: 'match-42', event: 'score', data: { goals: 4 } });
  });

  it('should emit nothing when leaving a room that was never joined', () => {
    const { double, instance } = provided();

    expect(() => instance.subtle.leaveRoom('ghost')).toThrow();
    expect(double.sent()).toEqual([]);
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
