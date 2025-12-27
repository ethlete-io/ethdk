import { TestBed } from '@angular/core/testing';
import { QueryTestSetup, setupAuthTest, setupQueryTest } from '@ethlete/query/testing';
import { beforeEach, describe, expect, it } from 'vitest';

describe('withRefreshQuery - Auto-retry on 401', () => {
  let setup: QueryTestSetup;

  beforeEach(() => {
    setup = setupQueryTest({ baseUrl: 'https://api.test.com', name: 'test-auth' });
  });

  it('should auto-retry a failed 401 request after successful token refresh', () => {
    const authSetup = setupAuthTest({
      querySetup: setup,
      autoRetryOn401: true,
    });

    // Step 1: Login to get initial tokens
    authSetup.login(
      { username: 'test', password: 'pass' },
      { accessToken: 'initial-access-token', refreshToken: 'refresh-token-123' },
    );

    expect(authSetup.auth.accessToken()).toBe('initial-access-token');
    expect(authSetup.auth.refreshToken()).toBe('refresh-token-123');

    // Step 2: Make a secure request that returns 401
    authSetup.makeSecureRequest('/api/secure-data');

    const secureReq1 = setup.httpTesting.expectOne('https://api.test.com/api/secure-data');
    secureReq1.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    // Wait for event stream to process the 401 and trigger auto-retry
    TestBed.flushEffects();
    TestBed.flushEffects();

    // Step 3: Auto-refresh should have been triggered - flush it
    const refreshReq = setup.httpTesting.expectOne('https://api.test.com/auth/refresh');
    refreshReq.flush({ accessToken: 'new-access-token', refreshToken: 'new-refresh-token' });
    TestBed.flushEffects();

    // Step 4: Original request should be retried automatically
    const secureReq2 = setup.httpTesting.expectOne('https://api.test.com/api/secure-data');
    secureReq2.flush({ data: 'success' });

    // Verify tokens were updated
    expect(authSetup.auth.accessToken()).toBe('new-access-token');
    expect(authSetup.auth.refreshToken()).toBe('new-refresh-token');
  });

  it('should not retry if autoRetryOn401 is disabled', () => {
    const authSetup = setupAuthTest({
      querySetup: setup,
      autoRetryOn401: false, // Disabled
    });

    // Login first
    authSetup.login(
      { username: 'test', password: 'pass' },
      { accessToken: 'access-token', refreshToken: 'refresh-token' },
    );

    // Make a secure request that fails with 401
    authSetup.makeSecureRequest('/api/secure-data');

    const secureReq = setup.httpTesting.expectOne('https://api.test.com/api/secure-data');
    secureReq.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    // Should NOT trigger auto-refresh or retry
    setup.httpTesting.expectNone('https://api.test.com/auth/refresh');
  });

  it('should not retry the same request twice to prevent infinite loops', () => {
    const authSetup = setupAuthTest({
      querySetup: setup,
      autoRetryOn401: true,
    });

    // Login first
    authSetup.login(
      { username: 'test', password: 'pass' },
      { accessToken: 'access-token', refreshToken: 'refresh-token' },
    );

    // Make a secure request that fails with 401
    authSetup.makeSecureRequest('/api/secure-data');

    const secureReq1 = setup.httpTesting.expectOne('https://api.test.com/api/secure-data');
    secureReq1.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    // Wait for event stream to process the 401
    TestBed.flushEffects();
    TestBed.flushEffects();

    // Auto-refresh should have been triggered - flush it
    const refreshReq = setup.httpTesting.expectOne('https://api.test.com/auth/refresh');
    refreshReq.flush({ accessToken: 'new-access-token', refreshToken: 'new-refresh-token' });
    TestBed.flushEffects();

    // Retry should happen once
    const secureReq2 = setup.httpTesting.expectOne('https://api.test.com/api/secure-data');

    // If this also fails with 401, should NOT trigger another refresh/retry
    secureReq2.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    // Should NOT trigger another refresh
    setup.httpTesting.expectNone('https://api.test.com/auth/refresh');
  });
});
