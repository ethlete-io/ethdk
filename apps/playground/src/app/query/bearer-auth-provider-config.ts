import { InjectionToken } from '@angular/core';
import { BearerAuthProvider } from './bearer-auth-provider';
import { QueryClientRef } from './query-client-config';
import { QueryMethod, RouteString } from './query-creator';

export type BearerAuthProviderRouteConfig = {
  /**
   * The route to the endpoint
   */
  route: RouteString;

  /**
   * The method of the request
   * @default 'POST'
   */
  method?: QueryMethod;
};

export type BearerAuthProviderCookieConfig = {
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
};

export type CreateBearerAuthProviderConfigOptions = {
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
  login?: BearerAuthProviderRouteConfig;

  /**
   * The token login route configuration
   */
  tokenLogin?: BearerAuthProviderRouteConfig;

  /**
   * The token refresh route configuration
   */
  tokenRefresh?: BearerAuthProviderRouteConfig;

  /**
   * The cookie configuration for the auth provider
   */
  cookie?: BearerAuthProviderCookieConfig;

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

export type BearerAuthProviderConfig = CreateBearerAuthProviderConfigOptions & {
  token: BearerAuthProviderRef;
};

export type BearerAuthProviderRef = InjectionToken<BearerAuthProvider>;

export const createBearerAuthProviderConfig = (options: CreateBearerAuthProviderConfigOptions) => {
  const token = new InjectionToken<BearerAuthProviderConfig>(`BearerAuthProvider_${options.name}`);

  const bearerAuthProviderConfig: BearerAuthProviderConfig = {
    name: options.name,
    queryClientRef: options.queryClientRef,
    token,
  };

  return bearerAuthProviderConfig;
};
