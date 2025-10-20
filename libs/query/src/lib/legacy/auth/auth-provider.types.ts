import { AnyV2QueryCreator, QueryResponseOf, V2QueryArgsOf } from '../query-creator';

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

export interface AuthProviderBearerConfig<T extends AnyV2QueryCreator> {
  /**
   * The initial jwt
   */
  token?: string;

  /**
   * Refresh token configuration
   */
  refreshConfig?: BearerRefreshConfig<T>;
}

export interface BearerRefreshConfig<T extends AnyV2QueryCreator> {
  /**
   * The query used to trade the refresh token for a new token response.
   */
  queryCreator: T;

  /**
   * Determines if the token should be refreshed if **any** query returns a 401 response.
   * @default true
   */
  refreshOnUnauthorizedResponse?: boolean;

  /**
   * The initial refresh token
   */
  token?: string;

  /**
   * The cookie name where the refresh token is stored
   */
  cookieName?: string;

  /**
   * The domain of the cookie. If not set, the current origin will be used.
   *
   * @example
   * "https://example.com" -> "example.com"
   * "https://sub.example.com" -> "example.com"
   */
  cookieDomain?: string;

  /**
   * The days until the cookie expires
   * @default 30
   */
  cookieExpiresInDays?: number;

  /**
   * The path of the cookie
   * @default '/'
   */
  cookiePath?: string;

  /**
   * Enable or disable the cookie
   * @default true
   */
  cookieEnabled?: boolean;

  /**
   * The same site property of the cookie
   * @default 'lax'
   */
  cookieSameSite?: 'strict' | 'none' | 'lax';

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
   * @default { body: { refreshToken: "refreshToken" } }
   */
  requestArgsAdapter?: (tokens: { token: string | null; refreshToken: string }) => V2QueryArgsOf<T>;

  /**
   * Adapter function used to extract the token and refreshToken from the response.
   * @default { token: "token", refreshToken: "refreshToken" }
   */
  responseAdapter?: (response: NonNullable<QueryResponseOf<T>>) => TokenResponse;
}

export const enum AuthBearerRefreshStrategy {
  /**
   * Automatically refresh the token 5 minutes before expiration.
   * The time can be configured with the `refreshBuffer` property.
   */
  BeforeExpiration = 'beforeExpiration',
}

export interface TokenResponse {
  /**
   * The access token used inside the authorization http header.
   */
  token: string | null;

  /**
   * The refresh token used for requesting a new token response once the current tokes is expired.
   * This property is required if the bearer refresh config is set.
   */
  refreshToken: string | null;
}
