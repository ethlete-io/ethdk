import { TestBed } from '@angular/core/testing';
import { installFakeBroadcastChannel, setupAuthTest, setupQueryTest } from '@ethlete/query/testing';
import { withBearerAuthMultiTabSync } from './bearer-auth-multi-tab-sync';
import { withInactivityLogout } from './bearer-auth-inactivity-logout';

describe('bearer-auth-inactivity-logout', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('InactivityLogoutFeature', () => {
    it('should enable and disable inactivity tracking', () => {
      const querySetup = setupQueryTest();
      const { auth } = setupAuthTest({
        querySetup,
        features: [withInactivityLogout()],
      });

      // Feature is enabled by default
      expect(auth.features.inactivityLogout.enabled()).toBe(true);

      auth.features.inactivityLogout.disable();
      expect(auth.features.inactivityLogout.enabled()).toBe(false);

      auth.features.inactivityLogout.enable();
      expect(auth.features.inactivityLogout.enabled()).toBe(true);

      querySetup.httpTesting.verify();
    });

    it('should reset timer on activity', () => {
      const querySetup = setupQueryTest();
      const { auth, login } = setupAuthTest({
        querySetup,
        features: [withInactivityLogout({ inactivityTimeout: 5000 })],
      });

      // Login first
      login({ username: 'test' }, { accessToken: 'token', refreshToken: 'refresh' });

      auth.features.inactivityLogout.enable();

      const initialTimeUntil = auth.features.inactivityLogout.calculateTimeUntilLogout();

      // Simulate some time passing
      vi.advanceTimersByTime(2000);
      TestBed.tick();

      const afterWait = auth.features.inactivityLogout.calculateTimeUntilLogout();
      expect(afterWait).not.toBeNull();
      expect(afterWait).toBeLessThan(initialTimeUntil ?? 0);

      // Reset timer
      auth.features.inactivityLogout.resetTimer();
      TestBed.tick();

      const afterReset = auth.features.inactivityLogout.calculateTimeUntilLogout();
      expect(afterReset).not.toBeNull();
      expect(afterReset).toBeGreaterThan(afterWait ?? 0);

      querySetup.httpTesting.verify();
    });

    it('should logout after inactivity timeout', () => {
      const querySetup = setupQueryTest();
      const { auth, login } = setupAuthTest({
        querySetup,
        features: [withInactivityLogout({ inactivityTimeout: 5000 })],
      });

      // Login first
      login({ username: 'test' }, { accessToken: 'token', refreshToken: 'refresh' });
      expect(auth.isAuthenticated()).toBe(true);

      auth.features.inactivityLogout.enable();

      document.dispatchEvent(new MouseEvent('mousedown'));
      vi.advanceTimersByTime(1200); // past the throttleTime(1000) window
      TestBed.tick();

      vi.advanceTimersByTime(5500);
      TestBed.tick();

      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.sessionEndCause()).toBe('inactivity');

      querySetup.httpTesting.verify();
    });

    it('should logout after the timeout without a single activity event', () => {
      const querySetup = setupQueryTest();
      const { auth, login } = setupAuthTest({
        querySetup,
        features: [withInactivityLogout({ inactivityTimeout: 5000 })],
      });

      login({ username: 'test' }, { accessToken: 'token', refreshToken: 'refresh' });

      vi.advanceTimersByTime(5500);
      TestBed.tick();

      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.sessionEndCause()).toBe('inactivity');

      querySetup.httpTesting.verify();
    });

    it('should track mouse activity', () => {
      const querySetup = setupQueryTest();
      const { auth, login } = setupAuthTest({
        querySetup,
        features: [withInactivityLogout({ inactivityTimeout: 5000 })],
      });

      login({ username: 'test' }, { accessToken: 'token', refreshToken: 'refresh' });

      vi.advanceTimersByTime(3000);
      TestBed.tick();

      document.dispatchEvent(new MouseEvent('mousedown'));
      TestBed.tick();

      // Past the original deadline, but only 4000 into the one the click set.
      vi.advanceTimersByTime(4000);
      TestBed.tick();

      expect(auth.isAuthenticated()).toBe(true);

      querySetup.httpTesting.verify();
    });

    it('should track keyboard activity', () => {
      const querySetup = setupQueryTest();
      const { auth, login } = setupAuthTest({
        querySetup,
        features: [withInactivityLogout({ inactivityTimeout: 5000 })],
      });

      login({ username: 'test' }, { accessToken: 'token', refreshToken: 'refresh' });

      vi.advanceTimersByTime(3000);
      TestBed.tick();

      document.dispatchEvent(new KeyboardEvent('keydown'));
      TestBed.tick();

      vi.advanceTimersByTime(4000);
      TestBed.tick();

      expect(auth.isAuthenticated()).toBe(true);

      querySetup.httpTesting.verify();
    });

    it('should postpone the logout itself on resetTimer, not just the reported countdown', () => {
      const querySetup = setupQueryTest();
      const { auth, login } = setupAuthTest({
        querySetup,
        features: [withInactivityLogout({ inactivityTimeout: 5000 })],
      });

      login({ username: 'test' }, { accessToken: 'token', refreshToken: 'refresh' });

      vi.advanceTimersByTime(4000);
      TestBed.tick();

      auth.features.inactivityLogout.resetTimer();
      TestBed.tick();

      vi.advanceTimersByTime(4000);
      TestBed.tick();

      expect(auth.isAuthenticated()).toBe(true);

      vi.advanceTimersByTime(1500);
      TestBed.tick();

      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.sessionEndCause()).toBe('inactivity');

      querySetup.httpTesting.verify();
    });

    it('should not count a token refresh as user activity', () => {
      const querySetup = setupQueryTest();
      const { auth, login, refresh } = setupAuthTest({
        querySetup,
        features: [withInactivityLogout({ inactivityTimeout: 5000 })],
      });

      login({ username: 'test' }, { accessToken: 'token', refreshToken: 'refresh' });

      vi.advanceTimersByTime(4000);
      TestBed.tick();

      refresh('refresh', { accessToken: 'token-2', refreshToken: 'refresh-2' });

      vi.advanceTimersByTime(1500);
      TestBed.tick();

      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.sessionEndCause()).toBe('inactivity');

      querySetup.httpTesting.verify();
    });

    it('should use custom activity events', () => {
      const querySetup = setupQueryTest();
      const { auth, login } = setupAuthTest({
        querySetup,
        features: [withInactivityLogout({ inactivityTimeout: 5000, activityEvents: ['click'] })],
      });

      login({ username: 'test' }, { accessToken: 'token', refreshToken: 'refresh' });

      vi.advanceTimersByTime(3000);
      TestBed.tick();

      document.dispatchEvent(new MouseEvent('click'));
      TestBed.tick();

      vi.advanceTimersByTime(4000);
      TestBed.tick();

      expect(auth.isAuthenticated()).toBe(true);

      // A tracked event of its own is the only thing that counts - the defaults are replaced, not extended.
      document.dispatchEvent(new MouseEvent('mousedown'));
      TestBed.tick();

      vi.advanceTimersByTime(1500);
      TestBed.tick();

      expect(auth.isAuthenticated()).toBe(false);

      querySetup.httpTesting.verify();
    });

    it('should use custom activity check function', () => {
      const customCheck = vi.fn().mockReturnValue(true);
      const querySetup = setupQueryTest();
      const { auth, login } = setupAuthTest({
        querySetup,
        features: [withInactivityLogout({ inactivityTimeout: 5000, customActivityCheck: customCheck })],
      });

      login({ username: 'test' }, { accessToken: 'token', refreshToken: 'refresh' });

      vi.advanceTimersByTime(6000);
      TestBed.tick();

      expect(customCheck).toHaveBeenCalled();
      expect(auth.isAuthenticated()).toBe(true);

      customCheck.mockReturnValue(false);

      vi.advanceTimersByTime(6000);
      TestBed.tick();

      expect(auth.isAuthenticated()).toBe(false);

      querySetup.httpTesting.verify();
    });

    it('should not track when disabled', () => {
      const querySetup = setupQueryTest();
      const { auth, login } = setupAuthTest({
        querySetup,
        features: [withInactivityLogout({ inactivityTimeout: 5000 })],
      });

      login({ username: 'test' }, { accessToken: 'token', refreshToken: 'refresh' });

      auth.features.inactivityLogout.disable();

      vi.advanceTimersByTime(6000);
      TestBed.tick();

      expect(auth.isAuthenticated()).toBe(true);

      querySetup.httpTesting.verify();
    });
  });

  describe('idleness across tabs', () => {
    const channelName = 'ethlete-auth-sync:test-auth';

    let bus: ReturnType<typeof installFakeBroadcastChannel>;

    beforeEach(() => {
      // `queueMicrotask` is left real: the fake bus delivers on it, and faking it would mean pumping
      // the timer API to move a message between tabs.
      vi.useRealTimers();
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
      bus = installFakeBroadcastChannel();
    });

    afterEach(() => {
      bus.restore();
    });

    const setup = () => {
      const querySetup = setupQueryTest();
      const authTest = setupAuthTest({
        querySetup,
        features: [withBearerAuthMultiTabSync(), withInactivityLogout({ inactivityTimeout: 5000 })],
      });

      return { querySetup, ...authTest };
    };

    it('tells the other tabs about local activity', () => {
      const { querySetup, login } = setup();

      login({ username: 'test' }, { accessToken: 'token', refreshToken: 'refresh' });

      document.dispatchEvent(new MouseEvent('mousedown'));
      TestBed.tick();

      expect(bus.posted.filter((message) => (message.data as { type: string }).type === 'activity')).toHaveLength(1);

      querySetup.httpTesting.verify();
    });

    it('keeps this tab logged in while another tab is being used', async () => {
      const { querySetup, auth, login } = setup();
      const otherTab = new BroadcastChannel(channelName);

      login({ username: 'test' }, { accessToken: 'token', refreshToken: 'refresh' });

      vi.advanceTimersByTime(4000);
      TestBed.tick();

      otherTab.postMessage({ type: 'activity' });
      await Promise.resolve();
      TestBed.tick();

      vi.advanceTimersByTime(4000);
      TestBed.tick();

      expect(auth.isAuthenticated()).toBe(true);

      vi.advanceTimersByTime(1500);
      TestBed.tick();

      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.sessionEndCause()).toBe('inactivity');

      otherTab.close();
      querySetup.httpTesting.verify();
    });

    it('does not echo another tab’s activity back at it', async () => {
      const { querySetup, login } = setup();
      const otherTab = new BroadcastChannel(channelName);

      login({ username: 'test' }, { accessToken: 'token', refreshToken: 'refresh' });

      otherTab.postMessage({ type: 'activity' });
      await Promise.resolve();
      TestBed.tick();

      expect(bus.posted.filter((message) => (message.data as { type: string }).type === 'activity')).toHaveLength(1);

      otherTab.close();
      querySetup.httpTesting.verify();
    });
  });
});
