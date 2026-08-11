import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BearerAuthSessionEndCause } from '../bearer-auth-provider';
import { encryptToken, resetEncryptionKey } from '../utils';
import { MultiTabSyncConfig, setupMultiTabSync } from './multi-tab-sync';

describe('setupMultiTabSync', () => {
  let originalBroadcastChannel: typeof BroadcastChannel;
  let mockChannel: {
    postMessage: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    onmessage: ((event: MessageEvent) => void) | null;
  };
  let accessToken: ReturnType<typeof signal<string | null>>;
  let refreshToken: ReturnType<typeof signal<string | null>>;
  let sessionEndCause: ReturnType<typeof signal<BearerAuthSessionEndCause | null>>;
  let applyTokens: ReturnType<typeof vi.fn>;
  let logout: ReturnType<typeof vi.fn>;
  let localStorageMock: {
    getItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
    _storage: Map<string, string>;
  };

  let isLeader = true;

  /** The provider's two entry points, standing in for what `createBearerAuthProvider` hands the sync. */
  const setup = (config: MultiTabSyncConfig = {}) =>
    setupMultiTabSync(config, {
      accessToken,
      refreshToken,
      sessionEndCause,
      name: 'test-auth',
      isLeader: () => isLeader,
      applyTokens: applyTokens as unknown as (access: string, refresh: string) => void,
      logout: logout as unknown as () => void,
    });

  beforeEach(() => {
    // Mock localStorage with actual storage behavior
    const storage = new Map<string, string>();
    localStorageMock = {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
      removeItem: vi.fn((key: string) => storage.delete(key)),
      _storage: storage,
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });

    // Reset encryption key
    resetEncryptionKey();

    // Mock BroadcastChannel
    originalBroadcastChannel = globalThis.BroadcastChannel;
    mockChannel = {
      postMessage: vi.fn(),
      close: vi.fn(),
      onmessage: null,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).BroadcastChannel = vi.fn(function (this: any) {
      return mockChannel;
    });

    // Create fresh signals
    accessToken = signal<string | null>(null);
    refreshToken = signal<string | null>(null);
    sessionEndCause = signal<BearerAuthSessionEndCause | null>(null);
    isLeader = true;

    applyTokens = vi.fn((access: string, refresh: string) => {
      accessToken.set(access);
      refreshToken.set(refresh);
      sessionEndCause.set(null);
    });

    logout = vi.fn((cause: BearerAuthSessionEndCause = 'user') => {
      accessToken.set(null);
      refreshToken.set(null);
      sessionEndCause.set(cause);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    globalThis.BroadcastChannel = originalBroadcastChannel;
  });

  it('should initialize with default config', () => {
    TestBed.runInInjectionContext(() => {
      const sync = setup();

      expect(sync.cleanup).toBeDefined();
      expect(globalThis.BroadcastChannel).toHaveBeenCalledWith('ethlete-auth-sync:test-auth');
    });
  });

  it('should use custom channel name', () => {
    TestBed.runInInjectionContext(() => {
      setup({ channelName: 'custom-channel' });

      expect(globalThis.BroadcastChannel).toHaveBeenCalledWith('custom-channel');
    });
  });

  it('should broadcast token updates when tokens change', () => {
    TestBed.runInInjectionContext(() => {
      setup();

      mockChannel.postMessage.mockClear();

      accessToken.set('access-token');
      refreshToken.set('refresh-token');

      TestBed.flushEffects();

      expect(mockChannel.postMessage).toHaveBeenCalledWith({
        type: 'tokens-updated',
        accessToken: encryptToken('access-token'),
        refreshToken: encryptToken('refresh-token'),
      });
    });
  });

  it('should not broadcast token updates when syncTokens is false', () => {
    TestBed.runInInjectionContext(() => {
      setup({ syncTokens: false });

      mockChannel.postMessage.mockClear();

      accessToken.set('access-token');
      refreshToken.set('refresh-token');

      TestBed.flushEffects();

      expect(mockChannel.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'tokens-updated' }));
    });
  });

  it('should broadcast logout when tokens are cleared', () => {
    TestBed.runInInjectionContext(() => {
      setup();

      accessToken.set('access-token');
      refreshToken.set('refresh-token');
      TestBed.flushEffects();

      mockChannel.postMessage.mockClear();

      accessToken.set(null);
      refreshToken.set(null);

      TestBed.flushEffects();

      expect(mockChannel.postMessage).toHaveBeenCalledWith({
        type: 'logout',
        cause: undefined,
      });
    });
  });

  it('should broadcast the cause the session ended with', () => {
    TestBed.runInInjectionContext(() => {
      setup();

      accessToken.set('access-token');
      refreshToken.set('refresh-token');
      TestBed.flushEffects();

      mockChannel.postMessage.mockClear();

      logout('expired');

      TestBed.flushEffects();

      expect(mockChannel.postMessage).toHaveBeenCalledWith({ type: 'logout', cause: 'expired' });
    });
  });

  it('should report an incoming session that ended on its own with the cause it ended with', () => {
    TestBed.runInInjectionContext(() => {
      setup();

      accessToken.set('access-token');
      refreshToken.set('refresh-token');
      TestBed.flushEffects();

      mockChannel.onmessage?.({ data: { type: 'logout', cause: 'inactivity' } } as MessageEvent);

      expect(logout).toHaveBeenCalledWith('inactivity');
    });
  });

  it('should report an incoming deliberate logout as otherTab', () => {
    TestBed.runInInjectionContext(() => {
      setup();

      accessToken.set('access-token');
      refreshToken.set('refresh-token');
      TestBed.flushEffects();

      mockChannel.onmessage?.({ data: { type: 'logout', cause: 'user' } } as MessageEvent);

      expect(logout).toHaveBeenCalledWith('otherTab');
    });
  });

  it('should not broadcast logout when syncLogout is false', () => {
    TestBed.runInInjectionContext(() => {
      setup({ syncLogout: false });

      accessToken.set('access-token');
      refreshToken.set('refresh-token');
      TestBed.flushEffects();

      mockChannel.postMessage.mockClear();

      accessToken.set(null);

      TestBed.flushEffects();

      expect(mockChannel.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'logout' }));
    });
  });

  it('should apply incoming tokens through applyTokens so failed secure queries retry', () => {
    TestBed.runInInjectionContext(() => {
      setup();

      mockChannel.onmessage?.({
        data: {
          type: 'tokens-updated',
          accessToken: encryptToken('external-access'),
          refreshToken: encryptToken('external-refresh'),
        },
      } as MessageEvent);

      expect(applyTokens).toHaveBeenCalledWith('external-access', 'external-refresh');
      expect(accessToken()).toBe('external-access');
      expect(refreshToken()).toBe('external-refresh');
    });
  });

  it('should ignore an incoming pair that decrypts to an empty token', () => {
    TestBed.runInInjectionContext(() => {
      setup();

      mockChannel.onmessage?.({
        data: { type: 'tokens-updated', accessToken: encryptToken('external-access'), refreshToken: '' },
      } as MessageEvent);

      expect(applyTokens).not.toHaveBeenCalled();
    });
  });

  it('should end the session through logout on an incoming logout', () => {
    TestBed.runInInjectionContext(() => {
      setup();

      accessToken.set('access-token');
      refreshToken.set('refresh-token');
      TestBed.flushEffects();

      mockChannel.onmessage?.({ data: { type: 'logout' } } as MessageEvent);

      expect(logout).toHaveBeenCalledWith('otherTab');
      expect(accessToken()).toBeNull();
      expect(refreshToken()).toBeNull();
    });
  });

  it('should not apply token updates when syncTokens is false', () => {
    TestBed.runInInjectionContext(() => {
      setup({ syncTokens: false });

      mockChannel.onmessage?.({
        data: {
          type: 'tokens-updated',
          accessToken: encryptToken('external-access'),
          refreshToken: encryptToken('external-refresh'),
        },
      } as MessageEvent);

      expect(applyTokens).not.toHaveBeenCalled();
      expect(accessToken()).toBeNull();
      expect(refreshToken()).toBeNull();
    });
  });

  it('should announce activity and report what other tabs announce', () => {
    TestBed.runInInjectionContext(() => {
      const sync = setup();
      const seen: number[] = [];

      sync.activityCoordination?.activity$.subscribe(() => seen.push(1));

      sync.activityCoordination?.announce();

      expect(mockChannel.postMessage).toHaveBeenCalledWith({ type: 'activity' });

      mockChannel.onmessage?.({ data: { type: 'activity' } } as MessageEvent);

      expect(seen).toHaveLength(1);
      expect(logout).not.toHaveBeenCalled();
    });
  });

  it('should not coordinate activity when syncLogout is false', () => {
    TestBed.runInInjectionContext(() => {
      const sync = setup({ syncLogout: false });

      expect(sync.activityCoordination).toBeUndefined();
    });
  });

  it('should not apply logout when syncLogout is false', () => {
    TestBed.runInInjectionContext(() => {
      setup({ syncLogout: false });

      accessToken.set('access-token');
      refreshToken.set('refresh-token');

      mockChannel.onmessage?.({ data: { type: 'logout' } } as MessageEvent);

      expect(logout).not.toHaveBeenCalled();
      expect(accessToken()).toBe('access-token');
      expect(refreshToken()).toBe('refresh-token');
    });
  });

  it('should not echo an incoming token update back out', () => {
    TestBed.runInInjectionContext(() => {
      setup();

      mockChannel.postMessage.mockClear();

      mockChannel.onmessage?.({
        data: {
          type: 'tokens-updated',
          accessToken: encryptToken('external-access'),
          refreshToken: encryptToken('external-refresh'),
        },
      } as MessageEvent);

      TestBed.flushEffects();

      expect(mockChannel.postMessage).not.toHaveBeenCalled();
    });
  });

  it('should not echo an incoming logout back out', () => {
    TestBed.runInInjectionContext(() => {
      setup();

      accessToken.set('access-token');
      refreshToken.set('refresh-token');
      TestBed.flushEffects();

      mockChannel.postMessage.mockClear();

      mockChannel.onmessage?.({ data: { type: 'logout' } } as MessageEvent);

      TestBed.flushEffects();

      expect(mockChannel.postMessage).not.toHaveBeenCalled();
    });
  });

  it('should broadcast a local login that follows an incoming logout', () => {
    TestBed.runInInjectionContext(() => {
      setup();

      mockChannel.onmessage?.({ data: { type: 'logout' } } as MessageEvent);
      TestBed.flushEffects();

      mockChannel.postMessage.mockClear();

      accessToken.set('local-access');
      refreshToken.set('local-refresh');

      TestBed.flushEffects();

      expect(mockChannel.postMessage).toHaveBeenCalledWith({
        type: 'tokens-updated',
        accessToken: encryptToken('local-access'),
        refreshToken: encryptToken('local-refresh'),
      });
    });
  });

  it('should close channel on cleanup', () => {
    TestBed.runInInjectionContext(() => {
      const sync = setup();

      sync.cleanup();

      expect(mockChannel.close).toHaveBeenCalled();
    });
  });

  it('should work when BroadcastChannel is not available', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).BroadcastChannel = undefined;

    TestBed.runInInjectionContext(() => {
      const sync = setup();

      expect(sync.cleanup).toBeDefined();

      // Cleanup should not throw
      expect(() => sync.cleanup()).not.toThrow();

      // Setting tokens should not throw
      accessToken.set('access-token');
      refreshToken.set('refresh-token');

      TestBed.flushEffects();

      // Should work without errors
      expect(accessToken()).toBe('access-token');
    });
  });

  it('should not broadcast when only access token is set', () => {
    TestBed.runInInjectionContext(() => {
      setup();

      mockChannel.postMessage.mockClear();

      accessToken.set('access-token');

      TestBed.flushEffects();

      // Should not broadcast (both tokens required)
      expect(mockChannel.postMessage).not.toHaveBeenCalled();
    });
  });

  it('should not broadcast when only refresh token is set', () => {
    TestBed.runInInjectionContext(() => {
      setup();

      mockChannel.postMessage.mockClear();

      refreshToken.set('refresh-token');

      TestBed.flushEffects();

      // Should not broadcast (both tokens required)
      expect(mockChannel.postMessage).not.toHaveBeenCalled();
    });
  });
  describe('join handshake', () => {
    it('should ask for the live session on setup', () => {
      TestBed.runInInjectionContext(() => {
        const sync = setup();

        expect(mockChannel.postMessage).toHaveBeenCalledWith({ type: 'state-request' });
        expect(sync.sessionAdoption?.isPending()).toBe(true);
      });
    });

    it('should not ask when tokens are deliberately tab local', () => {
      TestBed.runInInjectionContext(() => {
        const sync = setup({ syncTokens: false });

        expect(mockChannel.postMessage).not.toHaveBeenCalled();
        expect(sync.sessionAdoption).toBeUndefined();
      });
    });

    it('should answer another tab with the session it holds, as the leader', () => {
      TestBed.runInInjectionContext(() => {
        setup();

        accessToken.set('access-token');
        refreshToken.set('refresh-token');
        TestBed.flushEffects();
        mockChannel.postMessage.mockClear();

        mockChannel.onmessage?.({ data: { type: 'state-request' } } as MessageEvent);

        expect(mockChannel.postMessage).toHaveBeenCalledWith({
          type: 'tokens-updated',
          accessToken: encryptToken('access-token'),
          refreshToken: encryptToken('refresh-token'),
        });
      });
    });

    it('should stay silent as a follower, or with no session to hand over', () => {
      TestBed.runInInjectionContext(() => {
        isLeader = false;
        setup();

        accessToken.set('access-token');
        refreshToken.set('refresh-token');
        TestBed.flushEffects();
        mockChannel.postMessage.mockClear();

        mockChannel.onmessage?.({ data: { type: 'state-request' } } as MessageEvent);

        expect(mockChannel.postMessage).not.toHaveBeenCalled();

        isLeader = true;
        accessToken.set(null);
        refreshToken.set(null);
        TestBed.flushEffects();
        mockChannel.postMessage.mockClear();

        mockChannel.onmessage?.({ data: { type: 'state-request' } } as MessageEvent);

        expect(mockChannel.postMessage).not.toHaveBeenCalled();
      });
    });

    it('should settle the moment tokens arrive', async () => {
      await TestBed.runInInjectionContext(async () => {
        const sync = setup();

        mockChannel.onmessage?.({
          data: {
            type: 'tokens-updated',
            accessToken: encryptToken('incoming-access'),
            refreshToken: encryptToken('incoming-refresh'),
          },
        } as MessageEvent);

        expect(sync.sessionAdoption?.isPending()).toBe(false);
        await expect(sync.sessionAdoption?.settled).resolves.toBeUndefined();
      });
    });

    it('should settle on its own when nobody answers', async () => {
      vi.useFakeTimers();

      try {
        await TestBed.runInInjectionContext(async () => {
          const sync = setup();

          expect(sync.sessionAdoption?.isPending()).toBe(true);

          vi.advanceTimersByTime(250);

          expect(sync.sessionAdoption?.isPending()).toBe(false);
          await expect(sync.sessionAdoption?.settled).resolves.toBeUndefined();
        });
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
