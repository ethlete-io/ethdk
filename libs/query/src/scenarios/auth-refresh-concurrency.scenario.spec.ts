import { HttpErrorResponse } from '@angular/common/http';
import { createSecureGetQuery } from '../index';
import { describe, expect, it } from 'vitest';
import { mintToken, useScenario } from './harness';

const tokenPair = (delay: number) => ({
  body: { accessToken: mintToken({ expiresInMs: 900000 }), refreshToken: mintToken({ expiresInMs: 3600000 }) },
  delay,
});

type Item = { response: { id: string } };

const isStatus = (status: number) => (entry: { error: unknown }) =>
  entry.error instanceof HttpErrorResponse && entry.error.status === status;

const settleCascade = async (s: { tick: (ms?: number) => void }, rounds = 20) => {
  for (let i = 0; i < rounds; i++) {
    await Promise.resolve();
    s.tick(50);
  }
};

describe('auth refresh with several requests in flight', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('three secure requests whose 401s land before, during and after one refresh all retry once with the new token', async () => {
    const s = scenario();
    const auth = s.auth({ autoRetryOn401: true });

    s.api.protect('/secure/**');
    s.api.once('GET', '/secure/a', () => ({ status: 401, body: { message: 'revoked' } }));
    s.api.once('GET', '/secure/b', () => ({ status: 401, body: { message: 'revoked' }, delay: 100 }));
    s.api.once('GET', '/secure/c', () => ({ status: 401, body: { message: 'revoked' }, delay: 600 }));
    s.api.on('GET', '/secure/:id', ({ params }) => ({ body: { id: params['id'] } }));
    s.api.once('POST', '/auth/refresh', () => tokenPair(300));

    const getA = createSecureGetQuery(s.clientRef, auth.ref)<Item>('/secure/a');
    const getB = createSecureGetQuery(s.clientRef, auth.ref)<Item>('/secure/b');
    const getC = createSecureGetQuery(s.clientRef, auth.ref)<Item>('/secure/c');

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();
    const tokenAtLogin = auth.accessToken();

    const a = c.run(() => getA());
    const b = c.run(() => getB());
    const cq = c.run(() => getC());
    s.tick();
    expect(s.api.pending()).toHaveLength(3);

    await settleCascade(s);

    const newToken = auth.accessToken();
    expect(newToken).not.toBe(tokenAtLogin);
    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);

    for (const path of ['/secure/a', '/secure/b', '/secure/c']) {
      const sent = s.api.requests.filter((r) => r.path === path);
      expect(sent).toHaveLength(2);
      expect(sent[1]?.headers.get('Authorization')).toBe(`Bearer ${newToken}`);
    }

    expect(a.response()).toEqual({ id: 'a' });
    expect(b.response()).toEqual({ id: 'b' });
    expect(cq.response()).toEqual({ id: 'c' });
    expect([a.loading(), b.loading(), cq.loading()]).toEqual([null, null, null]);

    s.expectError(isStatus(401));
    s.expectError(isStatus(401));
    s.expectError(isStatus(401));
    c.destroy();
  });

  it('a refresh that fails while three 401s wait on it runs onRefreshFailure once, logs out once and retries nothing', async () => {
    const s = scenario();
    let failures = 0;
    const auth = s.auth({
      autoRetryOn401: true,
      onRefreshFailure: ({ logout }) => {
        failures++;
        logout();
      },
    });

    s.api.protect('/secure/**');
    s.api.on('GET', '/secure/:id', () => ({ status: 401, body: { message: 'revoked' } }));
    s.api.once('POST', '/auth/refresh', () => ({
      status: 400,
      body: { message: 'refresh token revoked' },
      delay: 200,
    }));

    const getA = createSecureGetQuery(s.clientRef, auth.ref)<Item>('/secure/a');
    const getB = createSecureGetQuery(s.clientRef, auth.ref)<Item>('/secure/b');
    const getC = createSecureGetQuery(s.clientRef, auth.ref)<Item>('/secure/c');

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    const queries = [c.run(() => getA()), c.run(() => getB()), c.run(() => getC())];
    s.tick();

    await settleCascade(s);

    expect(failures).toBe(1);
    expect(auth.sessionStatus()).toBe('anonymous');
    expect(auth.sessionEndCause()).toBe('expired');
    expect(auth.accessToken()).toBeNull();
    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(s.api.requestCount('GET', '/secure/a')).toBe(1);
    expect(s.api.requestCount('GET', '/secure/b')).toBe(1);
    expect(s.api.requestCount('GET', '/secure/c')).toBe(1);
    expect(queries.map((q) => q.loading())).toEqual([null, null, null]);

    s.expectError(isStatus(400));
    while (s.errors.some(isStatus(401))) s.expectError(isStatus(401));
    c.destroy();
  });

  it('a logout while a 401-driven refresh is in flight drops the late pair and retries none of the waiting requests', async () => {
    const s = scenario();
    const auth = s.auth({ autoRetryOn401: true });

    s.api.protect('/secure/**');
    s.api.on('GET', '/secure/:id', () => ({ status: 401, body: { message: 'revoked' } }));
    s.api.once('POST', '/auth/refresh', () => tokenPair(1000));

    const getA = createSecureGetQuery(s.clientRef, auth.ref)<Item>('/secure/a');
    const getB = createSecureGetQuery(s.clientRef, auth.ref)<Item>('/secure/b');
    const getC = createSecureGetQuery(s.clientRef, auth.ref)<Item>('/secure/c');

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    const queries = [c.run(() => getA()), c.run(() => getB()), c.run(() => getC())];
    s.tick();
    await settleCascade(s, 4);
    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(s.api.pending().some((r) => r.path === '/auth/refresh')).toBe(true);

    s.run(() => auth.logout());
    await settleCascade(s, 40);

    expect(auth.accessToken()).toBeNull();
    expect(auth.refreshToken()).toBeNull();
    expect(auth.sessionStatus()).toBe('anonymous');
    expect(s.api.requestCount('GET', '/secure/a')).toBe(1);
    expect(s.api.requestCount('GET', '/secure/b')).toBe(1);
    expect(s.api.requestCount('GET', '/secure/c')).toBe(1);
    expect(queries.map((q) => q.loading())).toEqual([null, null, null]);

    while (s.errors.some(isStatus(401))) s.expectError(isStatus(401));
    c.destroy();
  });
});
