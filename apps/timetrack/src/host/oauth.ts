import { Observable } from 'rxjs';
import { invokeHost$ } from './invoke';

export type AuthorizeRequest = {
  authorizationEndpoint: string;
  /** Everything the provider needs that does not depend on the loopback port or the verifier. */
  query: Record<string, string>;
  timeoutSecs?: number;
};

export type AuthorizeOutcome = {
  code: string;
  /** The exact redirect the authorization used. The token exchange is rejected without the same one. */
  redirectUri: string;
  codeVerifier: string;
};

/**
 * The browser half of an OAuth 2.0 authorization code flow.
 *
 * The host owns it because the webview can neither open a browser nor listen on a port, and both are
 * what an installed application's redirect is made of. The window never sees the authorization URL.
 */
export type TauriOAuth = {
  authorize$(request: AuthorizeRequest): Observable<AuthorizeOutcome>;
};

export const createTauriOAuth = (): TauriOAuth => ({
  authorize$: (request) => invokeHost$<AuthorizeOutcome>('oauth_authorize', { request }),
});
