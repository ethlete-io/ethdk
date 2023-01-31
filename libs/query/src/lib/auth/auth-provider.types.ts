import { RouteString } from '../query';
import { QueryClient } from '../query-client';
import { Method } from '../request';

export interface AuthProvider {
  /**
   * The up to date auth header.
   * This will automatically get injected into every query that has the `secure` property set to `true`.
   */
  header: Record<string, string>;

  /**
   * Cleanup function that gets called once the auth provider gets destroyed.
   * @internal
   */
  cleanUp(): void;

  /**
   * Reference to the query client
   */
  queryClient: QueryClient | null;
}

export interface AuthProviderBasicConfig {
  /**
   * Basic auth username
   */
  username: string;

  /**
   * Basic auth password
   */
  password: string;
}

export interface AuthProviderCustomHeaderConfig {
  /**
   * The custom header name
   * @example `X-Api-Key`
   */
  name: string;

  /**
   * The custom header value
   * @example `myApiKey`
   */
  value: string;
}

export interface AuthProviderBearerConfig<T = unknown> {
  /**
   * The initial jwt
   */
  token?: string;

  /**
   * Refresh token configuration
   */
  refreshConfig?: BearerRefreshConfig<T>;
}

export interface BearerRefreshConfig<T = unknown> {
  /**
   * The initial refresh token
   */
  token?: string;

  /**
   * The api's refresh route
   * @example /api/auth/refresh-token
   */
  route: RouteString;

  /**
   * The api's refresh route method
   */
  method: Method;

  /**
   * The maximum number of refresh attempts
   * @default 3
   */
  maxRefreshAttempts?: number;

  /**
   * The way the refresh token is sent to the api
   * @default 'body'
   */
  paramLocation?: 'body' | 'query';

  /**
   * The cookie name where the refresh token is stored
   */
  cookieName?: string;

  /**
   * The time in milliseconds before the token expires when the refresh should be triggered.
   * @default 300000 (5 minutes)
   */
  refreshBuffer?: number;

  /**
   * The expires in property name inside the jwt body
   * @default 'exp'
   */
  expiresInPropertyName?: string;

  /**
   * Determines when the token should be refreshed.
   * @default AuthBearerRefreshStrategy.BeforeExpiration
   */
  strategy?: AuthBearerRefreshStrategy;

  /**
   * Adapter function used to build the request body for the refresh request.
   * @default { refreshToken: "refreshToken" }
   */
  requestAdapter?: (refreshToken: string) => Record<string, string>;

  /**
   * Adapter function used to extract the token and refreshToken from the response.
   * @default { token: "token", refreshToken: "refreshToken" }
   */
  responseAdapter?: (response: T) => TokenResponse;
}

export const enum AuthBearerRefreshStrategy {
  /**
   * Automatically refresh the token 5 minutes before expiration.
   */
  BeforeExpiration = 'beforeExpiration',
}

export interface TokenResponse {
  /**
   * The access token used inside the authorization http header.
   */
  token: string;

  /**
   * The refresh token used for requesting a new token response once the current tokes is expired.
   * This property is required if the bearer refresh config is set.
   */
  refreshToken?: string;
}
