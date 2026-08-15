import { Observable, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TIMETRACK_SECRET_KEYS } from '../settings/credentials';
import { TimetrackSecretStore, TimetrackTransport } from '../transport/ports';
import { createGoogleTokenSource } from './token-source';

const HELD: Record<string, string | null> = {
  [TIMETRACK_SECRET_KEYS.googleClientSecret]: 'shh',
  [TIMETRACK_SECRET_KEYS.googleRefreshToken]: '1//refresh',
};

const secretsHolding = (held: Record<string, string | null>) =>
  ({
    read$: vi.fn((key: string) => of(held[key] ?? null)),
    write$: vi.fn(() => of(undefined)),
    has$: vi.fn(() => of(true)),
    delete$: vi.fn(() => of(undefined)),
  }) satisfies TimetrackSecretStore;

const granting = (accessToken: string, expiresIn = 3600) =>
  ({
    request$: vi.fn(
      () => of({ status: 200, headers: {}, body: { access_token: accessToken, expires_in: expiresIn } }) as never,
    ),
  }) satisfies TimetrackTransport;

const sourceWith = (options: {
  transport?: TimetrackTransport;
  secrets?: TimetrackSecretStore;
  clientId?: string;
  clock?: { ms: number };
}) => {
  const clock = options.clock ?? { ms: 0 };

  return createGoogleTokenSource({
    transport: options.transport ?? granting('ya29.first'),
    secrets: options.secrets ?? secretsHolding(HELD),
    clientId: () => options.clientId ?? 'client.apps.googleusercontent.com',
    now: () => clock.ms,
  });
};

const tokenOf = (credentials$: Observable<{ accessToken: string } | null>) => {
  const seen = vi.fn();

  credentials$.subscribe(seen);

  return seen.mock.calls[0]?.[0] as { accessToken: string } | null;
};

describe('createGoogleTokenSource', () => {
  it('renews the access token from the stored refresh token', () => {
    expect(tokenOf(sourceWith({}).credentials$())).toEqual({ accessToken: 'ya29.first' });
  });

  it('answers null when nothing is connected, rather than failing', () => {
    const source = sourceWith({ secrets: secretsHolding({}) });

    expect(tokenOf(source.credentials$())).toBeNull();
  });

  it('answers null when the client id is missing, so the account cannot be half configured', () => {
    expect(tokenOf(sourceWith({ clientId: '  ' }).credentials$())).toBeNull();
  });

  it('holds the token until it is close to expiring', () => {
    const transport = granting('ya29.first');
    const clock = { ms: 0 };
    const source = sourceWith({ transport, clock });

    tokenOf(source.credentials$());
    clock.ms = 30 * 60_000;
    tokenOf(source.credentials$());

    expect(transport.request$).toHaveBeenCalledTimes(1);
  });

  it('renews before the token expires, not after', () => {
    const transport = granting('ya29.first');
    const clock = { ms: 0 };
    const source = sourceWith({ transport, clock });

    tokenOf(source.credentials$());
    clock.ms = 59 * 60_000;
    tokenOf(source.credentials$());

    expect(transport.request$).toHaveBeenCalledTimes(2);
  });

  it('renews once when two callers ask at the same time', () => {
    const transport = granting('ya29.first');
    const source = sourceWith({ transport });

    source.credentials$().subscribe();
    source.credentials$().subscribe();

    expect(transport.request$).toHaveBeenCalledTimes(1);
  });

  it('asks again after the held token is dropped', () => {
    const transport = granting('ya29.first');
    const source = sourceWith({ transport });

    tokenOf(source.credentials$());
    source.invalidate();
    tokenOf(source.credentials$());

    expect(transport.request$).toHaveBeenCalledTimes(2);
  });
});
