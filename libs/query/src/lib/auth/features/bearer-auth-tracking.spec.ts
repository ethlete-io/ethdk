import { TestBed } from '@angular/core/testing';
import { QueryTestSetup, setupAuthTest, setupQueryTest } from '@ethlete/query/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withTracking } from './bearer-auth-tracking';

describe('bearer-auth-tracking', () => {
  let setup: QueryTestSetup;

  beforeEach(() => {
    setup = setupQueryTest({ baseUrl: 'https://api.test.com', name: 'test-auth' });
    vi.clearAllMocks();
  });

  describe('TrackingFeature', () => {
    it('should track login success', async () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [withTracking()],
      });

      await TestBed.runInInjectionContext(async () => {
        const handler = vi.fn();
        authSetup.auth.features.tracking.on('loginSuccess', handler);

        authSetup.login({ email: 'test@test.com', password: 'test' }, { accessToken: 'at', refreshToken: 'rt' });

        TestBed.tick();

        // Wait for query to resolve
        await vi.waitFor(() => {
          expect(handler).toHaveBeenCalledWith(
            expect.objectContaining({
              snapshot: expect.anything(),
            }),
          );
        });
      });
    });

    it('should allow unsubscribing from events', async () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [withTracking()],
      });

      await TestBed.runInInjectionContext(async () => {
        const handler = vi.fn();
        const unsubscribe = authSetup.auth.features.tracking.on('loginSuccess', handler);

        unsubscribe();

        authSetup.login({ email: 'test@test.com', password: 'test' }, { accessToken: 'at', refreshToken: 'rt' });

        // Handler should not be called
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(handler).not.toHaveBeenCalled();
      });
    });

    it('should track logout', () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [withTracking()],
      });

      TestBed.runInInjectionContext(() => {
        const handler = vi.fn();
        authSetup.auth.features.tracking.on('logout', handler);

        // First login to have tokens
        authSetup.login({ email: 'test@test.com', password: 'test' }, { accessToken: 'at', refreshToken: 'rt' });
        TestBed.tick();

        authSetup.auth.logout();
        TestBed.tick();

        expect(handler).toHaveBeenCalled();
      });
    });

    it('should track token refresh', async () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [withTracking()],
      });

      await TestBed.runInInjectionContext(async () => {
        const handler = vi.fn();
        authSetup.auth.features.tracking.on('tokenRefreshSuccess', handler);

        authSetup.refresh('test-refresh-token', { accessToken: 'new-at', refreshToken: 'new-rt' });

        // Wait for token refresh
        await vi.waitFor(() => {
          expect(handler).toHaveBeenCalled();
        });
      });
    });

    it('should support event handlers in config', async () => {
      const loginSuccessHandler = vi.fn();
      const logoutHandler = vi.fn();

      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [
          withTracking({
            on: {
              loginSuccess: loginSuccessHandler,
              logout: logoutHandler,
            },
          }),
        ],
      });

      await TestBed.runInInjectionContext(async () => {
        authSetup.login({ email: 'test@test.com', password: 'test' }, { accessToken: 'at', refreshToken: 'rt' });

        TestBed.tick();

        await vi.waitFor(() => {
          expect(loginSuccessHandler).toHaveBeenCalledWith(
            expect.objectContaining({
              snapshot: expect.anything(),
            }),
          );
        });

        authSetup.auth.logout();
        TestBed.tick();

        expect(logoutHandler).toHaveBeenCalled();
      });
    });
  });

  describe('LeaderTrackingEvents', () => {
    type MockChannel = {
      postMessage: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
      onmessage: ((event: MessageEvent) => void) | null;
    };

    let channels: Record<string, MockChannel>;
    let originalBroadcastChannel: typeof BroadcastChannel;
    let storage: Record<string, string>;

    beforeEach(() => {
      originalBroadcastChannel = globalThis.BroadcastChannel;
      channels = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).BroadcastChannel = vi.fn(function (this: any, name: string) {
        const ch: MockChannel = { postMessage: vi.fn(), close: vi.fn(), onmessage: null };
        channels[name] = ch;
        return ch;
      });

      storage = {};
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => storage[key] ?? null);
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
        storage[key] = value as string;
      });
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
        delete storage[key];
      });

      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.clearAllMocks();
      globalThis.BroadcastChannel = originalBroadcastChannel;
    });

    it('should emit leaderStatusChange with initial leader state on setup', () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [withTracking()],
        multiTabSync: { leaderElection: true },
      });

      TestBed.runInInjectionContext(() => {
        const handler = vi.fn();
        authSetup.auth.features.tracking.on('leaderStatusChange', handler);

        TestBed.tick();

        expect(handler).toHaveBeenCalledWith({ isLeader: true });
      });
    });

    it('should emit leaderStatusChange when leadership is lost', () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [withTracking()],
        multiTabSync: { leaderElection: true },
      });

      TestBed.runInInjectionContext(() => {
        const handler = vi.fn();
        authSetup.auth.features.tracking.on('leaderStatusChange', handler);

        // Flush initial effect (emits leaderStatusChange({ isLeader: true }))
        TestBed.tick();
        handler.mockClear();

        // Simulate another tab asserting legitimate leadership
        storage['ethlete-auth-leader-heartbeat'] = JSON.stringify({ tabId: 'other-tab', timestamp: Date.now() });
        channels['ethlete-auth-leader']?.onmessage?.({
          data: { type: 'heartbeat', tabId: 'other-tab' },
        } as MessageEvent);

        TestBed.tick();

        expect(handler).toHaveBeenCalledWith({ isLeader: false });
      });
    });

    it('should emit leaderInstanceCountChange with initial count on setup', () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [withTracking()],
        multiTabSync: { leaderElection: true },
      });

      TestBed.runInInjectionContext(() => {
        const handler = vi.fn();
        authSetup.auth.features.tracking.on('leaderInstanceCountChange', handler);

        TestBed.tick();

        expect(handler).toHaveBeenCalledWith({ count: 1 });
      });
    });

    it('should emit leaderInstanceCountChange when another tab registers', () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [withTracking()],
        multiTabSync: { leaderElection: true },
      });

      TestBed.runInInjectionContext(() => {
        const handler = vi.fn();
        authSetup.auth.features.tracking.on('leaderInstanceCountChange', handler);

        TestBed.tick();
        handler.mockClear();

        channels['ethlete-auth-leader']?.onmessage?.({
          data: { type: 'instance-register', tabId: 'other-tab-1' },
        } as MessageEvent);

        TestBed.tick();

        expect(handler).toHaveBeenCalledWith({ count: 2 });
      });
    });

    it('should not emit leader events when leader election is disabled', () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [withTracking()],
        // multiTabSync defaults to false in setupAuthTest
      });

      TestBed.runInInjectionContext(() => {
        const leaderHandler = vi.fn();
        const countHandler = vi.fn();
        authSetup.auth.features.tracking.on('leaderStatusChange', leaderHandler);
        authSetup.auth.features.tracking.on('leaderInstanceCountChange', countHandler);

        TestBed.tick();

        expect(leaderHandler).not.toHaveBeenCalled();
        expect(countHandler).not.toHaveBeenCalled();
      });
    });

    it('should forward events from non-leader tabs to the leader', () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [withTracking()],
        multiTabSync: { leaderElection: true },
      });

      TestBed.runInInjectionContext(() => {
        const handler = vi.fn();
        authSetup.auth.features.tracking.on('logout', handler);

        // Simulate a non-leader tab forwarding a logout event via the tracking channel
        channels['ethlete-auth-tracking']?.onmessage?.({
          data: { event: 'logout', data: undefined },
        } as MessageEvent);

        expect(handler).toHaveBeenCalled();
      });
    });

    it('should not fire logout handler locally when this tab is not the leader, but post to forwarding channel instead', () => {
      // Set up another tab as the leader in localStorage before the auth provider is created
      storage['ethlete-auth-leader-heartbeat'] = JSON.stringify({ tabId: 'leader-tab', timestamp: Date.now() });

      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [withTracking()],
        multiTabSync: { leaderElection: true },
      });

      TestBed.runInInjectionContext(() => {
        // This tab should not be the leader since another tab set a fresh heartbeat
        expect(authSetup.auth.features.tracking).toBeDefined();

        const localLogoutHandler = vi.fn();
        authSetup.auth.features.tracking.on('logout', localLogoutHandler);

        // Give the tab tokens so logout actually clears them and triggers the effect
        authSetup.login({ email: 'test@test.com', password: 'test' }, { accessToken: 'at', refreshToken: 'rt' });
        TestBed.tick();

        // Confirm this tab is not the leader
        expect(authSetup.auth.isAuthenticated()).toBe(true);
        const leaderChannel = channels['ethlete-auth-leader'];
        // Keep the other tab's leadership alive so this tab stays non-leader
        storage['ethlete-auth-leader-heartbeat'] = JSON.stringify({ tabId: 'leader-tab', timestamp: Date.now() });
        leaderChannel?.onmessage?.({ data: { type: 'heartbeat', tabId: 'leader-tab' } } as MessageEvent);
        TestBed.tick();

        const forwardingChannel = channels['ethlete-auth-tracking'];
        forwardingChannel?.postMessage.mockClear();

        // Execute logout on this (non-leader) tab
        authSetup.auth.logout();
        TestBed.tick();

        // Local handler must NOT have been called — the event was forwarded, not fired locally
        expect(localLogoutHandler).not.toHaveBeenCalled();

        // The forwarding channel must have received the logout event so the leader can fire it
        expect(forwardingChannel?.postMessage).toHaveBeenCalledWith({ event: 'logout', data: undefined });
      });
    });
  });
});
