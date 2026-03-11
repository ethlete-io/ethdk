import { TestBed } from '@angular/core/testing';
import { QueryTestSetup, setupAuthTest, setupQueryTest } from '@ethlete/query/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
});
