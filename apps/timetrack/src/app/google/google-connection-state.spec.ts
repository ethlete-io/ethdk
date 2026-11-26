import { googleConnectionState } from './google-connection-state';

describe('googleConnectionState', () => {
  it('asks for a client while there is none', () => {
    expect(googleConnectionState({ hasClient: false, connected: false, needsReconnect: false })).toBe('needs-client');
  });

  it('offers Connect once a client exists and nothing is connected', () => {
    expect(googleConnectionState({ hasClient: true, connected: false, needsReconnect: false })).toBe('not-connected');
  });

  it('asks to reconnect when the stored token was rejected', () => {
    expect(googleConnectionState({ hasClient: true, connected: true, needsReconnect: true })).toBe('reconnect');
  });

  it('is connected while the token works', () => {
    expect(googleConnectionState({ hasClient: true, connected: true, needsReconnect: false })).toBe('connected');
  });
});
