import { describe, expect, it } from 'vitest';
import { GOOGLE_CALENDAR_SCOPES, googleAuthorizationQuery } from './oauth';

describe('googleAuthorizationQuery', () => {
  it('asks for a refresh token, which google only issues on a fresh consent', () => {
    const query = googleAuthorizationQuery({ clientId: 'client' });

    expect(query['access_type']).toBe('offline');
    expect(query['prompt']).toBe('consent');
  });

  it('asks for the calendar list as well as the events, because the picker needs it', () => {
    expect(googleAuthorizationQuery({ clientId: 'client' })['scope']).toBe(GOOGLE_CALENDAR_SCOPES.join(' '));
  });

  it('leaves the redirect and the challenge to the host, which is what knows the port', () => {
    const query = googleAuthorizationQuery({ clientId: 'client' });

    expect(query['redirect_uri']).toBeUndefined();
    expect(query['code_challenge']).toBeUndefined();
  });
});
