import { describe, expect, it } from 'vitest';
import { selectGoogleClient } from './client';

const BUILT_IN = { clientId: 'shared.apps.googleusercontent.com', clientSecret: 'shared-secret' };
const OWN = { clientId: 'mine.apps.googleusercontent.com', clientSecret: 'my-secret' };

describe('selectGoogleClient', () => {
  it('prefers the client the user registered over the built-in one', () => {
    expect(selectGoogleClient({ own: OWN, builtIn: BUILT_IN })).toEqual({ source: 'own', client: OWN });
  });

  it('uses the built-in client when no own client is set', () => {
    expect(selectGoogleClient({ own: { clientId: '', clientSecret: '' }, builtIn: BUILT_IN })).toEqual({
      source: 'built-in',
      client: BUILT_IN,
    });
  });

  it('does not let a half-set own client shadow the built-in one', () => {
    expect(selectGoogleClient({ own: { clientId: OWN.clientId, clientSecret: ' ' }, builtIn: BUILT_IN }).source).toBe(
      'built-in',
    );
  });

  it('asks for the manual fields when there is neither', () => {
    expect(selectGoogleClient({ own: { clientId: '', clientSecret: '' }, builtIn: null })).toEqual({ source: 'none' });
    expect(selectGoogleClient({ own: { clientId: OWN.clientId, clientSecret: '' }, builtIn: null })).toEqual({
      source: 'none',
    });
  });

  it('trims the own client', () => {
    expect(
      selectGoogleClient({
        own: { clientId: ` ${OWN.clientId} `, clientSecret: `${OWN.clientSecret}\n` },
        builtIn: null,
      }),
    ).toEqual({ source: 'own', client: OWN });
  });
});
