/* eslint-disable @typescript-eslint/naming-convention -- the OAuth 2.0 wire format is snake_case. */
import { Observable, map } from 'rxjs';
import { TimetrackTransport } from '../transport/ports';
import { GOOGLE_REVOKE_ENDPOINT, GOOGLE_TOKEN_ENDPOINT } from './oauth';

/**
 * The OAuth client the user registered themselves. Google calls a desktop client's secret a secret, but
 * it ships inside every installed copy of the app it belongs to and is not one — PKCE is what actually
 * protects the exchange. It is kept in the keychain anyway, because it is still a per-user value.
 */
export type GoogleOAuthClient = {
  clientId: string;
  clientSecret: string;
};

/** What Google returned, in the app's own terms. `refreshToken` is absent on a refresh. */
export type GoogleTokenGrant = {
  accessToken: string;
  /** How long the access token lives, from when Google answered. */
  expiresInMs: number;
  refreshToken?: string;
  scopes: string[];
};

/**
 * Which of the two token requests failed. Google answers both with the same `error` codes and they mean
 * different things: `invalid_grant` on a refresh means the stored token is dead, while on an exchange it
 * means the code the browser just carried was not usable.
 */
export type GoogleTokenFlow = 'authorization-code' | 'refresh-token';

export class GoogleAuthError extends Error {
  readonly status: number;
  /** Google's own `error` code, when the body carried one — `invalid_grant`, `invalid_client`, … */
  readonly code?: string;
  readonly flow: GoogleTokenFlow;
  /**
   * Whether the stored refresh token is dead. Google answers `invalid_grant` once the user revokes
   * access, changes their password or leaves the token unused for six months, and the only way out is
   * connecting again — so a caller shows that rather than retrying.
   *
   * Never set for a failed exchange: the browser flow is what just ran, so asking for it again is a
   * loop rather than a fix.
   */
  readonly needsReconnect: boolean;

  constructor(options: { status: number; code?: string; message: string; flow: GoogleTokenFlow }) {
    super(options.message);
    this.name = 'GoogleAuthError';
    this.status = options.status;
    this.code = options.code;
    this.flow = options.flow;
    this.needsReconnect = options.code === 'invalid_grant' && options.flow === 'refresh-token';
  }
}

type GoogleTokenBody = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

/** Google's own default, used when it answers without an `expires_in`. */
const DEFAULT_EXPIRES_IN_SECONDS = 3600;

const asBody = (body: unknown): GoogleTokenBody =>
  typeof body === 'object' && body !== null ? (body as GoogleTokenBody) : {};

/**
 * Google's `error_description` is kept on every code it is sent with, because it is the only part of the
 * answer that says which of several causes applies — an exchange is rejected the same way for a code
 * that was already spent, one that expired, and a redirect that did not match.
 */
const messageFor = (options: { status: number; code?: string; description?: string; flow: GoogleTokenFlow }) => {
  const { status, code, description, flow } = options;
  const said = description ? ` Google said: ${description}` : '';

  if (code === 'invalid_grant') {
    return flow === 'refresh-token'
      ? `Google no longer accepts the stored authorization — connect the account again.${said}`
      : `Google rejected the authorization the browser carried back. It was already spent, it expired, or the redirect did not match.${said}`;
  }

  if (code === 'invalid_client') return `Google does not recognise the client id and secret for this app.${said}`;

  return description ?? `Google responded ${status} to the token request${code ? ` (${code})` : ''}.`;
};

const token$ = (options: {
  transport: TimetrackTransport;
  form: Record<string, string>;
  flow: GoogleTokenFlow;
}): Observable<GoogleTokenGrant> =>
  options.transport
    .request$<unknown>({
      method: 'POST',
      url: GOOGLE_TOKEN_ENDPOINT,
      headers: { accept: 'application/json' },
      form: options.form,
    })
    .pipe(
      map((response) => {
        const body = asBody(response.body);

        if (response.status < 200 || response.status >= 300 || !body.access_token) {
          throw new GoogleAuthError({
            status: response.status,
            code: body.error,
            flow: options.flow,
            message: messageFor({
              status: response.status,
              code: body.error,
              description: body.error_description,
              flow: options.flow,
            }),
          });
        }

        return {
          accessToken: body.access_token,
          expiresInMs: (body.expires_in ?? DEFAULT_EXPIRES_IN_SECONDS) * 1000,
          ...(body.refresh_token ? { refreshToken: body.refresh_token } : {}),
          scopes: body.scope?.split(' ').filter((scope) => !!scope) ?? [],
        };
      }),
    );

/**
 * Trades the authorization code the loopback redirect carried for a token pair.
 *
 * `redirectUri` and `codeVerifier` have to be the exact pair the authorization used, which is why the
 * host reports both back rather than the caller rebuilding them.
 */
export const exchangeGoogleAuthCode$ = (options: {
  transport: TimetrackTransport;
  client: GoogleOAuthClient;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Observable<GoogleTokenGrant> =>
  token$({
    transport: options.transport,
    flow: 'authorization-code',
    form: {
      grant_type: 'authorization_code',
      client_id: options.client.clientId,
      client_secret: options.client.clientSecret,
      code: options.code,
      code_verifier: options.codeVerifier,
      redirect_uri: options.redirectUri,
    },
  });

/**
 * Withdraws the app's access at Google, which is what makes disconnecting mean something outside this
 * machine: deleting the stored token alone would leave the grant standing in the user's account.
 *
 * Revoking a refresh token takes the whole grant with it. A token Google has already forgotten answers
 * 400, which is the state this asks for, so only a transport failure reaches the caller.
 */
export const revokeGoogleToken$ = (options: { transport: TimetrackTransport; token: string }): Observable<void> =>
  options.transport
    .request$<unknown>({ method: 'POST', url: GOOGLE_REVOKE_ENDPOINT, form: { token: options.token } })
    .pipe(map(() => undefined));

/** Renews the access token. Google returns no new refresh token here, so the stored one stays. */
export const refreshGoogleAccessToken$ = (options: {
  transport: TimetrackTransport;
  client: GoogleOAuthClient;
  refreshToken: string;
}): Observable<GoogleTokenGrant> =>
  token$({
    transport: options.transport,
    flow: 'refresh-token',
    form: {
      grant_type: 'refresh_token',
      client_id: options.client.clientId,
      client_secret: options.client.clientSecret,
      refresh_token: options.refreshToken,
    },
  });
