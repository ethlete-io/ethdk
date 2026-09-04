import { signal } from '@angular/core';
import { createWebSocketClient, SocketMessageView, withArgs, withResponseUpdate } from '../index';
import { createWebSocketTestDouble } from '@ethlete/query/testing';
import { describe, expect, it } from 'vitest';
import { Scenario, useScenario } from './harness';

let socketCounter = 0;

const createSocket = <TMessageData extends SocketMessageView = SocketMessageView>(s: Scenario) => {
  const double = createWebSocketTestDouble();
  const client = createWebSocketClient<TMessageData>({
    name: `ws-scenario-${socketCounter++}`,
    url: 'ws://localhost',
    io: double.io,
  });

  const instance = s.run(() => client.inject());

  return { double, instance };
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
    expect(double.sent()).toEqual([
      { event: 'join-room', data: 'lobby' },
      { event: 'join-room', data: 'lobby' },
    ]);

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
});
