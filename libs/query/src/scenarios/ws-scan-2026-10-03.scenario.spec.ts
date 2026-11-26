import { signal } from '@angular/core';
import { createWebSocketClient } from '../index';
import { createWebSocketTestDouble } from '@ethlete/query/testing';
import { describe, expect, it } from 'vitest';
import { Scenario, useScenario } from './harness';

let socketCounter = 0;

const createSocket = (s: Scenario) => {
  const double = createWebSocketTestDouble();
  const client = createWebSocketClient({ name: `ws-scan-${socketCounter++}`, url: 'ws://localhost', io: double.io });

  return { double, instance: s.run(() => client.inject()) };
};

describe('ws scan 2026-10-03', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('leaves a reactive room on destroy when a signal it reads changed without changing the room name', () => {
    const s = scenario();
    const { double, instance } = createSocket(s);
    double.serverConnect();

    const user = signal({ teamId: 1, name: 'Ada' });

    const c = s.consumer();
    c.run(() => instance.joinRoom(() => `team:${user().teamId}`));
    s.tick();

    user.set({ teamId: 1, name: 'Grace' });
    s.tick();

    c.destroy();
    s.tick();

    expect(double.sent()).toEqual([
      { event: 'join-room', data: 'team:1' },
      { event: 'leave-room', data: 'team:1' },
    ]);
  });

  it('switches rooms once after a signal it reads changed without changing the room name', () => {
    const s = scenario();
    const { double, instance } = createSocket(s);
    double.serverConnect();

    const user = signal({ teamId: 1, name: 'Ada' });

    const c = s.consumer();
    c.run(() => instance.joinRoom(() => `team:${user().teamId}`));
    s.tick();

    user.set({ teamId: 1, name: 'Grace' });
    s.tick();

    user.set({ teamId: 2, name: 'Grace' });
    s.tick();

    expect(double.sent()).toEqual([
      { event: 'join-room', data: 'team:1' },
      { event: 'leave-room', data: 'team:1' },
      { event: 'join-room', data: 'team:2' },
    ]);

    c.destroy();
  });
});
