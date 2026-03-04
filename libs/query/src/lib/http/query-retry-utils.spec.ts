import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { shouldRetryRequest } from './query-retry-utils';

const makeError = (status: number, error: unknown = null, headers?: Record<string, string>) =>
  new HttpErrorResponse({ status, error, headers: new HttpHeaders(headers ?? {}) });

describe('shouldRetryRequest', () => {
  it('should retry on status 0 regardless of retry count', () => {
    const result = shouldRetryRequest({ retryCount: 10, error: makeError(0) });
    expect(result.retry).toBe(true);
  });

  it('should not retry after more than 3 retries', () => {
    const result = shouldRetryRequest({ retryCount: 4, error: makeError(503) });
    expect(result.retry).toBe(false);
  });

  it('should retry on 5xx errors (501+)', () => {
    expect(shouldRetryRequest({ retryCount: 0, error: makeError(502) }).retry).toBe(true);
    expect(shouldRetryRequest({ retryCount: 0, error: makeError(503) }).retry).toBe(true);
  });

  it('should not retry on 500', () => {
    expect(shouldRetryRequest({ retryCount: 0, error: makeError(500) }).retry).toBe(false);
  });

  it('should retry on 408 and 425', () => {
    expect(shouldRetryRequest({ retryCount: 0, error: makeError(408) }).retry).toBe(true);
    expect(shouldRetryRequest({ retryCount: 0, error: makeError(425) }).retry).toBe(true);
  });

  it('should retry on 429 with default delay when no retry-after header', () => {
    const result = shouldRetryRequest({ retryCount: 0, error: makeError(429) });
    expect(result.retry).toBe(true);
    if (result.retry) expect(result.delay).toBeGreaterThan(0);
  });

  it('should use retry-after header delay for 429', () => {
    const result = shouldRetryRequest({ retryCount: 0, error: makeError(429, null, { 'retry-after': '30' }) });
    expect(result).toEqual({ retry: true, delay: 30_000 });
  });

  it('should not retry on other 4xx errors', () => {
    expect(shouldRetryRequest({ retryCount: 0, error: makeError(400) }).retry).toBe(false);
    expect(shouldRetryRequest({ retryCount: 0, error: makeError(401) }).retry).toBe(false);
    expect(shouldRetryRequest({ retryCount: 0, error: makeError(404) }).retry).toBe(false);
  });

  it('should accept a bare HttpErrorResponse (retryCount defaults to 0)', () => {
    const result = shouldRetryRequest(makeError(0));
    expect(result.retry).toBe(true);
  });

  it('should clamp retry delay between 1000ms and 5000ms', () => {
    const result = shouldRetryRequest({ retryCount: 0, error: makeError(503) });
    expect(result.retry).toBe(true);
    if (result.retry) {
      expect(result.delay).toBeGreaterThanOrEqual(1000);
      expect(result.delay).toBeLessThanOrEqual(5000);
    }
  });
});
