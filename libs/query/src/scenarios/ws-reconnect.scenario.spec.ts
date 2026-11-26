import { SocketMessageView, createWebSocketClient } from '../index';
import { createWebSocketTestDouble } from '@ethlete/query/testing';
import { describe, expect, it } from 'vitest';
import { Scenario, useScenario } from './harness';

let socketCounter = 0;

const createSocket = (s: Scenario) => {
  const double = createWebSocketTestDouble();
  const client = createWebSocketClient({
    name: `ws-reconnect-scenario-${socketCounter++}`,
    url: 'ws://localhost',
    io: double.io,
  });

  return { double, instance: s.run(() => client.inject()) };
};

const reconnectAfterServerClose = (s: Scenario, double: ReturnType<typeof createWebSocketTestDouble>) => {
  double.serverDisconnect({ reason: 'io server disconnect' });
  s.tick(1000);
  double.serverConnect();
};

describe('ws scenario: reconnect after the server closed the connection', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('keeps a messages$ subscription open across the reconnect and delivers the next message to it', () => {
    const s = scenario();
    const { double, instance } = createSocket(s);
    double.serverConnect();

    const c = s.consumer();
    const room = c.run(() => instance.joinRoom('lobby'));
    s.tick();

    const received: SocketMessageView[] = [];
    let completed = false;
    room()?.messages$.subscribe({ next: (m) => received.push(m), complete: () => (completed = true) });

    double.serverSend({ room: 'lobby', event: 'goal', data: { goals: 1 } });
    reconnectAfterServerClose(s, double);

    expect(instance.isConnected()).toBe(true);
    expect(completed).toBe(false);

    double.serverSend({ room: 'lobby', event: 'goal', data: { goals: 2 } });

    expect(received.map((m) => m.data)).toEqual([{ goals: 1 }, { goals: 2 }]);
    expect(room()?.latestMessage()).toEqual({ room: 'lobby', event: 'goal', data: { goals: 2 } });
    expect(double.delivered().filter((m) => m.event === 'join-room')).toEqual([
      { event: 'join-room', data: 'lobby' },
      { event: 'join-room', data: 'lobby' },
    ]);

    c.destroy();
  });

  it('re-joins only the rooms still held when one consumer leaves during the reconnect backoff', () => {
    const s = scenario();
    const { double, instance } = createSocket(s);
    double.serverConnect();

    const kept = s.consumer();
    const left = s.consumer();
    kept.run(() => instance.joinRoom('lobby'));
    left.run(() => instance.joinRoom('match-1'));
    s.tick();

    double.serverDisconnect({ reason: 'io server disconnect' });
    left.destroy();
    s.tick(1000);
    double.serverConnect();
    s.tick();

    const afterReconnect = double.delivered().slice(2);
    expect(afterReconnect).toEqual([{ event: 'join-room', data: 'lobby' }]);

    double.serverSend({ room: 'match-1', event: 'goal', data: { goals: 1 } });
    double.serverSend({ room: 'lobby', event: 'goal', data: { goals: 1 } });

    kept.destroy();
    expect(double.delivered().slice(2)).toEqual([
      { event: 'join-room', data: 'lobby' },
      { event: 'leave-room', data: 'lobby' },
    ]);
  });

  it('still reconnects when every consumer leaves during the backoff, and joins nothing on the new session', () => {
    const s = scenario();
    const { double, instance } = createSocket(s);
    double.serverConnect();

    const c = s.consumer();
    c.run(() => instance.joinRoom('lobby'));
    s.tick();

    double.serverDisconnect({ reason: 'io server disconnect' });
    c.destroy();
    s.tick(1000);
    double.serverConnect();
    s.tick();

    expect(instance.isConnected()).toBe(true);
    expect(double.delivered()).toEqual([{ event: 'join-room', data: 'lobby' }]);
  });

  it('joins a room first requested during the backoff exactly once, on the new session', () => {
    const s = scenario();
    const { double, instance } = createSocket(s);
    double.serverConnect();

    const c = s.consumer();
    c.run(() => instance.joinRoom('lobby'));
    s.tick();

    double.serverDisconnect({ reason: 'io server disconnect' });
    const late = s.consumer();
    const lateRoom = late.run(() => instance.joinRoom('match-2'));
    s.tick(1000);
    double.serverConnect();
    s.tick();

    const joins = double.delivered().filter((m) => m.event === 'join-room');
    expect(joins.filter((m) => m.data === 'match-2')).toHaveLength(1);
    expect(joins.filter((m) => m.data === 'lobby')).toHaveLength(2);

    double.serverSend({ room: 'match-2', event: 'goal', data: { goals: 3 } });
    expect(lateRoom()?.latestMessage()?.data).toEqual({ goals: 3 });

    late.destroy();
    c.destroy();
  });

  it('survives a second server close during the first reconnect and re-joins once the connection holds', () => {
    const s = scenario();
    const { double, instance } = createSocket(s);
    double.serverConnect();

    const c = s.consumer();
    const room = c.run(() => instance.joinRoom('lobby'));
    s.tick();

    reconnectAfterServerClose(s, double);
    double.serverDisconnect({ reason: 'io server disconnect' });
    s.tick(60_000);
    double.serverConnect();
    s.tick();

    expect(instance.isConnected()).toBe(true);
    double.serverSend({ room: 'lobby', event: 'goal', data: { goals: 4 } });
    expect(room()?.latestMessage()?.data).toEqual({ goals: 4 });
    expect(double.delivered().filter((m) => m.event === 'join-room')).toHaveLength(3);

    c.destroy();
  });
});
