import { InjectionToken } from '@angular/core';
import { BearerAuthProvider } from './bearer-auth-provider';
import { QueryArgs, RequestArgs, ResponseType } from './query';
import { QueryClientRef } from './query-client-config';
import { QueryMethod, RouteType } from './query-creator';

export type BearerAuthProviderTokens = {
  accessToken: string;
  refreshToken: string;
};

export type BearerAuthProviderRouteConfig<TArgs extends QueryArgs> = {
  /**
   * The route to the endpoint
   */
  route: RouteType<TArgs>;

  /**
   * The args type of the request. Defined using the `def<MyType>()` function.
   * **Do not forget to execute the `def` function!**
   */
  argsType: TArgs;

  /**
   * The method of the request
   * @default 'POST'
   */
  method?: QueryMethod;

  /**
   * A function that transforms the response into the format that the auth provider expects
   *
   * The expected format is an object with the `accessToken` and `refreshToken` properties.
   *
   * @default (response) => response
   */
  responseTransformer?: (response: ResponseType<TArgs>) => BearerAuthProviderTokens;
};

export type BearerAuthProviderCookieConfig<TTokenRefreshArgs extends QueryArgs> = {
  /**
   * The cookie name where the refresh token is stored
   * @default 'etAuth'
   */
  name?: string;

  /**
   * The domain of the cookie. If not set, the current origin will be used.
   *
   * @example
   * "https://example.com" -> "example.com"
   * "https://sub.example.com" -> "example.com"
   */
  domain?: string;

  /**
   * The days until the cookie expires
   * @default 30
   */
  expiresInDays?: number;

  /**
   * The path of the cookie
   * @default '/'
   */
  path?: string;

  /**
   * Enable or disable the cookie
   * @default true
   */
  enabled?: boolean;

  /**
   * The same site property of the cookie
   * @default 'lax'
   */
  sameSite?: 'strict' | 'none' | 'lax';

  /**
   * A function that turns the token gotten from the cookie into the body for the refresh token request
   * @default (token) => ({ token })
   */
  refreshArgsTransformer?: (token: string) => RequestArgs<TTokenRefreshArgs>;
};

export type CreateBearerAuthProviderConfigOptions<
  TLoginArgs extends QueryArgs,
  TTokenLoginArgs extends QueryArgs,
  TTokenRefreshArgs extends QueryArgs,
> = {
  /**
   * The name of the auth provider
   */
  name: string;

  /**
   * The query client reference
   */
  queryClientRef: QueryClientRef;

  /**
   * The login route configuration
   */
  login?: BearerAuthProviderRouteConfig<TLoginArgs>;

  /**
   * The token login route configuration
   */
  tokenLogin?: BearerAuthProviderRouteConfig<TTokenLoginArgs>;

  /**
   * The token refresh route configuration
   */
  tokenRefresh?: BearerAuthProviderRouteConfig<TTokenRefreshArgs>;

  /**
   * The cookie configuration for the auth provider
   */
  cookie?: BearerAuthProviderCookieConfig<TTokenRefreshArgs>;

  /**
   * The time in milliseconds before the token expires when the refresh should be triggered.
   * @default 300000 // (5 minutes)
   */
  refreshBuffer?: number;

  /**
   * The expires in property name inside the jwt body
   * @default 'exp'
   */
  expiresInPropertyName?: string;

  /**
   * Determines if the token should be refreshed if **any** query returns a 401 response.
   * @default true
   */
  refreshOnUnauthorizedResponse?: boolean;
};

export type BearerAuthProviderConfig<
  TLoginArgs extends QueryArgs,
  TTokenLoginArgs extends QueryArgs,
  TTokenRefreshArgs extends QueryArgs,
> = CreateBearerAuthProviderConfigOptions<TLoginArgs, TTokenLoginArgs, TTokenRefreshArgs> & {
  token: BearerAuthProviderRef<TLoginArgs, TTokenLoginArgs, TTokenRefreshArgs>;
};

export type BearerAuthProviderRef<
  TLoginArgs extends QueryArgs,
  TTokenLoginArgs extends QueryArgs,
  TTokenRefreshArgs extends QueryArgs,
> = InjectionToken<BearerAuthProvider<TLoginArgs, TTokenLoginArgs, TTokenRefreshArgs>>;

export const createBearerAuthProviderConfig = <
  TLoginArgs extends QueryArgs,
  TTokenLoginArgs extends QueryArgs,
  TTokenRefreshArgs extends QueryArgs,
>(
  options: CreateBearerAuthProviderConfigOptions<TLoginArgs, TTokenLoginArgs, TTokenRefreshArgs>,
) => {
  const token = new InjectionToken<BearerAuthProviderConfig<TLoginArgs, TTokenLoginArgs, TTokenRefreshArgs>>(
    `BearerAuthProvider_${options.name}`,
  );

  const bearerAuthProviderConfig: BearerAuthProviderConfig<TLoginArgs, TTokenLoginArgs, TTokenRefreshArgs> = {
    name: options.name,
    queryClientRef: options.queryClientRef,
    token,
  };

  return bearerAuthProviderConfig;
};