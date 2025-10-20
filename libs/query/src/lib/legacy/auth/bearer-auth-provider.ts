import { deleteCookie, getCookie, setCookie } from '@ethlete/core';
import { BehaviorSubject, Subject, takeUntil, tap, timer } from 'rxjs';
import {
  isQueryStateFailure,
  isQueryStateLoading,
  isQueryStateSuccess,
  switchQueryState,
  takeUntilResponse,
} from '../query';
import { AnyV2QueryCreator, ConstructQuery, QueryResponseOf } from '../query-creator';
import {
  AuthBearerRefreshStrategy,
  AuthProvider,
  AuthProviderBearerConfig,
  TokenResponse,
} from './auth-provider.types';
import { decryptBearer } from './auth-provider.utils';

export class V2BearerAuthProvider<T extends AnyV2QueryCreator> implements AuthProvider {
  private readonly _destroy$ = new Subject<boolean>();
  private readonly _currentRefreshQuery$ = new BehaviorSubject<ConstructQuery<T> | null>(null);

  private readonly _tokens$ = new BehaviorSubject<TokenResponse>({
    token: null,
    refreshToken: null,
  });

  get header() {
    return { Authorization: `Bearer ${this._tokens$.getValue().token}` };
  }

  get tokens$() {
    return this._tokens$.asObservable();
  }

  get tokens() {
    return this._tokens$.getValue();
  }

  get currentRefreshQuery$() {
    return this._currentRefreshQuery$.asObservable();
  }

  get currentRefreshQuery() {
    return this._currentRefreshQuery$.getValue();
  }

  get shouldRefreshOnUnauthorizedResponse() {
    return (
      !!this._config.refreshConfig &&
      (this._config.refreshConfig.refreshOnUnauthorizedResponse === undefined ||
        this._config.refreshConfig.refreshOnUnauthorizedResponse)
    );
  }

  constructor(public _config: AuthProviderBearerConfig<T>) {
    const cookieEnabled = _config.refreshConfig?.cookieEnabled ?? true;
    const cookieToken =
      _config.refreshConfig?.cookieName && cookieEnabled ? (getCookie(_config.refreshConfig.cookieName) ?? null) : null;

    this._tokens$.next({
      token: _config.token || null,
      refreshToken: _config.refreshConfig?.token || cookieToken || null,
    });

    if (!this.tokens.token && !this.tokens.refreshToken) {
      if (!_config.refreshConfig?.cookieName) {
        console.error(
          'A BearerAuthProvider was created without token or refresh token. You should provide at least a cookieName where the refresh token might be stored.',
        );
      }

      return;
    }

    if (this.tokens.token) {
      this._prepareForRefresh();

      if (this.tokens.refreshToken && this._config.refreshConfig?.cookieName && cookieEnabled) {
        this._setCookie();
      }
    } else if (this.tokens.refreshToken) {
      this._refreshQuery();
    }
  }

  cleanUp(): void {
    this._destroy$.next(true);
    this._destroy$.unsubscribe();
    this._currentRefreshQuery$.next(null);

    if (this._config.refreshConfig?.cookieName) {
      this._deleteCookie();
    }
  }

  enableCookie() {
    if (!this._config.refreshConfig?.cookieName) {
      throw new Error('No cookie name was provided');
    }

    if (!this.tokens.refreshToken) {
      throw new Error('No refresh token was provided');
    }

    this._config.refreshConfig.cookieEnabled = true;

    this._setCookie();
  }

  disableCookie() {
    if (!this._config.refreshConfig?.cookieName) {
      throw new Error('No cookie name was provided');
    }

    this._config.refreshConfig.cookieEnabled = false;

    this._deleteCookie();
  }

  forceRefresh() {
    return this._refreshQuery();
  }

  private _setCookie() {
    if (!this._config.refreshConfig?.cookieName || !this.tokens.refreshToken) return;

    setCookie(
      this._config.refreshConfig.cookieName,
      this.tokens.refreshToken,
      this._config.refreshConfig.cookieExpiresInDays,
      this._config.refreshConfig.cookieDomain,
      this._config.refreshConfig.cookiePath,
      this._config.refreshConfig.cookieSameSite,
    );
  }

  private _deleteCookie() {
    if (!this._config.refreshConfig?.cookieName) return;

    deleteCookie(
      this._config.refreshConfig.cookieName,
      this._config.refreshConfig.cookiePath,
      this._config.refreshConfig.cookieDomain,
    );
  }

  private _prepareForRefresh() {
    if (!this.tokens.token || !this._config.refreshConfig) {
      return;
    }

    const bearer = decryptBearer(this.tokens.token);

    if (!bearer) {
      return;
    }

    const expiresInPropertyName = this._config.refreshConfig.expiresInPropertyName || 'exp';
    const expiresIn = bearer[expiresInPropertyName] as number | undefined;
    const fiveMinutes = 5 * 60 * 1000;
    const refreshBuffer = this._config.refreshConfig.refreshBuffer ?? fiveMinutes;

    if (expiresIn === undefined) {
      throw new Error(`Bearer token does not contain an '${expiresInPropertyName}' property`);
    }

    const remainingTime = new Date(expiresIn * 1000).getTime() - refreshBuffer - new Date().getTime();

    const strategy = this._config.refreshConfig.strategy ?? AuthBearerRefreshStrategy.BeforeExpiration;

    switch (strategy) {
      case AuthBearerRefreshStrategy.BeforeExpiration:
        timer(remainingTime)
          .pipe(takeUntil(this._destroy$))
          .subscribe(() => this._refreshQuery());
        break;
    }
  }

  /**
   * @internal
   */
  _refreshQuery() {
    const currentQuery = this._currentRefreshQuery$.getValue();

    if (isQueryStateLoading(currentQuery?.rawState)) {
      return currentQuery;
    }

    const currentRefreshToken = this.tokens.refreshToken;

    if (!currentRefreshToken || !this._config.refreshConfig) {
      return;
    }

    const args = this._config.refreshConfig.requestArgsAdapter?.({
      token: this.tokens.token,
      refreshToken: currentRefreshToken,
    }) ?? {
      body: { refreshToken: currentRefreshToken },
    };

    const query = this._config.refreshConfig.queryCreator.prepare(args).execute({ skipCache: true });

    this._currentRefreshQuery$.next(query as ConstructQuery<T>);

    this._currentRefreshQuery$
      .pipe(
        switchQueryState(),
        tap((state) => {
          if (isQueryStateSuccess(state)) {
            if (this._config.refreshConfig?.responseAdapter) {
              const tokens = this._config.refreshConfig.responseAdapter(state.response as QueryResponseOf<T>);

              this._tokens$.next(tokens);
            } else {
              this._tokens$.next({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                token: (state.response as any)['token'],
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                refreshToken: (state.response as any)['refreshToken'],
              });
            }
            const cookieEnabled = this._config.refreshConfig?.cookieEnabled ?? true;

            if (this._config.refreshConfig?.cookieName && this.tokens.refreshToken && cookieEnabled) {
              this._setCookie();
            }

            this._prepareForRefresh();
          } else if (isQueryStateFailure(state)) {
            this._tokens$.next({ token: null, refreshToken: null });

            if (this._config.refreshConfig?.cookieName) {
              this._deleteCookie();
            }
          }
        }),
        takeUntilResponse(),
        takeUntil(this._destroy$),
      )
      .subscribe();

    return query;
  }
}
