import { createSecureGetQuery, withArgs } from '../index';
import { beforeEach, describe, expect, it } from 'vitest';
import { useScenario } from './harness';

let apiToken = 'token-a';

describe('headers scenario', () => {
  const scenario = useScenario({
    clientOptions: {
      keepUnusedFor: 0,
      headers: () => ({ 'X-Api-Token': apiToken, 'X-Tenant': 'acme' }),
    },
  });

  beforeEach(() => {
    apiToken = 'token-a';
  });

  it('sends client headers and per-request headers given as plain records', () => {
    const s = scenario();
    s.api.on('GET', '/me', () => ({ body: { ok: true } }));

    const getMe = s.get<{ response: { ok: boolean }; headers: Record<string, string> }>('/me');

    const c = s.consumer();
    c.run(() => getMe(withArgs(() => ({ headers: { 'X-Tenant': 'from-args', 'X-Request-Id': 'r1' } }))));
    s.tick();

    const sent = s.api.requests[0]?.headers;

    expect(sent?.get('X-Api-Token')).toBe('token-a');
    expect(sent?.get('X-Tenant')).toBe('from-args');
    expect(sent?.get('X-Request-Id')).toBe('r1');
  });

  it('keys the cache by record headers like it does by HttpHeaders', () => {
    const s = scenario();
    s.api.on('GET', '/greeting', ({ headers }) => ({ body: { lang: headers.get('Accept-Language') } }));

    const getGreeting = s.get<{ response: { lang: string }; headers: Record<string, string> }>('/greeting');

    const de = s.consumer().run(() => getGreeting(withArgs(() => ({ headers: { 'Accept-Language': 'de' } }))));
    const en = s.consumer().run(() => getGreeting(withArgs(() => ({ headers: { 'Accept-Language': 'en' } }))));
    s.tick();

    expect(s.api.requestCount('GET', '/greeting')).toBe(2);
    expect(de.response()).toEqual({ lang: 'de' });
    expect(en.response()).toEqual({ lang: 'en' });
  });

  it('sends a changed client header after refreshQueriesInUse', () => {
    const s = scenario();
    s.api.on('GET', '/votes', () => ({ body: { ok: true } }));

    const getVotes = s.get<{ response: { ok: boolean } }>('/votes');

    s.consumer().run(() => getVotes());
    s.tick();

    apiToken = 'token-b';
    s.client.refreshQueriesInUse();
    s.tick();

    const sent = s.api.requests.filter((r) => r.path === '/votes').map((r) => r.headers.get('X-Api-Token'));

    expect(sent).toEqual(['token-a', 'token-b']);
  });

  it('merges record headers of a secure query with the bearer token', async () => {
    const s = scenario();
    const auth = s.auth();

    s.api.protect('/secure/**');
    s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));

    const getProfile = createSecureGetQuery(
      s.clientRef,
      auth.ref,
    )<{ response: { id: string }; headers: Record<string, string> }>('/secure/profile');

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    const query = c.run(() => getProfile(withArgs(() => ({ headers: { 'X-Request-Id': 'r1' } }))));
    s.tick();

    const sent = s.api.requests.find((r) => r.path === '/secure/profile')?.headers;

    expect(query.response()).toEqual({ id: 'me' });
    expect(sent?.get('X-Request-Id')).toBe('r1');
    expect(sent?.get('X-Api-Token')).toBe('token-a');
    expect(sent?.get('Authorization')).toBe(`Bearer ${auth.accessToken()}`);
  });
});
