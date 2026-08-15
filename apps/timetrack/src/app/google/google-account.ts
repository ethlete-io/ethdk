import { DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  GOOGLE_AUTHORIZATION_ENDPOINT,
  GoogleCalendar,
  GoogleCalendarCredentials,
  GoogleOAuthClient,
  TIMETRACK_SECRET_KEYS,
  createGoogleTokenSource,
  exchangeGoogleAuthCode$,
  fetchGoogleCalendarList$,
  googleAuthorizationQuery,
  revokeGoogleToken$,
} from '@ethlete/timetrack';
import { EMPTY, Observable, Subject, catchError, defer, exhaustMap, finalize, of, switchMap, tap } from 'rxjs';
import { injectHostPorts } from '../../host';
import { injectTimetrackSettings } from '../settings/settings';

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * The Google account meetings are read from: connecting it, dropping it, and handing out the access
 * token everything else needs.
 *
 * The connect step is the one flow in the app that leaves the window entirely — the host opens a
 * browser and listens on a loopback port, because that is what Google's rules for an installed
 * application allow. `exhaustMap` is what stops a second click opening a second browser.
 */
const GOOGLE_ACCOUNT_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const settings = injectTimetrackSettings();
  const destroyRef = inject(DestroyRef);

  const busy = signal(false);
  const failure = signal<string | null>(null);
  const calendars = signal<GoogleCalendar[] | null>(null);

  const tokens = createGoogleTokenSource({
    transport: ports.transport,
    secrets: ports.secrets,
    clientId: () => settings.settings().google.clientId,
    now: () => Date.now(),
  });

  const client$ = (): Observable<GoogleOAuthClient> =>
    ports.secrets.read$(TIMETRACK_SECRET_KEYS.googleClientSecret).pipe(
      switchMap((stored) => {
        const client = {
          clientId: settings.settings().google.clientId.trim(),
          clientSecret: stored?.trim() ?? '',
        };

        if (!client.clientId) throw new Error('Name the OAuth client id before connecting the account.');
        if (!client.clientSecret) throw new Error('Store the OAuth client secret before connecting the account.');

        return of(client);
      }),
    );

  const started = <T>(work$: Observable<T>) =>
    defer(() => {
      busy.set(true);
      failure.set(null);

      return work$.pipe(
        catchError((error: unknown) => {
          failure.set(messageOf(error));

          return EMPTY;
        }),
        finalize(() => busy.set(false)),
      );
    });

  const calendars$ = () =>
    tokens.credentials$().pipe(
      switchMap((credentials) =>
        credentials ? fetchGoogleCalendarList$({ transport: ports.transport, credentials }) : of([]),
      ),
      tap((found) => calendars.set(found)),
    );

  const connect$ = () =>
    started(
      client$().pipe(
        switchMap((client) =>
          ports.oauth
            .authorize$({
              authorizationEndpoint: GOOGLE_AUTHORIZATION_ENDPOINT,
              query: googleAuthorizationQuery({ clientId: client.clientId }),
            })
            .pipe(
              switchMap((outcome) =>
                exchangeGoogleAuthCode$({
                  transport: ports.transport,
                  client,
                  code: outcome.code,
                  codeVerifier: outcome.codeVerifier,
                  redirectUri: outcome.redirectUri,
                }),
              ),
            ),
        ),
        switchMap((grant) => {
          // Without one there is nothing to renew with, and the connection would stop working within
          // the hour rather than failing now, while the user is still looking at the screen.
          if (!grant.refreshToken) {
            throw new Error(
              'Google issued no refresh token. Remove the app under your Google account, then connect again.',
            );
          }

          return ports.secrets.write$(TIMETRACK_SECRET_KEYS.googleRefreshToken, grant.refreshToken);
        }),
        tap(() => {
          tokens.invalidate();
          settings.recheckCredentials();
        }),
        switchMap(() => calendars$()),
      ),
    );

  /** Withdraws the grant at Google first, so disconnecting is not only a local forget. */
  const disconnect$ = () =>
    started(
      ports.secrets.read$(TIMETRACK_SECRET_KEYS.googleRefreshToken).pipe(
        switchMap((token) =>
          token
            ? revokeGoogleToken$({ transport: ports.transport, token }).pipe(catchError(() => of(undefined)))
            : of(undefined),
        ),
        switchMap(() => ports.secrets.delete$(TIMETRACK_SECRET_KEYS.googleRefreshToken)),
        tap(() => {
          tokens.invalidate();
          settings.recheckCredentials();
          calendars.set(null);
        }),
      ),
    );

  const actions$ = new Subject<Observable<unknown>>();

  actions$
    .pipe(
      exhaustMap((action$) => action$),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe();

  return {
    busy: busy.asReadonly(),
    failure: failure.asReadonly(),
    /** The account's calendars, or `null` until they have been asked for. */
    calendars: calendars.asReadonly(),

    /** An access token that is valid now, or `null` while no account is connected. */
    credentials$: (): Observable<GoogleCalendarCredentials | null> => tokens.credentials$(),

    connect: () => actions$.next(connect$()),
    disconnect: () => actions$.next(disconnect$()),
    loadCalendars: () => actions$.next(started(calendars$())),
  };
});

export const injectGoogleAccount = /* @__PURE__ */ toInjectFn(GOOGLE_ACCOUNT_DEF);
