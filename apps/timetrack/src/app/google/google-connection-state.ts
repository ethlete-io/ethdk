export type GoogleConnectionState = 'needs-client' | 'not-connected' | 'reconnect' | 'connected';

/**
 * What the Google card shows. A rejected refresh token outranks `connected`, because the token is
 * still stored and every other check reads as connected.
 */
export const googleConnectionState = (options: {
  hasClient: boolean;
  connected: boolean;
  needsReconnect: boolean;
}): GoogleConnectionState => {
  if (!options.hasClient) return 'needs-client';
  if (options.connected && options.needsReconnect) return 'reconnect';

  return options.connected ? 'connected' : 'not-connected';
};
