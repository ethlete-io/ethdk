import { describe, expect, it } from 'vitest';
import { isQueryDevtoolsEnabled, provideQueryDevtools, queryDevtoolsEntries } from '../index';
import { inProductionMode, useScenario } from './harness';

describe('devtools provided in a production build', () => {
  const scenario = useScenario({
    clientOptions: { keepUnusedFor: 0 },
    providers: () => inProductionMode(() => [provideQueryDevtools()]),
  });

  it('warns that the devtools grow the bundle, and still instruments queries', () => {
    const s = scenario();
    s.api.on('GET', '/production-devtools', () => ({ body: { ok: true } }));

    s.expectWarning(/Query Devtools in production mode/);
    expect(isQueryDevtoolsEnabled()).toBe(true);

    const getStatus = s.get<{ response: { ok: boolean } }>('/production-devtools');
    const c = s.consumer();
    const query = c.run(() => getStatus());

    s.tick();

    expect(query.response()).toEqual({ ok: true });
    expect(queryDevtoolsEntries().some((entry) => entry.kind === 'query' && entry.handle === query)).toBe(true);

    c.destroy();
  });

  it('keeps the tokens of a plain login out of web storage', () => {
    const s = scenario();

    const auth = s.auth();
    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    s.tick();

    const accessToken = auth.accessToken();
    const refreshToken = auth.refreshToken();
    const stored = [localStorage, sessionStorage].flatMap((storage) =>
      Object.keys(storage).map((key) => storage.getItem(key) ?? ''),
    );

    expect(accessToken).not.toBeNull();
    expect(stored.filter((value) => value.includes(accessToken ?? '') || value.includes(refreshToken ?? ''))).toEqual(
      [],
    );

    c.destroy();
  });
});
