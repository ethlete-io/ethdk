import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TimetrackTransport } from '../transport/ports';
import {
  GoogleAuthError,
  GoogleOAuthClient,
  exchangeGoogleAuthCode$,
  refreshGoogleAccessToken$,
  revokeGoogleToken$,
} from './tokens';

const CLIENT: GoogleOAuthClient = { clientId: 'client.apps.googleusercontent.com', clientSecret: 'shh' };

const answering = (status: number, body: unknown) =>
  ({ request$: vi.fn(() => of({ status, headers: {}, body }) as never) }) satisfies TimetrackTransport;

const GRANT = { access_token: 'ya29.token', expires_in: 3599, refresh_token: '1//refresh', scope: 'a b' };

const exchange$ = (transport: TimetrackTransport) =>
  exchangeGoogleAuthCode$({
    transport,
    client: CLIENT,
    code: 'auth-code',
    codeVerifier: 'verifier',
    redirectUri: 'http://127.0.0.1:41234',
  });

const errorFrom = (run: () => { subscribe: (observer: { error: (error: unknown) => void }) => void }) => {
  const failed = vi.fn();

  run().subscribe({ error: failed });

  return failed.mock.calls[0]?.[0] as GoogleAuthError;
};

describe('exchangeGoogleAuthCode$', () => {
  it('posts the code as a form, because the token endpoint rejects json', () => {
    const transport = answering(200, GRANT);

    exchange$(transport).subscribe();

    expect(transport.request$).toHaveBeenCalledWith({
      method: 'POST',
      url: 'https://oauth2.googleapis.com/token',
      headers: { accept: 'application/json' },
      form: {
        grant_type: 'authorization_code',
        client_id: CLIENT.clientId,
        client_secret: CLIENT.clientSecret,
        code: 'auth-code',
        code_verifier: 'verifier',
        redirect_uri: 'http://127.0.0.1:41234',
      },
    });
  });

  it('reads the grant, with the lifetime in milliseconds', () => {
    const grant = vi.fn();

    exchange$(answering(200, GRANT)).subscribe(grant);

    expect(grant).toHaveBeenCalledWith({
      accessToken: 'ya29.token',
      expiresInMs: 3_599_000,
      refreshToken: '1//refresh',
      scopes: ['a', 'b'],
    });
  });

  it('treats a 200 with no access token as a failure', () => {
    expect(errorFrom(() => exchange$(answering(200, {}))).status).toBe(200);
  });

  it('explains an unusable client id', () => {
    const error = errorFrom(() => exchange$(answering(401, { error: 'invalid_client' })));

    expect(error.message).toContain('does not recognise the client id');
    expect(error.needsReconnect).toBe(false);
  });

  it('falls back to google description when the code is unknown', () => {
    const body = { error: 'unsupported_grant_type', error_description: 'Bad grant type' };

    expect(errorFrom(() => exchange$(answering(400, body))).message).toBe('Bad grant type');
  });
});

describe('refreshGoogleAccessToken$', () => {
  const refresh$ = (transport: TimetrackTransport) =>
    refreshGoogleAccessToken$({ transport, client: CLIENT, refreshToken: '1//refresh' });

  it('spends the refresh token and nothing else', () => {
    const transport = answering(200, { access_token: 'ya29.next' });

    refresh$(transport).subscribe();

    expect(transport.request$).toHaveBeenCalledWith(
      expect.objectContaining({
        form: {
          grant_type: 'refresh_token',
          client_id: CLIENT.clientId,
          client_secret: CLIENT.clientSecret,
          refresh_token: '1//refresh',
        },
      }),
    );
  });

  it('assumes an hour when google names no lifetime', () => {
    const grant = vi.fn();

    refresh$(answering(200, { access_token: 'ya29.next' })).subscribe(grant);

    expect(grant).toHaveBeenCalledWith({ accessToken: 'ya29.next', expiresInMs: 3_600_000, scopes: [] });
  });

  it('reports a revoked authorization as needing a reconnect', () => {
    const error = errorFrom(() => refresh$(answering(400, { error: 'invalid_grant' })));

    expect(error.needsReconnect).toBe(true);
    expect(error.message).toContain('connect the account again');
  });
});

describe('revokeGoogleToken$', () => {
  it('withdraws the grant at google, not just the copy on this machine', () => {
    const transport = answering(200, null);

    revokeGoogleToken$({ transport, token: '1//refresh' }).subscribe();

    expect(transport.request$).toHaveBeenCalledWith({
      method: 'POST',
      url: 'https://oauth2.googleapis.com/revoke',
      form: { token: '1//refresh' },
    });
  });

  it('treats a token google has already forgotten as revoked', () => {
    const done = vi.fn();

    revokeGoogleToken$({ transport: answering(400, { error: 'invalid_token' }), token: 'gone' }).subscribe(done);

    expect(done).toHaveBeenCalledWith(undefined);
  });
});
