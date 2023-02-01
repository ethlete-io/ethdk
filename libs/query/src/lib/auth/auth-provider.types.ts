import { QueryResponseType } from '../query';
import { AnyQueryCreator, QueryCreatorArgs, QueryCreatorReturnType } from '../query-client';

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

export interface AuthProviderBearerConfig<T extends AnyQueryCreator> {
  /**
   * The initial jwt
   */
  token?: string;

  /**
   * Refresh token configuration
   */
  refreshConfig?: BearerRefreshConfig<T>;
}

export interface BearerRefreshConfig<T extends AnyQueryCreator> {
  /**
   * The query used to trade the refresh token for a new token response.
   */
  queryCreator: T;

  /**
   * The initial refresh token
   */
  token?: string;

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
   * @default { body: { refreshToken: "refreshToken" } }
   */
  requestArgsAdapter?: (tokens: { token: string | null; refreshToken: string }) => QueryCreatorArgs<T>;

  /**
   * Adapter function used to extract the token and refreshToken from the response.
   * @default { token: "token", refreshToken: "refreshToken" }
   */
  responseAdapter?: (response: NonNullable<QueryResponseType<QueryCreatorReturnType<T>>>) => TokenResponse;
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
