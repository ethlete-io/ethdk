import { Subject, Subscription, timer } from 'rxjs';
import { QueryClient } from '../query-client';
import { buildBody, buildRequestError, buildRoute, request, RequestError } from '../request';
import {
  AuthBearerRefreshStrategy,
  AuthProvider,
  AuthProviderBearerConfig,
  BearerRefreshConfig,
  TokenResponse,
} from './auth-provider.types';
import { decryptBearer } from './auth-provider.utils';

export class BearerAuthProvider implements AuthProvider {
  private _token: string;
  private _refreshToken: string | null = null;
  private _refreshTimerSubscription: Subscription | null = null;

  get header() {
    return { Authorization: `Bearer ${this._token}` };
  }

  queryClient: QueryClient | null = null;

  onRefreshInitiation$ = new Subject<void>();
  onRefreshSuccess$ = new Subject<TokenResponse>();
  onRefreshFailure$ = new Subject<RequestError>();

  constructor(private _config: AuthProviderBearerConfig) {
    this._token = _config.token;
    this._refreshToken = _config.refreshConfig?.token ?? null;

    if (this._config.refreshConfig) {
      this._setupRefresh(this._config.refreshConfig);
    }
  }

  cleanUp(): void {
    this._refreshTimerSubscription?.unsubscribe();
    this._refreshTimerSubscription = null;
  }

  private _setupRefresh(config: BearerRefreshConfig) {
    const bearer = decryptBearer(this._token);

    if (!bearer) {
      return;
    }

    const expiresInPropertyName = config.expiresInPropertyName || 'exp';
    const expiresIn = bearer[expiresInPropertyName] as number | undefined;
    const fiveMinutes = 5 * 60 * 1000;

    if (expiresIn === undefined) {
      throw new Error(`Bearer token does not contain an '${expiresInPropertyName}' property`);
    }

    const remainingTime = new Date(expiresIn * 1000).getTime() - fiveMinutes - new Date().getTime();

    const strategy = config.strategy ?? AuthBearerRefreshStrategy.BeforeExpiration;

    switch (strategy) {
      case AuthBearerRefreshStrategy.BeforeExpiration:
        this._refreshTimerSubscription = timer(remainingTime).subscribe(() => this._refresh(config));
        break;
    }
  }

  private async _refresh(config: BearerRefreshConfig) {
    if (!this._refreshToken) {
      throw new Error('No refresh token found');
    }

    if (!this.queryClient) {
      throw new Error('Query client instance is null');
    }

    const { method, route, bodyAdapter, responseAdapter } = config;

    const fullRoute = buildRoute({
      base: this.queryClient.config.baseRoute,
      route,
    });

    const body = bodyAdapter ? bodyAdapter(this._refreshToken) : { refreshToken: this._refreshToken };
    const requestInit: RequestInit = { body: buildBody(body), method };

    this.onRefreshInitiation$.next();

    try {
      const result = await request({
        route: fullRoute,
        init: requestInit,
      });

      const tokens = responseAdapter ? responseAdapter(result.data) : (result.data as TokenResponse);

      if (!tokens.token) {
        throw new Error('Token not found in response');
      }

      if (!tokens.refreshToken) {
        throw new Error('Refresh token not found in response');
      }

      this._token = tokens.token;
      this._refreshToken = tokens.refreshToken;

      this.onRefreshSuccess$.next(tokens);
    } catch (error) {
      if (error instanceof Error) {
        this.onRefreshFailure$.next(await buildRequestError(error, fullRoute, requestInit));
      } else {
        this.onRefreshFailure$.next(error as RequestError);
      }
    }
  }
}
