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

export interface AuthProviderBearerConfig {
  /**
   * The initial jwt
   */
  token: string;

  /**
   * Refresh token configuration
   */
  refreshConfig?: BearerRefreshConfig;
}

export interface BearerRefreshConfig {
  /**
   * The initial refresh token
   */
  token: string;

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
  bodyAdapter?: (refreshToken: string) => unknown;

  /**
   * Adapter function used to extract the token and refreshToken from the response.
   * @default { token: "token", refreshToken: "refreshToken" }
   */
  responseAdapter?: (response: unknown) => TokenResponse;
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
