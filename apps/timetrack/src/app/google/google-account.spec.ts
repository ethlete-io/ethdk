import { signal } from '@angular/core';
import { EnvironmentInjector, Injector, createEnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TIMETRACK_SECRET_KEYS } from '@ethlete/timetrack';
import { of } from 'rxjs';
import { HOST_PORTS, HostPorts } from '../../host';
import { injectGoogleAccount } from './google-account';

vi.mock('@ethlete/core', () => ({
  defineRootProvider: <T>(factory: () => T) => factory,
  toInjectFn: <T>(factory: () => T) => factory,
}));

const builtIn = signal<{ clientId: string; clientSecret: string } | null>(null);
const ownClientId = signal('');

vi.mock('./built-in-client', () => ({ injectBuiltInGoogleClient: () => builtIn }));
vi.mock('../settings/settings', () => ({
  injectTimetrackSettings: () => ({
    settings: () => ({ google: { clientId: ownClientId(), calendarIds: [] } }),
    recheckCredentials: () => undefined,
  }),
}));

const setup = (options: { tokenStatus: number; tokenBody: unknown }) => {
  const held: Record<string, string> = { [TIMETRACK_SECRET_KEYS.googleRefreshToken]: '1//refresh' };
  const bodies: string[] = [];
  const ports = {
    secrets: { read$: (key: string) => of(held[key] ?? null) },
    transport: {
      request$: (request: { body?: unknown }) => {
        bodies.push(JSON.stringify(request));

        return of({ status: options.tokenStatus, headers: {}, body: options.tokenBody });
      },
    },
  } as unknown as HostPorts;
  const injector = createEnvironmentInjector(
    [{ provide: HOST_PORTS, useValue: ports }],
    Injector.NULL as EnvironmentInjector,
  );

  return { account: runInInjectionContext(injector, () => injectGoogleAccount()), bodies };
};

describe('injectGoogleAccount', () => {
  beforeEach(() => {
    builtIn.set({ clientId: 'shared.apps.googleusercontent.com', clientSecret: 'shared' });
    ownClientId.set('');
  });

  it('asks to reconnect when Google rejects the refresh token with invalid_grant', () => {
    const { account } = setup({ tokenStatus: 400, tokenBody: { error: 'invalid_grant' } });

    account.loadCalendars();

    expect(account.needsReconnect()).toBe(true);
  });

  it('does not ask to reconnect for another refresh failure', () => {
    const { account } = setup({ tokenStatus: 400, tokenBody: { error: 'invalid_client' } });

    account.loadCalendars();

    expect(account.needsReconnect()).toBe(false);
    expect(account.failure()).not.toBeNull();
  });

  it('refreshes through the built-in client when the user set none of their own', () => {
    const { account, bodies } = setup({ tokenStatus: 400, tokenBody: { error: 'invalid_grant' } });

    account.loadCalendars();

    expect(account.hasBuiltInClient()).toBe(true);
    expect(bodies[0]).toContain('shared.apps.googleusercontent.com');
  });
});
