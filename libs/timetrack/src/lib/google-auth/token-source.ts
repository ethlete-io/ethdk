import { Observable, catchError, combineLatest, finalize, map, of, shareReplay, switchMap, throwError } from 'rxjs';
import { GoogleCalendarCredentials, GoogleCalendarRequestError } from '../google-calendar/client';
import { TIMETRACK_SECRET_KEYS } from '../settings/credentials';
import { TimetrackSecretStore, TimetrackTransport } from '../transport/ports';
import { selectGoogleClient } from './client';
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
  /**
   * Drops the held access token, so the next call asks Google for a new one. A renewal already in
   * flight is disowned: it stores nothing and answers `null`.
   */
  invalidate(): void;
};

export const createGoogleTokenSource = (options: {
  transport: TimetrackTransport;
  secrets: TimetrackSecretStore;
  /** The client id from the settings document. Read per call, so connecting takes effect at once. */
  clientId: () => string;
  /** The client the build carries. It is used while the user has not set a complete client of their own. */
  builtInClient?: () => GoogleOAuthClient | null;
  now: () => number;
}): GoogleTokenSource => {
  let held: { accessToken: string; expiresAtMs: number } | null = null;
  let inFlight: Observable<GoogleCalendarCredentials | null> | null = null;
  // Disconnecting cannot cancel a refresh Google is already answering. Without this counter that
  // answer would store a usable token after the refresh token was deleted.
  let generation = 0;

  const store = (grant: GoogleTokenGrant) => {
    held = { accessToken: grant.accessToken, expiresAtMs: options.now() + grant.expiresInMs };
  };

  const stored$ = () =>
    combineLatest({
      clientSecret: options.secrets.read$(TIMETRACK_SECRET_KEYS.googleClientSecret),
      refreshToken: options.secrets.read$(TIMETRACK_SECRET_KEYS.googleRefreshToken),
    });

  const renew$ = (): Observable<GoogleCalendarCredentials | null> => {
    const startedAt = generation;
    const shared$: Observable<GoogleCalendarCredentials | null> = stored$().pipe(
      switchMap(({ clientSecret, refreshToken }) => {
        const choice = selectGoogleClient({
          own: { clientId: options.clientId(), clientSecret: clientSecret ?? '' },
          builtIn: options.builtInClient?.() ?? null,
        });

        if (generation !== startedAt) return of(null);
        if (choice.source === 'none' || !refreshToken?.trim()) return of(null);

        const client = choice.client;

        return refreshGoogleAccessToken$({
          transport: options.transport,
          client,
          refreshToken: refreshToken.trim(),
        }).pipe(
          map((grant): GoogleCalendarCredentials | null => {
            if (generation !== startedAt) return null;

            store(grant);

            return { accessToken: grant.accessToken };
          }),
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
      generation += 1;
    },
  };
};

/**
 * Runs `work` with the source's current credentials. When Google rejects the token with a 401 before
 * its held expiry, the token is dropped and `work` runs once more with a renewed one.
 */
export const withGoogleCredentials$ = <T>(
  source: GoogleTokenSource,
  work: (credentials: GoogleCalendarCredentials | null) => Observable<T>,
): Observable<T> => {
  const attempt$ = () => source.credentials$().pipe(switchMap(work));

  return attempt$().pipe(
    catchError((error: unknown) => {
      if (!(error instanceof GoogleCalendarRequestError) || error.status !== 401) return throwError(() => error);

      source.invalidate();

      return attempt$();
    }),
  );
};
