import { deleteCookie, getCookie, setCookie } from '@ethlete/core';
import { BehaviorSubject, Subject, takeUntil, tap, timer } from 'rxjs';
import { isQueryStateFailure, isQueryStateSuccess, switchQueryState, takeUntilResponse } from '../query';
import { AnyQueryCreator, QueryCreatorReturnType } from '../query-client';
import { AuthBearerRefreshStrategy, AuthProvider, AuthProviderBearerConfig } from './auth-provider.types';
import { decryptBearer } from './auth-provider.utils';

export class BearerAuthProvider<T extends AnyQueryCreator> implements AuthProvider {
  private readonly _destroy$ = new Subject<boolean>();
  private readonly _currentRefreshQuery$ = new BehaviorSubject<QueryCreatorReturnType<T> | null>(null);

  private readonly _tokens$ = new BehaviorSubject<{ token: string | null; refreshToken: string | null }>({
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

  constructor(private _config: AuthProviderBearerConfig<T>) {
    const cookieToken = _config.refreshConfig?.cookieName ? getCookie(_config.refreshConfig.cookieName) ?? null : null;

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

      if (this.tokens.refreshToken && this._config.refreshConfig?.cookieName) {
        setCookie(this._config.refreshConfig.cookieName, this.tokens.refreshToken);
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
      deleteCookie(this._config.refreshConfig.cookieName, '/');
    }
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

  private _refreshQuery() {
    if (!this.tokens.refreshToken || !this._config.refreshConfig) {
      return;
    }

    const args = this._config.refreshConfig.requestArgsAdapter?.(this.tokens) ?? {
      body: { refreshToken: this.tokens.refreshToken },
    };

    const query = this._config.refreshConfig.queryCreator.prepare(args).execute({ skipCache: true });

    this._currentRefreshQuery$.next(query as QueryCreatorReturnType<T>);

    this._currentRefreshQuery$
      .pipe(
        switchQueryState(),
        tap((state) => {
          if (isQueryStateSuccess(state)) {
            if (this._config.refreshConfig?.responseAdapter) {
              const tokens = this._config.refreshConfig.responseAdapter(state.response);

              this._tokens$.next(tokens);
            } else {
              this._tokens$.next({
                token: state.response['token'],
                refreshToken: state.response['refreshToken'],
              });
            }

            if (this._config.refreshConfig?.cookieName && this.tokens.refreshToken) {
              setCookie(this._config.refreshConfig.cookieName, this.tokens.refreshToken);
            }

            this._prepareForRefresh();
          } else if (isQueryStateFailure(state)) {
            this._tokens$.next({ token: null, refreshToken: null });

            if (this._config.refreshConfig?.cookieName) {
              deleteCookie(this._config.refreshConfig.cookieName, '/');
            }
          }
        }),
        takeUntilResponse(),
        takeUntil(this._destroy$),
      )
      .subscribe();
  }
}
