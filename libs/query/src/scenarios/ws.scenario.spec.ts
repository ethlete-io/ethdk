import { EnvironmentInjector, PLATFORM_ID, createEnvironmentInjector, signal } from '@angular/core';
import {
  SocketMessageView,
  WebSocketDevtoolsHandle,
  createWebSocketClient,
  provideQueryDevtools,
  withArgs,
  withPersistentAuth,
  withResponseUpdate,
} from '../index';
import { isQueryDevtoolsEnabled, queryDevtoolsEntries } from '../../devtools-contract';
import { createWebSocketTestDouble } from '@ethlete/query/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { mintToken, Scenario, ScenarioAuthBuilders, useScenario } from './harness';

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

  it('delivers a room joined after the ping expired exactly once, although isConnected was still true', () => {
    const s = scenario();
    const { double, instance } = createSocket(s);

    double.serverConnect();

    const c = s.consumer();
    c.run(() => instance.joinRoom('lobby'));
    s.tick();

    double.serverPingExpire();
    expect(instance.isConnected()).toBe(true);

    c.run(() => instance.joinRoom('late'));
    s.tick();

    double.serverDisconnect();
    double.serverConnect();

    expect(double.delivered()).toEqual([
      { event: 'join-room', data: 'lobby' },
      { event: 'join-room', data: 'late' },
      { event: 'join-room', data: 'lobby' },
    ]);

    c.destroy();
  });

  it('re-joins nothing after a recovered reconnect, because the server kept the rooms', () => {
    const s = scenario();
    const { double, instance } = createSocket(s);

    double.serverConnect();

    const c = s.consumer();
    c.run(() => instance.joinRoom('lobby'));
    s.tick();

    double.serverDisconnect();
    c.run(() => instance.joinRoom('late'));
    s.tick();

    double.serverConnect({ recovered: true });

    expect(double.delivered()).toEqual([
      { event: 'join-room', data: 'lobby' },
      { event: 'join-room', data: 'late' },
    ]);

    c.destroy();
  });

  it('does not flush a leave to a fresh session that never joined the room, when the room was left while the connection was down', () => {
    const s = scenario();
    const { double, instance } = createSocket(s);

    double.serverConnect();

    const c = s.consumer();
    c.run(() => instance.joinRoom('lobby'));
    s.tick();

    double.serverDisconnect();
    c.destroy();

    double.serverConnect();

    expect(double.delivered()).toEqual([{ event: 'join-room', data: 'lobby' }]);
  });

  it('leaves a room left while the connection was down after a recovered reconnect, because the server kept it', () => {
    const s = scenario();
    const { double, instance } = createSocket(s);

    double.serverConnect();

    const c = s.consumer();
    c.run(() => instance.joinRoom('lobby'));
    s.tick();

    double.serverDisconnect();
    c.destroy();

    double.serverConnect({ recovered: true });

    expect(double.delivered()).toEqual([
      { event: 'join-room', data: 'lobby' },
      { event: 'leave-room', data: 'lobby' },
    ]);
  });

  it('leaves a room again after it was left, re-joined and left while the connection was down, because the re-join is buffered', () => {
    const s = scenario();
    const { double, instance } = createSocket(s);

    double.serverConnect();

    const first = s.consumer();
    first.run(() => instance.joinRoom('lobby'));
    s.tick();

    double.serverDisconnect();
    first.destroy();

    const second = s.consumer();
    second.run(() => instance.joinRoom('lobby'));
    s.tick();
    second.destroy();

    double.serverConnect();

    expect(double.delivered()).toEqual([
      { event: 'join-room', data: 'lobby' },
      { event: 'join-room', data: 'lobby' },
      { event: 'leave-room', data: 'lobby' },
    ]);
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

  it('never joins a room whose consumer is destroyed before its effect flushes, and leaves a still-mounted joiner untouched', () => {
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

  it('leaves the room it actually joined, not the one the signal changed to, when destroyed before the next flush', () => {
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

  it('throws a clear error when joinRoom is called outside an injection context', () => {
    const s = scenario();
    const { instance } = createSocket(s);

    expect(() => instance.joinRoom('lobby')).toThrow(/NG0203|injection context/);
  });

  it('reports a frame that parses as JSON but carries no room', () => {
    const s = scenario();
    const { double, instance } = createSocket(s);

    const c = s.consumer();
    const room = c.run(() => instance.joinRoom('lobby'));
    s.tick();

    expect(() => double.serverSendRaw('"hello"')).toThrow(/ET1001|malformed/);
    expect(() => double.serverSendRaw('{"nope":1}')).toThrow(/ET1001|malformed/);
    expect(room()?.latestMessage()).toBeNull();

    s.expectError((entry) => String(entry.error).includes('ET1001'));
    s.expectError((entry) => String(entry.error).includes('ET1001'));

    c.destroy();
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

  it('connects with withCredentials: true by default, and with the configured value when set', () => {
    const s = scenario();

    const { double } = createSocket(s);
    expect(double.withCredentials()).toBe(true);

    const anonymous = createWebSocketTestDouble();
    const anonymousClient = createWebSocketClient({
      name: `ws-scenario-${socketCounter++}`,
      url: 'ws://localhost',
      io: anonymous.io,
      withCredentials: false,
    });
    s.run(() => anonymousClient.inject());

    expect(anonymous.withCredentials()).toBe(false);
  });

  it('sends a static auth payload with every handshake, and none when auth is omitted', () => {
    const s = scenario();

    const double = createWebSocketTestDouble();
    const client = createWebSocketClient({
      name: `ws-scenario-${socketCounter++}`,
      url: 'ws://localhost',
      io: double.io,
      auth: { token: 'static' },
    });
    s.run(() => client.inject());

    double.serverConnect();
    double.serverDisconnect();
    double.serverConnect();

    expect(double.handshakes()).toEqual([{ token: 'static' }, { token: 'static' }]);

    const { double: plain } = createSocket(s);
    plain.serverConnect();

    expect(plain.handshakes()).toEqual([null]);
  });

  it('reads the auth function again on every reconnect, so a rotated token reaches the next handshake', () => {
    const s = scenario();

    let token = 'first';
    const double = createWebSocketTestDouble();
    const client = createWebSocketClient({
      name: `ws-scenario-${socketCounter++}`,
      url: 'ws://localhost',
      io: double.io,
      auth: () => ({ token }),
    });
    s.run(() => client.inject());

    double.serverConnect();
    token = 'rotated';
    double.serverDisconnect();
    double.serverConnect();

    expect(double.handshakes()).toEqual([{ token: 'first' }, { token: 'rotated' }]);
  });

  it('sends a consumer message through the public send, buffered until the connection is up', () => {
    const s = scenario();
    const { double, instance } = createSocket(s);

    instance.send({ event: 'ping', data: { id: 1 } });

    expect(double.sent()).toEqual([{ event: 'ping', data: { id: 1 } }]);
    expect(double.delivered()).toEqual([]);

    double.serverConnect();
    instance.send({ event: 'ping', data: { id: 2 } });

    expect(double.delivered()).toEqual([
      { event: 'ping', data: { id: 1 } },
      { event: 'ping', data: { id: 2 } },
    ]);
  });

  it('streams every message of one tick through messages$, while latestMessage holds only the last', () => {
    const s = scenario();
    const { double, instance } = createSocket(s);

    const c = s.consumer();
    const room = c.run(() => instance.joinRoom('lobby'));
    s.tick();

    const received: SocketMessageView[] = [];
    let completed = false;
    room()?.messages$.subscribe({ next: (m) => received.push(m), complete: () => (completed = true) });

    double.serverSend({ room: 'lobby', event: 'goal', data: { goals: 1 } });
    double.serverSend({ room: 'other', event: 'goal', data: { goals: 9 } });
    double.serverSend({ room: 'lobby', event: 'goal', data: { goals: 2 } });
    s.tick();

    expect(received).toEqual([
      { room: 'lobby', event: 'goal', data: { goals: 1 } },
      { room: 'lobby', event: 'goal', data: { goals: 2 } },
    ]);
    expect(room()?.latestMessage()).toEqual({ room: 'lobby', event: 'goal', data: { goals: 2 } });
    expect(completed).toBe(false);

    c.destroy();

    expect(completed).toBe(true);
  });

  it('hands a static room to the caller at once, so a messages$ subscription right after joinRoom gets the next message', () => {
    const s = scenario();
    const { double, instance } = createSocket(s);

    const c = s.consumer();
    const received: SocketMessageView[] = [];

    c.run(() => {
      const room = instance.joinRoom('lobby');

      room()?.messages$.subscribe((m) => received.push(m));
    });

    expect(double.sent()).toEqual([{ event: 'join-room', data: 'lobby' }]);

    double.serverConnect();
    double.serverSend({ room: 'lobby', event: 'goal', data: { goals: 1 } });

    expect(received).toEqual([{ room: 'lobby', event: 'goal', data: { goals: 1 } }]);

    c.destroy();
    expect(double.sent()).toEqual([
      { event: 'join-room', data: 'lobby' },
      { event: 'leave-room', data: 'lobby' },
    ]);
  });

  it('completes messages$ of a still-joined room when the providing injector is destroyed', () => {
    const s = scenario();
    const double = createWebSocketTestDouble();
    const client = createWebSocketClient({
      name: `ws-scenario-${socketCounter++}`,
      url: 'ws://localhost',
      io: double.io,
    });

    const scope = createEnvironmentInjector([client.provide()], s.injector.get(EnvironmentInjector));
    const instance = scope.runInContext(() => client.inject());
    const c = s.consumer();
    const room = c.run(() => instance.joinRoom('lobby'));
    s.tick();

    let completed = false;
    room()?.messages$.subscribe({ complete: () => (completed = true) });

    scope.destroy();

    expect(completed).toBe(true);

    c.destroy();
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
    expect(double.state()).toMatchObject({ connectRequested: true, disconnected: false });

    scope.destroy();

    expect(double.state()).toMatchObject({ connectRequested: true, disconnected: true });
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

    c.destroy();
  });

  it('leaves a room that was never joined without throwing outside dev mode', () => {
    const s = scenario();
    const { double, instance } = createSocket(s);

    expect(() => inProductionMode(() => instance.subtle.leaveRoom('ghost'))).not.toThrow();
    expect(double.sent()).toEqual([]);
  });

  it('logs nothing for a malformed frame outside dev mode', () => {
    const s = scenario();
    const { double } = createSocket(s);

    inProductionMode(() => double.serverSendRaw('{'));
    inProductionMode(() => double.serverSendRaw('{"nope":1}'));

    const logged = s.errors.length;
    while (s.errors.length) s.expectError(() => true);

    expect(logged).toBe(0);
  });

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

describe('ws scenario: reconnects socket.io gives up on', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  const createAuthedSocket = (s: Scenario) => {
    const double = createWebSocketTestDouble();
    const token = signal('token-1');
    const client = createWebSocketClient({
      name: `ws-scenario-${socketCounter++}`,
      url: 'ws://localhost',
      io: double.io,
      auth: () => ({ token: token() }),
    });

    const instance = s.run(() => client.inject());

    return { double, instance, token };
  };

  it('reconnects after an io server disconnect with the rotated auth, and re-joins its rooms', () => {
    const s = scenario();
    const { double, instance, token } = createAuthedSocket(s);

    const c = s.consumer();
    c.run(() => instance.joinRoom('lobby'));
    s.tick();
    double.serverConnect();

    token.set('token-2');
    double.serverDisconnect({ reason: 'io server disconnect' });

    expect(instance.isConnected()).toBe(false);
    expect(double.state().connectCalls).toBe(1);

    s.tick(999);
    expect(double.state().connectCalls).toBe(1);

    s.tick(1);
    expect(double.state().connectCalls).toBe(2);

    double.serverConnect();

    expect(instance.isConnected()).toBe(true);
    expect(double.handshakes()).toEqual([{ token: 'token-1' }, { token: 'token-2' }]);
    expect(double.delivered().filter((m) => m.event === 'join-room')).toEqual([
      { event: 'join-room', data: 'lobby' },
      { event: 'join-room', data: 'lobby' },
    ]);

    c.destroy();
  });

  it('retries a rejected handshake with a growing backoff and the current auth each time', () => {
    const s = scenario();
    const { double, instance, token } = createAuthedSocket(s);

    double.serverRejectHandshake('expired');
    token.set('token-2');

    s.tick(1000);
    expect(double.state().connectCalls).toBe(2);

    double.serverRejectHandshake('expired');

    s.tick(1999);
    expect(double.state().connectCalls).toBe(2);

    s.tick(1);
    expect(double.state().connectCalls).toBe(3);

    token.set('token-3');
    double.serverConnect();

    expect(instance.isConnected()).toBe(true);
    expect(double.handshakes()).toEqual([{ token: 'token-1' }, { token: 'token-2' }, { token: 'token-3' }]);
  });

  it('starts the backoff over once a connection stayed up for 10 s', () => {
    const s = scenario();
    const { double } = createAuthedSocket(s);

    double.serverRejectHandshake('expired');
    s.tick(1000);
    double.serverRejectHandshake('expired');
    s.tick(2000);
    expect(double.state().connectCalls).toBe(3);

    double.serverConnect();
    s.tick(10_000);
    double.serverDisconnect();
    double.serverRejectHandshake('expired');

    s.tick(999);
    expect(double.state().connectCalls).toBe(3);

    s.tick(1);
    expect(double.state().connectCalls).toBe(4);
  });

  it('keeps doubling the backoff when the server kicks a connection before it stayed up for 10 s', () => {
    const s = scenario();
    const { double } = createAuthedSocket(s);

    double.serverRejectHandshake('expired');
    s.tick(1000);
    double.serverRejectHandshake('expired');
    s.tick(2000);
    expect(double.state().connectCalls).toBe(3);

    double.serverConnect();
    s.tick(9_999);
    double.serverDisconnect({ reason: 'io server disconnect' });

    s.tick(3999);
    expect(double.state().connectCalls).toBe(3);

    s.tick(1);
    expect(double.state().connectCalls).toBe(4);
  });

  it('leaves a transport close to socket.io, which reconnects on its own', () => {
    const s = scenario();
    const { double } = createAuthedSocket(s);

    double.serverConnect();
    double.serverDisconnect();
    s.tick(60_000);

    expect(double.state().connectCalls).toBe(1);
  });

  it('cancels a scheduled reconnect when the client is destroyed', () => {
    const s = scenario();
    const double = createWebSocketTestDouble();
    const client = createWebSocketClient({
      name: `ws-scenario-${socketCounter++}`,
      url: 'ws://localhost',
      io: double.io,
    });

    const scope = createEnvironmentInjector([client.provide()], s.injector.get(EnvironmentInjector));
    scope.runInContext(() => client.inject());
    double.serverConnect();
    double.serverDisconnect({ reason: 'io server disconnect' });

    scope.destroy();
    s.tick(60_000);

    expect(double.state().connectCalls).toBe(1);
  });
});

describe('ws scenario: server render', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('opens no connection, joins no room and reports not connected', () => {
    const s = scenario();
    const double = createWebSocketTestDouble();
    const client = createWebSocketClient({
      name: `ws-scenario-${socketCounter++}`,
      url: 'ws://localhost',
      io: double.io,
    });

    const scope = createEnvironmentInjector(
      [{ provide: PLATFORM_ID, useValue: 'server' }, client.provide()],
      s.injector.get(EnvironmentInjector),
    );
    const instance = scope.runInContext(() => client.inject());
    const c = s.consumer([], scope);
    const room = c.run(() => instance.joinRoom('lobby'));
    instance.send({ event: 'cheer', data: null });
    s.tick();

    expect(double.connection()).toBeNull();
    expect(double.sent()).toEqual([]);
    expect(room()).toBeNull();
    expect(instance.isConnected()).toBe(false);

    c.destroy();
    scope.destroy();
  });
});

describe('ws scenario with an auth provider', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  afterEach(() => {
    document.cookie = 'etAuth=; max-age=0; path=/';
  });

  const boot = (s: Scenario, features: Parameters<Scenario['auth']>[0] = {}) => {
    const auth = s.auth(features);
    const double = createWebSocketTestDouble();
    const client = createWebSocketClient({
      name: `ws-scenario-${socketCounter++}`,
      url: 'ws://localhost',
      io: double.io,
      authProvider: auth.ref,
    });
    const instance = s.run(() => client.inject());
    const consumer = s.consumer();

    const login = () => {
      consumer.run(() => auth.queries.login.execute({ body: {} }));
      s.tick();
    };

    return { auth, double, instance, consumer, login };
  };

  const tokenOf = (handshake: object | null) => (handshake as { token: string | null }).token;

  it('connects once the session is restored, with the restored access token in the handshake', async () => {
    const s = scenario();
    const seed = boot(s, {
      features: [withPersistentAuth<ScenarioAuthBuilders>({ autoLogin: { queryKey: 'refresh' } })],
    });

    seed.login();
    await s.settle();
    seed.consumer.destroy();

    s.api.once('POST', '/auth/refresh', () => ({
      body: { accessToken: mintToken(), refreshToken: mintToken({ expiresInMs: 3600000 }) },
      delay: 500,
    }));

    const { auth, double, instance, consumer } = boot(s, {
      features: [withPersistentAuth<ScenarioAuthBuilders>({ autoLogin: { queryKey: 'refresh' } })],
    });
    await s.settle();

    expect(auth.sessionStatus()).toBe('restoring');
    expect(double.state().connectCalls).toBe(0);

    await s.settle(600);
    double.serverConnect();

    expect(auth.sessionStatus()).toBe('authenticated');
    expect(double.state().connectCalls).toBe(1);
    expect(double.handshakes()).toEqual([{ token: auth.accessToken() }]);
    expect(instance.isConnected()).toBe(true);

    consumer.destroy();
  });

  it('connects anonymously when there is nothing to restore, then reconnects with the token after a login', () => {
    const s = scenario();
    const { auth, double, instance, consumer, login } = boot(s);

    s.tick();
    expect(auth.sessionStatus()).toBe('anonymous');
    expect(double.state().connectCalls).toBe(1);

    double.serverConnect();
    expect(tokenOf(double.handshakes()[0] ?? null)).toBeNull();

    const room = consumer.run(() => instance.joinRoom('lobby'));
    login();

    expect(double.state().connectCalls).toBe(2);
    expect(instance.isConnected()).toBe(false);

    double.serverConnect();

    expect(tokenOf(double.handshakes()[1] ?? null)).toBe(auth.accessToken());
    expect(double.sent().filter((m) => m.event === 'join-room')).toHaveLength(2);
    expect(room()).not.toBeNull();

    consumer.destroy();
  });

  it('does not reconnect when the token rotates inside the session, and the next reconnect reads the fresh token', () => {
    const s = scenario();
    const { auth, double, instance, consumer, login } = boot(s, {
      accessTokenExpiresInMs: 20_000,
      refreshStrategy: 1000,
    });

    login();
    double.serverConnect();

    const first = auth.accessToken();
    const callsBefore = double.state().connectCalls;

    s.tick(19_500);
    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(auth.accessToken()).not.toBe(first);
    expect(double.state().connectCalls).toBe(callsBefore);
    expect(instance.isConnected()).toBe(true);

    double.serverDisconnect();
    double.serverConnect();

    expect(tokenOf(double.handshakes().at(-1) ?? null)).toBe(auth.accessToken());

    consumer.destroy();
  });

  it('completes the joined rooms on logout and reconnects as anonymous', () => {
    const s = scenario();
    const { auth, double, instance, consumer, login } = boot(s);

    login();
    double.serverConnect();

    const room = consumer.run(() => instance.joinRoom('lobby'));
    let completed = false;
    room()?.messages$.subscribe({ complete: () => (completed = true) });
    const connectCalls = double.state().connectCalls;

    auth.logout();
    s.tick();

    expect(completed).toBe(true);
    expect(room()).toBeNull();
    expect(instance.isConnected()).toBe(false);
    expect(double.state().connectCalls).toBe(connectCalls + 1);

    double.serverConnect();

    expect(tokenOf(double.handshakes().at(-1) ?? null)).toBeNull();
    expect(instance.isConnected()).toBe(true);

    consumer.destroy();
    s.tick();
  });
});
