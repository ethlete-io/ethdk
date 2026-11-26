import { GoogleOAuthClient } from './tokens';

export type GoogleClientChoice =
  { source: 'own'; client: GoogleOAuthClient } | { source: 'built-in'; client: GoogleOAuthClient } | { source: 'none' };

/**
 * Which OAuth client the account runs through. A client the user registered themselves wins over the
 * one the build carries; it counts only when both its id and its secret are set, so a half-typed
 * override does not shadow a working built-in client.
 */
export const selectGoogleClient = (options: {
  own: { clientId: string; clientSecret: string };
  builtIn: GoogleOAuthClient | null;
}): GoogleClientChoice => {
  const own = { clientId: options.own.clientId.trim(), clientSecret: options.own.clientSecret.trim() };

  if (own.clientId && own.clientSecret) return { source: 'own', client: own };

  if (options.builtIn?.clientId && options.builtIn.clientSecret) return { source: 'built-in', client: options.builtIn };

  return { source: 'none' };
};
