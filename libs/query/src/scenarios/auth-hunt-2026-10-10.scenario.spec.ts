import { createSecureGetQuery } from '../index';
import { describe, expect, it } from 'vitest';
import { mintToken, Scenario, useScenario } from './harness';

type Profile = { response: { name: string } };

const loginAs = (s: Scenario, sub: string) =>
  s.api.once('POST', '/auth/login', () => ({
    body: { accessToken: mintToken({ claims: { sub } }), refreshToken: mintToken({ expiresInMs: 3600000 }) },
  }));

describe('auth hunt 2026-10-10', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  const boot = (s: Scenario) => {
    const auth = s.auth();
    let caller = 'x';

    s.api.protect('/secure/**');
    s.api.on('GET', '/secure/profile', () => ({ body: { name: caller } }));

    const getProfile = createSecureGetQuery(s.clientRef, auth.ref)<Profile>('/secure/profile');
    const c = s.consumer();

    const login = async (sub: string) => {
      loginAs(s, sub);
      caller = sub;
      c.run(() => auth.queries.login.execute({ body: {} }));
      await s.settle();
      s.flush();
      await s.settle();
    };

    return { auth, getProfile, c, login };
  };

  it('refetches a mounted secure query and serves no cached response of the previous user after a login as another user', async () => {
    const s = scenario();
    const { auth, getProfile, c, login } = boot(s);

    await login('x');
    const mounted = c.run(() => getProfile());
    s.flush();
    await s.settle();
    expect(mounted.response()).toEqual({ name: 'x' });
    const sessionX = auth.sessionId();

    await login('y');

    expect(auth.sessionId()).toBe(sessionX + 1);
    expect(s.api.requestCount('GET', '/secure/profile')).toBe(2);
    expect(mounted.response()).toEqual({ name: 'y' });

    const fresh = c.run(() => getProfile());
    s.flush();
    await s.settle();
    expect(fresh.response()).toEqual({ name: 'y' });

    c.destroy();
  });

  it('keeps the secure cache and the session id after a login as the same user', async () => {
    const s = scenario();
    const { auth, getProfile, c, login } = boot(s);

    await login('x');
    const mounted = c.run(() => getProfile());
    s.flush();
    await s.settle();
    const sessionX = auth.sessionId();

    await login('x');

    expect(auth.sessionId()).toBe(sessionX);
    expect(s.api.requestCount('GET', '/secure/profile')).toBe(1);
    expect(mounted.response()).toEqual({ name: 'x' });

    c.destroy();
  });

  it('clears the secure cache when setTokens hands over a pair for another user', async () => {
    const s = scenario();
    const { auth, getProfile, c, login } = boot(s);

    await login('x');
    c.run(() => getProfile());
    s.flush();
    await s.settle();

    auth.setTokens(mintToken({ claims: { sub: 'z' } }), mintToken({ expiresInMs: 3600000 }));
    s.flush();
    await s.settle();

    expect(s.api.requestCount('GET', '/secure/profile')).toBe(2);

    c.destroy();
  });

  it('keeps the secure cache and the session id across a refresh of tokens without a sub claim', async () => {
    const s = scenario();
    const { auth, getProfile, c } = boot(s);

    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();
    const mounted = c.run(() => getProfile());
    s.flush();
    await s.settle();
    const session = auth.sessionId();

    c.run(() => auth.queries.refresh.execute({ body: {} }));
    await s.settle();
    s.flush();
    await s.settle();

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(auth.sessionId()).toBe(session);
    expect(s.api.requestCount('GET', '/secure/profile')).toBe(1);
    expect(mounted.response()).toEqual({ name: 'x' });

    c.destroy();
  });

  it('keeps the session id across a token refresh', async () => {
    const s = scenario();
    const { auth, c, login } = boot(s);

    await login('x');
    const sessionX = auth.sessionId();

    c.run(() => auth.queries.refresh.execute({ body: {} }));
    await s.settle();

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(auth.sessionId()).toBe(sessionX);

    c.destroy();
  });
});
