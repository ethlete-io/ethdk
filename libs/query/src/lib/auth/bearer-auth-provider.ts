import { deleteCookie, getCookie, setCookie } from '@ethlete/core';
import { BehaviorSubject, Subject, takeUntil, tap, timer } from 'rxjs';
import { isQueryStateFailure, isQueryStateSuccess, switchQueryState, takeUntilResponse } from '../query';
import { AnyQueryCreator, QueryCreatorReturnType } from '../query-client';
import { AuthBearerRefreshStrategy, AuthProvider, AuthProviderBearerConfig } from './auth-provider.types';
import { decryptBearer } from './auth-provider.utils';

export class BearerAuthProvider<T extends AnyQueryCreator> implements AuthProvider {
  private readonly _destroy$ = new Subject<boolean>();
  private readonly _currentRefreshQuery$ = new BehaviorSubject<QueryCreatorReturnType<T> | null>(null);

  private _token: string | null = null;
  private _refreshToken: string | null = null;

  get header() {
    return { Authorization: `Bearer ${this._token}` };
  }

  get currentRefreshQuery$() {
    return this._currentRefreshQuery$.asObservable();
  }

  get currentRefreshQuery() {
    return this._currentRefreshQuery$.getValue();
  }

  constructor(private _config: AuthProviderBearerConfig<T>) {
    const cookieToken = _config.refreshConfig?.cookieName ? getCookie(_config.refreshConfig.cookieName) ?? null : null;

    this._token = _config.token || null;
    this._refreshToken = _config.refreshConfig?.token || cookieToken || null;

    if (!this._token && !this._refreshToken) {
      if (!_config.refreshConfig?.cookieName) {
        console.error(
          'A BearerAuthProvider was created without token or refresh token. You should provide at least a cookieName where the refresh token might be stored.',
        );
      }

      return;
    }

    this._prepareForRefresh();
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
    if (!this._token || !this._config.refreshConfig) {
      return;
    }

    const bearer = decryptBearer(this._token);

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
    if (!this._refreshToken || !this._config.refreshConfig?.queryCreator) {
      return;
    }

    const args = this._config.refreshConfig.requestArgsAdapter?.(this._refreshToken, this._token) ?? {
      body: { refreshToken: this._refreshToken },
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
              this._token = tokens.token;
              this._refreshToken = tokens.refreshToken || null;
            } else {
              this._token = state.response['token'];
              this._refreshToken = state.response['refreshToken'];
            }

            if (this._config.refreshConfig?.cookieName && this._refreshToken) {
              setCookie(this._config.refreshConfig.cookieName, this._refreshToken);
            }

            this._prepareForRefresh();
          } else if (isQueryStateFailure(state)) {
            this._token = null;
            this._refreshToken = null;

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
