import {
  createEnvironmentInjector,
  effect,
  EnvironmentInjector,
  inject,
  InjectionToken,
  isDevMode,
  signal,
} from '@angular/core';
import { createQueryBatch, withArgs } from '../../index';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_EFFECT_RUNS_PER_FLUSH } from './effect-loop-guard';
import { MAX_REQUESTS_PER_ROUTE } from './invariants';
import { createScenario, inProductionMode, useScenario } from './scenario';

type GetUserArgs = { response: { id: string }; pathParams: { id: string } };

describe('buildScenario', () => {
  it('restores console.error and XMLHttpRequest when the build throws', () => {
    const originalConsoleError = console.error;
    const originalXhr = globalThis.XMLHttpRequest;

    const scenario = createScenario({
      providers: () => {
        throw new Error('provider boom');
      },
    });

    expect(() => scenario()).toThrow('provider boom');
    expect(console.error).toBe(originalConsoleError);
    expect(globalThis.XMLHttpRequest).toBe(originalXhr);
  });
});

describe('loop invariants', () => {
  beforeEach(() =>
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] }),
  );
  afterEach(() => vi.useRealTimers());

  it('fails a scenario that sends more requests to one route than the storm threshold', () => {
    const s = createScenario({ clientOptions: { keepUnusedFor: 0 } })();
    s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getUser = s.get<GetUserArgs>((p) => `/users/${p.id}`);
    const c = s.consumer();
    const query = c.run(() => getUser(withArgs(() => ({ pathParams: { id: '1' } }))));

    for (let i = 0; i <= MAX_REQUESTS_PER_ROUTE; i++) {
      query.execute({ options: { allowCache: false } });
      s.tick(200);
    }

    expect(() => s.destroy()).toThrow(
      `requests: more than ${MAX_REQUESTS_PER_ROUTE} requests to one route: GET /users/1`,
    );
  });

  it('stops an effect that re-dirties itself instead of looping forever', () => {
    const s = createScenario()();
    const count = signal(0);
    let runs = 0;

    s.run(() =>
      effect(() => {
        runs++;
        count.set(count() + 1);
      }),
    );

    expect(() => s.tick()).toThrow(/endless reactive loop/);
    expect(runs).toBe(MAX_EFFECT_RUNS_PER_FLUSH);

    s.destroy();
  });
});

describe('inProductionMode', () => {
  it('runs the block outside dev mode and restores the previous mode', () => {
    expect(isDevMode()).toBe(true);
    expect(inProductionMode(() => isDevMode())).toBe(false);
    expect(isDevMode()).toBe(true);
  });
});

describe('scenario controls', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('hands a consumer the providers it was created with', () => {
    const s = scenario();
    const token = new InjectionToken<string>('scenario-consumer-token');
    const c = s.consumer([{ provide: token, useValue: 'from the consumer' }]);

    expect(c.run(() => inject(token))).toBe('from the consumer');
    expect(s.injector.get(token, null)).toBeNull();

    c.destroy();
  });

  it('creates a consumer below the parent injector it was given', () => {
    const s = scenario();
    const token = new InjectionToken<string>('scenario-parent-token');
    const parent = createEnvironmentInjector(
      [{ provide: token, useValue: 'from the tab' }],
      s.run(() => inject(EnvironmentInjector)),
    );

    const c = s.consumer([], parent);

    expect(c.run(() => inject(token))).toBe('from the tab');
    expect(s.consumer().run(() => inject(token, { optional: true }))).toBeNull();

    c.destroy();
    parent.destroy();
  });

  it('gives an auth provider created below a tab injector an instance that only that tab resolves', () => {
    const s = scenario();
    const tabInjector = createEnvironmentInjector(
      [],
      s.run(() => inject(EnvironmentInjector)),
    );

    const auth = s.auth({ injector: tabInjector });
    const inTab = s.consumer([], auth.injector);
    const inRoot = s.consumer();

    expect(inTab.run(() => auth.ref.inject())).toBe(auth);
    expect(inRoot.run(() => auth.ref.inject())).not.toBe(auth);

    inTab.destroy();
    inRoot.destroy();
    auth.injector.destroy();
    tabInjector.destroy();
  });

  it('captures a warning without adding to the errors', () => {
    const s = scenario();

    console.warn('a deprecation notice');

    expect(s.errors).toHaveLength(0);
    s.expectWarning(/deprecation/);
    expect(s.warnings).toHaveLength(0);
  });

  it('lists the live queries created through its own creators', () => {
    const s = scenario();
    s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getUser = s.get<GetUserArgs>((p) => `/users/${p.id}`);
    const c = s.consumer();

    expect(s.liveQueries()).toHaveLength(0);

    const query = c.run(() => getUser(withArgs(() => ({ pathParams: { id: '1' } }))));
    s.tick();

    expect(s.liveQueries()).toHaveLength(1);
    expect(s.liveQueries()[0]).toBe(query);

    c.destroy();

    expect(s.liveQueries()).toHaveLength(0);
  });

  it('lists the item queries a batch creates internally', () => {
    const s = scenario();
    s.api.on('PATCH', '/posts/:id', ({ params }) => ({ body: { id: params['id'] }, delay: 100 }));

    const patchPost = s.patch<{ response: { id: string }; pathParams: { id: string } }>((p) => `/posts/${p.id}`);
    const c = s.consumer();
    const batch = c.run(() =>
      createQueryBatch({
        queryCreator: patchPost,
        args: (post: { id: string }) => ({ pathParams: { id: post.id } }),
        concurrency: 2,
      }),
    );

    const subscription = batch.run([{ id: '1' }, { id: '2' }, { id: '3' }]).subscribe();

    s.tick();

    expect(s.liveQueries()).toHaveLength(2);

    s.flush();

    expect(s.liveQueries()).toHaveLength(0);

    subscription.unsubscribe();
    c.destroy();
  });
});
