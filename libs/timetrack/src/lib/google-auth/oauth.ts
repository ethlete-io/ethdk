/* eslint-disable @typescript-eslint/naming-convention -- the OAuth 2.0 wire format is snake_case. */
export const GOOGLE_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const GOOGLE_REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';

/**
 * What the app asks Google for.
 *
 * `calendar.events.readonly` is what a day is reconstructed from. `calendar.readonly` is what lists the
 * user's calendars, and the picker needs it: a person has a work calendar, a personal one and shared
 * team ones, and only they can say which of them count as work.
 */
export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
] as const;

/**
 * The query the authorization URL carries, minus the four values the host owns: `redirect_uri`,
 * `code_challenge`, `code_challenge_method` and `state` all depend on the loopback port and the
 * verifier, which are the host's to generate.
 *
 * `access_type=offline` with `prompt=consent` is what makes Google issue a refresh token. Google issues
 * one only on the first consent for a client, so a re-connect without the prompt returns an access token
 * and nothing to renew it with — which reads as a working connection that dies within the hour.
 */
export const googleAuthorizationQuery = (options: {
  clientId: string;
  scopes?: readonly string[];
}): Record<string, string> => ({
  client_id: options.clientId,
  response_type: 'code',
  scope: (options.scopes ?? GOOGLE_CALENDAR_SCOPES).join(' '),
  access_type: 'offline',
  prompt: 'consent',
});
