import { EnvironmentInjector, createEnvironmentInjector, signal } from '@angular/core';
import {
  SocketMessageView,
  WebSocketClientIoOptions,
  WebSocketDevtoolsHandle,
  createWebSocketClient,
  isQueryDevtoolsEnabled,
  provideQueryDevtools,
  queryDevtoolsEntries,
  withArgs,
  withResponseUpdate,
} from '../index';
import { createWebSocketTestDouble } from '@ethlete/query/testing';
import { describe, expect, it } from 'vitest';
import { Scenario, useScenario } from './harness';

let socketCounter = 0;

const createSocket = <TMessageData extends SocketMessageView = SocketMessageView>(s: Scenario) => {
  const double = createWebSocketTestDouble();
  const name = `ws-scenario-${socketCounter++}`;
  const client = createWebSocketClient<TMessageData>({
    name,
    url: 'ws://localhost',
    io: double.io,
  });

  const instance = s.run(() => client.inject());

  return { double, instance, name };
};

const wsDevtoolsHandle = (name: string) => {
  const entry = queryDevtoolsEntries().find((e) => e.kind === 'ws-client' && e.meta.name === name);

  return (entry?.handle ?? null) as WebSocketDevtoolsHandle | null;
};

/** `isDevMode()` reads this global, so clearing it is what puts the client on its production path. */
const inProductionMode = <T>(fn: () => T): T => {
  const globals = globalThis as unknown as { ngDevMode?: unknown };
  const previous = globals.ngDevMode;

  globals.ngDevMode = false;

  try {
    return fn();
  } finally {
    globals.ngDevMode = previous;
  }
};

describe('ws scenario', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('joins a room from a consumer, records the join frame in the documented protocol shape, then connects', () => {
    const s = scenario();
    const { double, instance } = createSocket(s);

    const c = s.consumer();
    const room = c.run(() => instance.joinRoom('lobby'));
    s.tick();

    expect(double.sent()).toEqual([{ event: 'join-room', data: 'lobby' }]);
    expect(room()).not.toBeNull();
    expect(instance.isConnected()).toBe(false);

    double.serverConnect();
    expect(instance.isConnected()).toBe(true);
    expect(double.sent()).toEqual([{ event: 'join-room', data: 'lobby' }]);

    c.destroy();
  });

  it('delivers a message for the joined room to its signal, and ignores messages for other rooms', () => {
    const s = scenario();
    const { double, instance } = createSocket(s);

    const c = s.consumer();
    const room = c.run(() => instance.joinRoom('lobby'));
    s.tick();

    double.serverSend({ room: 'other', event: 'score', data: { goals: 9 } });
    expect(room()?.latestMessage()).toBeNull();

    double.serverSend({ room: 'lobby', event: 'score', data: { goals: 1 } });
    expect(room()?.latestMessage()).toEqual({ room: 'lobby', event: 'score', data: { goals: 1 } });

    c.destroy();
  });

  it('leaves the room once when the sole consumer is destroyed', () => {
    const s = scenario();
    const { double, instance } = createSocket(s);

    const c = s.consumer();
    c.run(() => instance.joinRoom('lobby'));
    s.tick();

    c.destroy();

    expect(double.sent()).toEqual([
      { event: 'join-room', data: 'lobby' },
      { event: 'leave-room', data: 'lobby' },
    ]);
  });

  it('shares a room between two consumers: one join sent, and it stays joined until the last one leaves', () => {
    const s = scenario();
    const { double, instance } = createSocket(s);

    const a = s.consumer();
    const b = s.consumer();
    const roomB = b.run(() => instance.joinRoom('lobby'));
    a.run(() => instance.joinRoom('lobby'));
    s.tick();

    expect(double.sent()).toEqual([{ event: 'join-room', data: 'lobby' }]);

    a.destroy();
    expect(double.sent()).toEqual([{ event: 'join-room', data: 'lobby' }]);

    double.serverSend({ room: 'lobby', event: 'score', data: { goals: 2 } });
    expect(roomB()?.latestMessage()).toEqual({ room: 'lobby', event: 'score', data: { goals: 2 } });

    b.destroy();
    expect(double.sent()).toEqual([
      { event: 'join-room', data: 'lobby' },
      { event: 'leave-room', data: 'lobby' },
    ]);
  });

  it('re-joins every held room after the connection drops and reconnects', () => {
    const s = scenario();
    const { double, instance } = createSocket(s);

    const c = s.consumer();
    c.run(() => instance.joinRoom('lobby'));
    s.tick();
    double.serverConnect();

    double.serverDisconnect();
    expect(instance.isConnected()).toBe(false);

    double.serverConnect();
    expect(instance.isConnected()).toBe(true);

    expect(double.sent()).toEqual([
      { event: 'join-room', data: 'lobby' },
      { event: 'join-room', data: 'lobby' },
    ]);

    c.destroy();
  });

  it('re-joins each room exactly once after a reconnect, and sends nothing while the connection is down', () => {
    const s = scenario();
    const { double, instance } = createSocket(s);

    double.serverConnect();

    const c = s.consumer();
    c.run(() => instance.joinRoom('lobby'));
    c.run(() => instance.joinRoom('match:1'));
    s.tick();

    const afterJoin = [
      { event: 'join-room', data: 'lobby' },
      { event: 'join-room', data: 'match:1' },
    ];
    expect(double.sent()).toEqual(afterJoin);

    double.serverDisconnect();
    expect(instance.isConnected()).toBe(false);
    expect(double.sent()).toEqual(afterJoin);

    double.serverConnect();
    expect(instance.isConnected()).toBe(true);
    expect(double.sent()).toEqual([
      ...afterJoin,
      { event: 'join-room', data: 'lobby' },
      { event: 'join-room', data: 'match:1' },
    ]);

    c.destroy();
  });

  it('does not re-join a room that was joined while the connection was down, because that join is still buffered', () => {
    const s = scenario();
    const { double, instance } = createSocket(s);

    double.serverConnect();

    const c = s.consumer();
    c.run(() => instance.joinRoom('lobby'));
    s.tick();

    double.serverDisconnect();
    c.run(() => instance.joinRoom('late'));
    s.tick();

    expect(double.sent()).toEqual([
      { event: 'join-room', data: 'lobby' },
      { event: 'join-room', data: 'late' },
    ]);

    double.serverConnect();
    expect(double.sent()).toEqual([
      { event: 'join-room', data: 'lobby' },
      { event: 'join-room', data: 'late' },
      { event: 'join-room', data: 'lobby' },
    ]);

    c.destroy();
  });

  it('patches a bound query response from a ws message without any network request', () => {
    const s = scenario();
    const { double, instance } = createSocket<SocketMessageView<{ home: number }>>(s);
    s.api.on('GET', '/matches/:id', ({ params }) => ({ body: { id: params['id'], home: 0, away: 0 } }));

    const getMatch = s.get<{
      response: { id: string; home: number; away: number };
      pathParams: { id: string };
    }>((p) => `/matches/${p.id}`);

    const c = s.consumer();
    const room = c.run(() => instance.joinRoom('match:1'));
    const query = c.run(() =>
      getMatch(
        withArgs(() => ({ pathParams: { id: '1' } })),
        withResponseUpdate({
          updater: ({ currentResponse }) => {
            const message = room()?.latestMessage();
            if (!message || !currentResponse) return null;

            return { ...currentResponse, ...message.data };
          },
        }),
      ),
    );

    s.tick();
    expect(query.response()).toEqual({ id: '1', home: 0, away: 0 });
    expect(s.api.requestCount('GET', '/matches/1')).toBe(1);

    double.serverSend({ room: 'match:1', event: 'goal', data: { home: 1 } });
    s.tick();

    expect(query.response()).toEqual({ id: '1', home: 1, away: 0 });
    expect(s.api.requestCount('GET', '/matches/1')).toBe(1);

    c.destroy();
  });

  it('never joins a room whose consumer is destroyed before its effect flushes, and leaves a still-mounted joiner untouched - plans/query-lib-scan.md ws finding 1', () => {
    const s = scenario();
    const { double, instance } = createSocket(s);

    const holder = s.consumer();
    const roomHolder = holder.run(() => instance.joinRoom('lobby'));
    s.tick();

    const doomed = s.consumer();
    doomed.run(() => instance.joinRoom('lobby'));
    doomed.destroy();

    expect(double.sent()).toEqual([{ event: 'join-room', data: 'lobby' }]);

    double.serverSend({ room: 'lobby', event: 'score', data: { goals: 1 } });
    expect(roomHolder()?.latestMessage()).toEqual({ room: 'lobby', event: 'score', data: { goals: 1 } });

    holder.destroy();
    expect(double.sent()).toEqual([
      { event: 'join-room', data: 'lobby' },
      { event: 'leave-room', data: 'lobby' },
    ]);
  });

  it('leaves the room it actually joined, not the one the signal changed to, when destroyed before the next flush - plans/query-lib-scan.md ws finding 2', () => {
    const s = scenario();
    const { double, instance } = createSocket(s);

    const roomName = signal<string | null>('a');
    const c = s.consumer();
    c.run(() => instance.joinRoom(roomName));
    s.tick();

    expect(double.sent()).toEqual([{ event: 'join-room', data: 'a' }]);

    roomName.set('b');
    c.destroy();

    expect(double.sent()).toEqual([
      { event: 'join-room', data: 'a' },
      { event: 'leave-room', data: 'a' },
    ]);
  });

  it('throws ET1000 when subtle.leaveRoom releases a room that was never joined', () => {
    const s = scenario();
    const { instance } = createSocket(s);

    expect(() => instance.subtle.leaveRoom('ghost')).toThrow(/ET1000|not joined/);
  });

  it('throws ET1001 and reports the parse error for a malformed server frame', () => {
    const s = scenario();
    const { double } = createSocket(s);

    expect(() => double.serverSendRaw('{')).toThrow(/ET1001|malformed/);
    s.expectError((entry) => entry.error instanceof SyntaxError);
  });

  it('hands the configured transport list to the io factory in order, and none when the option is omitted', () => {
    const s = scenario();

    const ordered = createWebSocketTestDouble();
    const orderedClient = createWebSocketClient({
      name: `ws-scenario-${socketCounter++}`,
      url: 'ws://localhost',
      io: ordered.io,
      transports: ['websocket', 'polling'],
    });
    s.run(() => orderedClient.inject());

    expect(ordered.connection()).toEqual({ url: 'ws://localhost', transports: ['websocket', 'polling'] });

    const { double } = createSocket(s);
    expect(double.connection()).toEqual({ url: 'ws://localhost', transports: undefined });
  });

  it('always connects with withCredentials: true', () => {
    const s = scenario();
    const double = createWebSocketTestDouble();
    const seen: WebSocketClientIoOptions[] = [];

    const client = createWebSocketClient({
      name: `ws-scenario-${socketCounter++}`,
      url: 'ws://localhost',
      io: (url, options) => {
        seen.push(options);

        return double.io(url, options);
      },
    });
    s.run(() => client.inject());

    expect(seen).toHaveLength(1);
    expect(seen[0]?.withCredentials).toBe(true);
  });

  it('disconnects the socket when the providing injector is destroyed', () => {
    const s = scenario();
    const double = createWebSocketTestDouble();
    const client = createWebSocketClient({
      name: `ws-scenario-${socketCounter++}`,
      url: 'ws://localhost',
      io: double.io,
    });

    const scope = createEnvironmentInjector([client.provide()], s.injector.get(EnvironmentInjector));
    const instance = scope.runInContext(() => client.inject());
    s.tick();

    expect(instance.isConnected()).toBe(false);
    expect(double.state()).toEqual({ connectRequested: true, disconnected: false });

    scope.destroy();

    expect(double.state()).toEqual({ connectRequested: true, disconnected: true });
  });

  it('leaves the previous room, joins the new one and routes messages to the new room when the room function returns a new name', () => {
    const s = scenario();
    const { double, instance } = createSocket(s);

    const matchId = signal('1');
    const c = s.consumer();
    const room = c.run(() => instance.joinRoom(() => `match:${matchId()}`));
    s.tick();

    expect(double.sent()).toEqual([{ event: 'join-room', data: 'match:1' }]);

    matchId.set('2');
    s.tick();

    expect(double.sent()).toEqual([
      { event: 'join-room', data: 'match:1' },
      { event: 'leave-room', data: 'match:1' },
      { event: 'join-room', data: 'match:2' },
    ]);

    double.serverSend({ room: 'match:1', event: 'goal', data: { goals: 1 } });
    expect(room()?.latestMessage()).toBeNull();

    double.serverSend({ room: 'match:2', event: 'goal', data: { goals: 2 } });
    expect(room()?.latestMessage()).toEqual({ room: 'match:2', event: 'goal', data: { goals: 2 } });

    c.destroy();
  });

  it('joins nothing while the room function returns null, and joins once it returns a name', () => {
    const s = scenario();
    const { double, instance } = createSocket(s);

    const roomName = signal<string | null>(null);
    const c = s.consumer();
    const room = c.run(() => instance.joinRoom(() => roomName()));
    s.tick();

    expect(double.sent()).toEqual([]);
    expect(room()).toBeNull();

    roomName.set('lobby');
    s.tick();

    expect(double.sent()).toEqual([{ event: 'join-room', data: 'lobby' }]);
    expect(room()).not.toBeNull();

    double.serverSend({ room: 'lobby', event: 'score', data: { goals: 1 } });
    expect(room()?.latestMessage()).toEqual({ room: 'lobby', event: 'score', data: { goals: 1 } });

    c.destroy();
  });

  it('drops a malformed frame without throwing outside dev mode, and keeps delivering to the joined room', () => {
    const s = scenario();
    const { double, instance } = createSocket(s);

    const c = s.consumer();
    const room = c.run(() => instance.joinRoom('lobby'));
    s.tick();

    expect(() => inProductionMode(() => double.serverSendRaw('{'))).not.toThrow();
    expect(room()?.latestMessage()).toBeNull();

    double.serverSend({ room: 'lobby', event: 'score', data: { goals: 1 } });
    expect(room()?.latestMessage()).toEqual({ room: 'lobby', event: 'score', data: { goals: 1 } });

    s.expectError((entry) => entry.error instanceof SyntaxError);

    c.destroy();
  });

  it('leaves a room that was never joined without throwing outside dev mode', () => {
    const s = scenario();
    const { double, instance } = createSocket(s);

    expect(() => inProductionMode(() => instance.subtle.leaveRoom('ghost'))).not.toThrow();
    expect(double.sent()).toEqual([]);
  });

  it.fails(
    'logs nothing for a malformed frame outside dev mode - ws.md:75 calls it silently dropped, but the client always console.errors it',
    () => {
      const s = scenario();
      const { double } = createSocket(s);

      inProductionMode(() => double.serverSendRaw('{'));

      const logged = s.errors.length;
      while (s.errors.length) s.expectError(() => true);

      expect(logged).toBe(0);
    },
  );

  it('records nothing when devtools are not installed', () => {
    const s = scenario();
    const { double, instance, name } = createSocket(s);

    const c = s.consumer();
    c.run(() => instance.joinRoom('lobby'));
    s.tick();
    double.serverSend({ room: 'lobby', event: 'score', data: { goals: 1 } });

    expect(isQueryDevtoolsEnabled()).toBe(false);
    expect(wsDevtoolsHandle(name)).toBeNull();

    c.destroy();
  });
});

describe('ws devtools scenario', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 }, providers: () => [provideQueryDevtools()] });

  it('records both the room joins it sent and the messages that came back, and emits as the app would', () => {
    const s = scenario();
    const { double, instance, name } = createSocket(s);

    expect(isQueryDevtoolsEnabled()).toBe(true);

    const handle = wsDevtoolsHandle(name);
    if (!handle) throw new Error('the socket registered no devtools entry');

    expect(handle.connected()).toBe(false);

    const roomName = signal<string | null>('lobby');
    const c = s.consumer();
    c.run(() => instance.joinRoom(roomName));
    s.tick();
    double.serverConnect();

    expect(handle.connected()).toBe(true);
    expect(handle.rooms()).toEqual(['lobby']);
    expect(handle.messages()[0]).toMatchObject({ direction: 'out', event: 'join-room', room: 'lobby' });

    double.serverSend({ room: 'lobby', event: 'score', data: { goals: 1 } });

    expect(handle.messages()[0]).toMatchObject({
      direction: 'in',
      event: 'score',
      room: 'lobby',
      data: { goals: 1 },
    });

    handle.emit({ event: 'ping', data: { id: 7 } });

    expect(double.sent()).toContainEqual({ event: 'ping', data: { id: 7 } });
    expect(handle.messages()[0]).toMatchObject({ direction: 'out', event: 'ping', data: { id: 7 }, room: '' });

    roomName.set(null);
    s.tick();

    expect(handle.rooms()).toEqual([]);
    expect(handle.messages()[0]).toMatchObject({ direction: 'out', event: 'leave-room', room: 'lobby' });

    c.destroy();

    // provideQueryDevtools() arms a 500 ms grace timer after the first render. Let it fire, so the
    // timer invariant reports real leaks only.
    s.tick();
    s.tick(600);
  });
});
