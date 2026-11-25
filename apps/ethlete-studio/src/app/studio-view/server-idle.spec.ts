import { describe, expect, it } from 'vitest';
import { SERVER_QUIET_MS, serverIdleOf } from './server-idle';

describe('serverIdleOf', () => {
  it('reads a server with nothing running and quiet for long enough as idle', () => {
    expect(serverIdleOf({ queued: 0, rendering: 0, working: 0, quietMs: SERVER_QUIET_MS })).toBe(true);
    expect(serverIdleOf({ queued: 0, rendering: 0, working: 0, quietMs: null })).toBe(true);
  });

  it('reads a server that draws, merges or drew a moment ago as busy', () => {
    expect(serverIdleOf({ queued: 1, rendering: 0, working: 0, quietMs: null })).toBe(false);
    expect(serverIdleOf({ queued: 0, rendering: 1, working: 0, quietMs: null })).toBe(false);
    expect(serverIdleOf({ queued: 0, rendering: 0, working: 1, quietMs: 0 })).toBe(false);
    expect(serverIdleOf({ queued: 0, rendering: 0, working: 0, quietMs: SERVER_QUIET_MS - 1 })).toBe(false);
  });

  it('reads a server that answered no report as busy', () => {
    expect(serverIdleOf(null)).toBe(false);
  });
});
