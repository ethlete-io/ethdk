import { createSecureGetQuery, withTracking } from '../index';
import { describe, expect, it } from 'vitest';
import { ScenarioAuthBuilders, useScenario } from './harness';

describe('auth scan 2026-10-03', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('lets a withTracking handler end the session without breaking the re-run of a mounted secure query', async () => {
    const s = scenario();
    let rejectNextLogin = false;
    let logout: () => void = () => undefined;

    const auth = s.auth({
      features: [
        withTracking<ScenarioAuthBuilders>({
          on: {
            loginSuccess: () => {
              if (rejectNextLogin) logout();
            },
          },
        }),
      ],
    });
    logout = () => auth.logout();

    s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));
    const getProfile = createSecureGetQuery(s.clientRef, auth.ref)<{ response: { id: string } }>('/secure/profile');

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();
    const profile = c.run(() => getProfile());
    await s.settle();

    expect(profile.response()).toEqual({ id: 'me' });

    rejectNextLogin = true;
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    expect(auth.isAuthenticated()).toBe(false);
    expect(profile.response()).toBeNull();

    rejectNextLogin = false;
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();
    s.tick(1);

    expect(profile.response()).toEqual({ id: 'me' });
    expect(s.api.requestCount('GET', '/secure/profile')).toBe(2);

    c.destroy();
  });
});
