import { Observable, combineLatest, finalize, map, of, shareReplay, switchMap, tap } from 'rxjs';
import { GoogleCalendarCredentials } from '../google-calendar/client';
import { TIMETRACK_SECRET_KEYS } from '../settings/credentials';
import { TimetrackSecretStore, TimetrackTransport } from '../transport/ports';
import { GoogleOAuthClient, GoogleTokenGrant, refreshGoogleAccessToken$ } from './tokens';

/**
 * How long before it expires an access token is renewed. A day's fetch can take several seconds, and a
 * token that expires between the check and the call reads as a broken connection.
 */
export const GOOGLE_TOKEN_REFRESH_MARGIN_MS = 2 * 60_000;

/**
 * Hands out an access token that is valid right now, and renews it when it is not.
 *
 * The calendar provider takes a token and never renews one, so this is what stands between it and the
 * refresh token in the keychain. The access token is held in memory only: it lives an hour, and writing
 * it anywhere would put a usable credential on disk for no gain.
 */
export type GoogleTokenSource = {
  /** The credentials the calendar provider takes, or `null` while the account is not connected. */
  credentials$(): Observable<GoogleCalendarCredentials | null>;
  /** Drops the held access token, so the next call asks Google for a new one. */
  invalidate(): void;
};

export const createGoogleTokenSource = (options: {
  transport: TimetrackTransport;
  secrets: TimetrackSecretStore;
  /** The client id from the settings document. Read per call, so connecting takes effect at once. */
  clientId: () => string;
  now: () => number;
}): GoogleTokenSource => {
  let held: { accessToken: string; expiresAtMs: number } | null = null;
  let inFlight: Observable<GoogleCalendarCredentials | null> | null = null;

  const store = (grant: GoogleTokenGrant) => {
    held = { accessToken: grant.accessToken, expiresAtMs: options.now() + grant.expiresInMs };
  };

  const stored$ = () =>
    combineLatest({
      clientSecret: options.secrets.read$(TIMETRACK_SECRET_KEYS.googleClientSecret),
      refreshToken: options.secrets.read$(TIMETRACK_SECRET_KEYS.googleRefreshToken),
    });

  const renew$ = (): Observable<GoogleCalendarCredentials | null> => {
    const shared$: Observable<GoogleCalendarCredentials | null> = stored$().pipe(
      switchMap(({ clientSecret, refreshToken }) => {
        const client: GoogleOAuthClient = {
          clientId: options.clientId().trim(),
          clientSecret: clientSecret?.trim() ?? '',
        };

        if (!client.clientId || !client.clientSecret || !refreshToken?.trim()) return of(null);

        return refreshGoogleAccessToken$({
          transport: options.transport,
          client,
          refreshToken: refreshToken.trim(),
        }).pipe(
          tap(store),
          map((grant): GoogleCalendarCredentials => ({ accessToken: grant.accessToken })),
        );
      }),
      // The renewal has to be forgotten once it ends, or a later caller replays an expired token.
      finalize(() => {
        if (inFlight === shared$) inFlight = null;
      }),
      // Two collectors asking at once must renew once. `shareReplay` is what makes the second one wait
      // for the first answer instead of spending the refresh token again.
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    return shared$;
  };

  return {
    credentials$: () => {
      if (held && options.now() < held.expiresAtMs - GOOGLE_TOKEN_REFRESH_MARGIN_MS) {
        return of({ accessToken: held.accessToken });
      }

      inFlight ??= renew$();

      return inFlight;
    },

    invalidate: () => {
      held = null;
      inFlight = null;
    },
  };
};
