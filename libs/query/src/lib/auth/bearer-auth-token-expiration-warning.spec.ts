import { TestBed } from '@angular/core/testing';
import { setupAuthTest, setupQueryTest } from '@ethlete/query/testing';
import { withTokenExpirationWarning } from './bearer-auth-token-expiration-warning';

describe('bearer-auth-token-expiration-warning', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('TokenExpirationWarningFeature', () => {
    it('should return a token expiration warning feature builder', () => {
      const feature = withTokenExpirationWarning();
      expect(feature._type).toBe('tokenExpirationWarning');
      expect(feature.config).toBeDefined();
      expect(feature.setup).toBeDefined();
    });

    it('should calculate expiresAt from bearer data', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const querySetup = setupQueryTest();
      const { auth } = setupAuthTest({
        querySetup,
        features: [withTokenExpirationWarning()],
        bearerDecryptFn: () => ({ exp: futureExp, userId: 123 }),
        multiTabSync: false,
      });

      // Initially no token
      expect(auth.features.tokenExpirationWarning.expiresAt()).toBeNull();

      // Login
      auth.queries.login.execute({ body: { username: 'test' } });
      querySetup.httpTesting.expectOne(`${querySetup.baseUrl}/auth/login`).flush({
        accessToken: 'token',
        refreshToken: 'refresh',
      });
      TestBed.tick();

      // Should have expiration date
      const expiresAt = auth.features.tokenExpirationWarning.expiresAt();
      expect(expiresAt).toBeInstanceOf(Date);
      expect(expiresAt?.getTime()).toBe(futureExp * 1000);

      querySetup.httpTesting.verify();
    });

    it('should calculate expiresIn from bearer data', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const querySetup = setupQueryTest();
      const { auth } = setupAuthTest({
        querySetup,
        features: [withTokenExpirationWarning({ checkInterval: 100 })],
        bearerDecryptFn: () => ({ exp: futureExp, userId: 123 }),
        multiTabSync: false,
      });

      // Login
      auth.queries.login.execute({ body: { username: 'test' } });
      querySetup.httpTesting.expectOne(`${querySetup.baseUrl}/auth/login`).flush({
        accessToken: 'token',
        refreshToken: 'refresh',
      });
      TestBed.tick();

      // Wait for interval to emit
      vi.advanceTimersByTime(150);
      TestBed.tick();

      // Should have time until expiration
      const expiresIn = auth.features.tokenExpirationWarning.expiresIn();
      expect(expiresIn).toBeGreaterThan(0);
      expect(expiresIn).toBeLessThanOrEqual(3600 * 1000);

      querySetup.httpTesting.verify();
    });

    it('should update expiresIn as time passes', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 60; // 1 minute from now
      const querySetup = setupQueryTest();
      const { auth } = setupAuthTest({
        querySetup,
        features: [withTokenExpirationWarning({ checkInterval: 100 })],
        bearerDecryptFn: () => ({ exp: futureExp, userId: 123 }),
        multiTabSync: false,
        autoRetryOn401: false,
      });

      // Login
      auth.queries.login.execute({ body: { username: 'test' } });
      querySetup.httpTesting.expectOne(`${querySetup.baseUrl}/auth/login`).flush({
        accessToken: 'token',
        refreshToken: 'refresh',
      });
      TestBed.tick();

      // Wait for initial interval
      vi.advanceTimersByTime(150);
      TestBed.tick();

      const initialExpiresIn = auth.features.tokenExpirationWarning.expiresIn();

      // Advance time
      vi.advanceTimersByTime(1000); // 1 second
      TestBed.tick();

      const laterExpiresIn = auth.features.tokenExpirationWarning.expiresIn();

      // expiresIn should decrease
      expect(initialExpiresIn).toBeDefined();
      expect(laterExpiresIn).toBeLessThan(initialExpiresIn as number);

      // Flush any pending auto-refresh requests
      const pending = querySetup.httpTesting.match(`${querySetup.baseUrl}/auth/refresh`);
      pending.forEach((req) => req.flush({ accessToken: 'new-token', refreshToken: 'new-refresh' }));

      querySetup.httpTesting.verify();
    });

    it('should detect when token is expiring soon', () => {
      // Token expires in 4 minutes (less than default 5 minute warning)
      const futureExp = Math.floor(Date.now() / 1000) + 4 * 60;
      const querySetup = setupQueryTest();
      const { auth } = setupAuthTest({
        querySetup,
        features: [withTokenExpirationWarning({ checkInterval: 100 })],
        bearerDecryptFn: () => ({ exp: futureExp, userId: 123 }),
        multiTabSync: false,
        autoRetryOn401: false,
      });

      // Login
      auth.queries.login.execute({ body: { username: 'test' } });
      querySetup.httpTesting.expectOne(`${querySetup.baseUrl}/auth/login`).flush({
        accessToken: 'token',
        refreshToken: 'refresh',
      });
      TestBed.tick();

      // Wait for interval
      vi.advanceTimersByTime(150);
      TestBed.tick();

      // Should be expiring soon (4 minutes < 5 minute default threshold)
      expect(auth.features.tokenExpirationWarning.isExpiringSoon()).toBe(true);

      // Flush any pending auto-refresh requests
      const pending = querySetup.httpTesting.match(`${querySetup.baseUrl}/auth/refresh`);
      pending.forEach((req) => req.flush({ accessToken: 'new-token', refreshToken: 'new-refresh' }));

      querySetup.httpTesting.verify();
    });

    it('should not warn if token has plenty of time', () => {
      // Token expires in 10 minutes (more than default 5 minute warning)
      const futureExp = Math.floor(Date.now() / 1000) + 10 * 60;
      const querySetup = setupQueryTest();
      const { auth } = setupAuthTest({
        querySetup,
        features: [withTokenExpirationWarning({ checkInterval: 100 })],
        bearerDecryptFn: () => ({ exp: futureExp, userId: 123 }),
        multiTabSync: false,
        autoRetryOn401: false,
      });

      // Login
      auth.queries.login.execute({ body: { username: 'test' } });
      querySetup.httpTesting.expectOne(`${querySetup.baseUrl}/auth/login`).flush({
        accessToken: 'token',
        refreshToken: 'refresh',
      });
      TestBed.tick();

      // Wait for interval
      vi.advanceTimersByTime(150);
      TestBed.tick();

      // Should not be expiring soon
      expect(auth.features.tokenExpirationWarning.isExpiringSoon()).toBe(false);

      querySetup.httpTesting.verify();
    });

    it('should use custom warning threshold', () => {
      // Token expires in 2 minutes
      const futureExp = Math.floor(Date.now() / 1000) + 2 * 60;
      const querySetup = setupQueryTest();
      const { auth } = setupAuthTest({
        querySetup,
        features: [withTokenExpirationWarning({ warningThreshold: 1 * 60 * 1000, checkInterval: 100 })], // 1 minute threshold
        bearerDecryptFn: () => ({ exp: futureExp, userId: 123 }),
        multiTabSync: false,
        autoRetryOn401: false,
      });

      // Login
      auth.queries.login.execute({ body: { username: 'test' } });
      querySetup.httpTesting.expectOne(`${querySetup.baseUrl}/auth/login`).flush({
        accessToken: 'token',
        refreshToken: 'refresh',
      });
      TestBed.tick();

      // Wait for interval
      vi.advanceTimersByTime(150);
      TestBed.tick();

      // Should NOT be expiring soon (2 minutes > 1 minute threshold)
      expect(auth.features.tokenExpirationWarning.isExpiringSoon()).toBe(false);

      // Flush any pending auto-refresh requests
      const pending = querySetup.httpTesting.match(`${querySetup.baseUrl}/auth/refresh`);
      pending.forEach((req) => req.flush({ accessToken: 'new-token', refreshToken: 'new-refresh' }));

      querySetup.httpTesting.verify();
    });

    it('should return null values when no token', () => {
      const querySetup = setupQueryTest();
      const { auth } = setupAuthTest({
        querySetup,
        features: [withTokenExpirationWarning({ checkInterval: 100 })],
        multiTabSync: false,
        autoRetryOn401: false,
      });

      // Wait for interval
      vi.advanceTimersByTime(150);
      TestBed.tick();

      // No token, should return null values
      expect(auth.features.tokenExpirationWarning.expiresAt()).toBeNull();
      expect(auth.features.tokenExpirationWarning.expiresIn()).toBeNull();
      expect(auth.features.tokenExpirationWarning.isExpiringSoon()).toBe(false);

      querySetup.httpTesting.verify();
    });
  });
});
