import { TestBed } from '@angular/core/testing';
import {
  FakeBroadcastChannelHandle,
  FakeWebLocksHandle,
  flushMultiTabSync,
  installFakeBroadcastChannel,
  installFakeWebLocks,
  QueryTestSetup,
  setupAuthTest,
  setupQueryTest,
} from '@ethlete/query/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withBearerAuthMultiTabSync } from './bearer-auth-multi-tab-sync';
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
    let bus: FakeBroadcastChannelHandle;
    let locks: FakeWebLocksHandle;

    beforeEach(() => {
      bus = installFakeBroadcastChannel();
      locks = installFakeWebLocks();
    });

    afterEach(() => {
      // Tear the injector down while the fakes are still installed: destroying it releases the leader
      // lock and posts a goodbye, which a restored `BroadcastChannel` would no longer accept.
      TestBed.resetTestingModule();

      bus.restore();
      locks.restore();
      vi.clearAllMocks();
    });

    /** Lets lock grants, presence messages and the recount behind the instance count land. */
    const settle = async () => {
      for (let i = 0; i < 5; i++) {
        TestBed.tick();
        await flushMultiTabSync();
      }
    };

    /** Another tab of the app, as far as the election is concerned: it holds the lock, or waits for it. */
    const otherTab = () => {
      let release = () => {
        /* not granted yet */
      };

      const held = navigator.locks.request(
        'ethlete-auth:leader:test-auth',
        () => new Promise<void>((resolve) => (release = resolve)),
      );
      const channel = new BroadcastChannel('ethlete-auth-leader:test-auth');

      channel.postMessage({ type: 'presence' });

      return { close: () => (release(), channel.close(), held) };
    };

    const postedOn = (channelName: string) =>
      bus.posted.filter((message) => message.channel === channelName).map((message) => message.data);

    it('should emit leaderStatusChange once the lock is granted', async () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [withTracking(), withBearerAuthMultiTabSync()],
      });

      await TestBed.runInInjectionContext(async () => {
        const handler = vi.fn();
        authSetup.auth.features.tracking.on('leaderStatusChange', handler);

        await settle();

        expect(handler).toHaveBeenCalledWith({ isLeader: true });
      });
    });

    it('should emit leaderStatusChange when another tab holds the lock, and again on taking over', async () => {
      const leader = otherTab();

      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [withTracking(), withBearerAuthMultiTabSync()],
      });

      await TestBed.runInInjectionContext(async () => {
        const handler = vi.fn();
        authSetup.auth.features.tracking.on('leaderStatusChange', handler);

        await settle();

        expect(handler).toHaveBeenCalledWith({ isLeader: false });
        handler.mockClear();

        // The other tab goes away, which is the only way leadership ever moves with Web Locks.
        leader.close();
        await settle();

        expect(handler).toHaveBeenCalledWith({ isLeader: true });
      });
    });

    it('should emit leaderInstanceCountChange with initial count on setup', async () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [withTracking(), withBearerAuthMultiTabSync()],
      });

      await TestBed.runInInjectionContext(async () => {
        const handler = vi.fn();
        authSetup.auth.features.tracking.on('leaderInstanceCountChange', handler);

        await settle();

        expect(handler).toHaveBeenCalledWith({ count: 1 });
      });
    });

    it('should emit leaderInstanceCountChange when another tab announces itself', async () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [withTracking(), withBearerAuthMultiTabSync()],
      });

      await TestBed.runInInjectionContext(async () => {
        const handler = vi.fn();
        authSetup.auth.features.tracking.on('leaderInstanceCountChange', handler);

        await settle();
        handler.mockClear();

        const second = otherTab();

        await settle();

        expect(handler).toHaveBeenCalledWith({ count: 2 });

        second.close();
      });
    });

    it('should not emit leader events when leader election is disabled', () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [withTracking()],
        // No `withBearerAuthMultiTabSync()`, so this tab is its own leader
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

    it('should forward events from non-leader tabs to the leader', async () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [withTracking(), withBearerAuthMultiTabSync()],
      });

      await TestBed.runInInjectionContext(async () => {
        const handler = vi.fn();
        authSetup.auth.features.tracking.on('logout', handler);

        await settle();

        // A non-leader tab forwarding a logout event over the tracking channel.
        new BroadcastChannel('ethlete-auth-tracking').postMessage({ event: 'logout', data: undefined });

        await flushMultiTabSync();

        expect(handler).toHaveBeenCalled();
      });
    });

    it('should forward a logout instead of firing it locally when another tab is the leader', async () => {
      const leader = otherTab();

      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [withTracking(), withBearerAuthMultiTabSync()],
      });

      await TestBed.runInInjectionContext(async () => {
        const localLogoutHandler = vi.fn();
        authSetup.auth.features.tracking.on('logout', localLogoutHandler);

        // Give the tab tokens, so logging out actually clears something and triggers the effect.
        authSetup.login({ email: 'test@test.com', password: 'test' }, { accessToken: 'at', refreshToken: 'rt' });

        await settle();

        expect(authSetup.auth.isAuthenticated()).toBe(true);

        const forwardedBefore = postedOn('ethlete-auth-tracking').length;

        authSetup.auth.logout();

        await settle();

        // The event belongs to the leader, so this tab hands it over rather than firing it.
        expect(localLogoutHandler).not.toHaveBeenCalled();
        expect(postedOn('ethlete-auth-tracking').slice(forwardedBefore)).toEqual([
          { event: 'logout', data: { cause: 'user' } },
        ]);

        leader.close();
      });
    });
  });
});
