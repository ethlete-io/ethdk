import { createEnvironmentInjector, EnvironmentInjector, inject } from '@angular/core';
import {
  FakeBroadcastChannelHandle,
  FakeWebLocksHandle,
  flushMultiTabSync,
  installFakeBroadcastChannel,
  installFakeWebLocks,
} from '@ethlete/query/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createQueryClient, createSecureGetQuery, withBearerAuthMultiTabSync } from '../index';
import { Scenario, ScenarioAuthBuilders, ScenarioConsumer, useScenario } from './harness';

const BASE_URL = 'https://api.test';
const PROVIDER_NAME = 'auth-second-tab-scenario';

type Profile = { response: { id: string } };

let tabCounter = 0;

/** One browser tab: a query client and an auth provider of its own, over the scenario's single fake API. */
const createTab = (s: Scenario) => {
  const clientRef = createQueryClient({
    name: `auth-second-tab-client-${++tabCounter}`,
    baseUrl: BASE_URL,
    keepUnusedFor: 0,
  });

  const clientInjector = createEnvironmentInjector(
    clientRef.provide(),
    s.run(() => inject(EnvironmentInjector)),
  );

  const auth = s.auth({
    clientRef,
    name: PROVIDER_NAME,
    injector: clientInjector,
    refreshStrategy: 0.5,
    features: [withBearerAuthMultiTabSync<ScenarioAuthBuilders>()],
  });

  const consumers: ScenarioConsumer[] = [];

  return {
    auth,
    getSecure: createSecureGetQuery(clientRef, auth.ref),
    consumer: () => {
      const consumer = s.consumer([], auth.injector);

      consumers.push(consumer);

      return consumer;
    },
    destroy: () => {
      for (const consumer of consumers) consumer.destroy();

      auth.injector.destroy();
      clientInjector.destroy();
    },
  };
};

const sync = async (s: Scenario) => {
  await s.settle();
  await flushMultiTabSync();
  await s.settle();
  await flushMultiTabSync();
  await s.settle();
};

describe('second authenticated tab scenario', () => {
  let bus: FakeBroadcastChannelHandle;
  let locks: FakeWebLocksHandle;

  beforeEach(() => {
    bus = installFakeBroadcastChannel();
    locks = installFakeWebLocks();
  });

  afterEach(() => {
    bus.restore();
    locks.restore();
  });

  const scenario = useScenario({ baseUrl: BASE_URL, clientOptions: { keepUnusedFor: 0 } });

  it('gives each tab an auth provider of its own, and a login in one authenticates the other', async () => {
    const s = scenario();
    s.api.protect('/secure/**');
    s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));

    const a = createTab(s);
    const b = createTab(s);
    await sync(s);

    expect(a.auth).not.toBe(b.auth);
    expect(a.auth.features.multiTabSync.isLeader()).toBe(true);
    expect(b.auth.features.multiTabSync.isLeader()).toBe(false);

    s.tick(251); // the bounded wait for another tab's session
    await sync(s);
    expect(b.auth.sessionStatus()).toBe('anonymous');

    const profileB = b.consumer().run(() => b.getSecure<Profile>('/secure/profile')());
    s.tick();
    expect(s.api.requestCount('GET', '/secure/profile')).toBe(0);

    a.auth.queries.login.execute({ body: {} });
    await sync(s);

    expect(b.auth.accessToken()).toBe(a.auth.accessToken());
    expect(b.auth.executionState()).toEqual({ type: 'tokenSeed', state: 'success' });
    expect(b.auth.sessionStatus()).toBe('authenticated');
    expect(profileB.response()).toEqual({ id: 'me' });
    expect(s.api.requestCount('POST', '/auth/login')).toBe(1);

    const profileA = a.consumer().run(() => a.getSecure<Profile>('/secure/profile')());
    await sync(s);

    expect(profileA.response()).toEqual({ id: 'me' });
    expect(s.api.requestCount('GET', '/secure/profile')).toBe(2);

    a.destroy();
    b.destroy();
  });

  it('ends the session in the other tab when one logs out', async () => {
    const s = scenario();
    s.api.protect('/secure/**');
    s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));

    const a = createTab(s);
    const b = createTab(s);
    await sync(s);

    a.auth.queries.login.execute({ body: {} });
    await sync(s);

    const profileB = b.consumer().run(() => b.getSecure<Profile>('/secure/profile')());
    await sync(s);
    expect(profileB.response()).toEqual({ id: 'me' });

    b.auth.logout();
    await sync(s);

    expect(b.auth.sessionEndCause()).toBe('user');
    expect(a.auth.sessionStatus()).toBe('anonymous');
    expect(a.auth.sessionEndCause()).toBe('otherTab');
    expect(a.auth.accessToken()).toBeNull();
    expect(profileB.response()).toBeNull();

    a.destroy();
    b.destroy();
  });

  it('closes a tab with its own injector, so the surviving tab takes the leadership over', async () => {
    const s = scenario();

    const a = createTab(s);
    const b = createTab(s);
    await sync(s);

    a.auth.queries.login.execute({ body: {} });
    await sync(s);

    expect(a.auth.features.multiTabSync.isLeader()).toBe(true);
    expect(b.auth.features.multiTabSync.isLeader()).toBe(false);

    a.destroy();
    await sync(s);

    expect(b.auth.features.multiTabSync.isLeader()).toBe(true);
    expect(b.auth.isAuthenticated()).toBe(true);

    s.tick(7.5 * 60 * 1000);
    await sync(s);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(b.auth.accessToken()).not.toBeNull();

    b.destroy();
  });

  it('refreshes in the leader only, and the follower adopts the pair it broadcast', async () => {
    const s = scenario();

    const a = createTab(s);
    const b = createTab(s);
    await sync(s);

    a.auth.queries.login.execute({ body: {} });
    await sync(s);

    const tokenAtLogin = a.auth.accessToken();
    expect(b.auth.accessToken()).toBe(tokenAtLogin);

    s.tick(7.5 * 60 * 1000);
    await sync(s);

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(a.auth.accessToken()).not.toBe(tokenAtLogin);
    expect(b.auth.accessToken()).toBe(a.auth.accessToken());
    expect(b.auth.refreshToken()).toBe(a.auth.refreshToken());

    a.destroy();
    b.destroy();
  });
});
