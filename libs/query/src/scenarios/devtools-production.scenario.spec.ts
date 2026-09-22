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
});
