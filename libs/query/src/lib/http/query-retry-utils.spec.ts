import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { createDefaultRetryFn, shouldRetryRequest } from './query-retry-utils';

const makeError = (status: number, error: unknown = null, headers?: Record<string, string>) =>
  new HttpErrorResponse({ status, error, headers: new HttpHeaders(headers ?? {}) });

describe('shouldRetryRequest', () => {
  let randomSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // The middle of the jitter band, so the delay is exactly the exponential one.
    randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => randomSpy.mockRestore());

  it('should retry a connection failure, but not past the attempt ceiling', () => {
    expect(shouldRetryRequest({ retryCount: 1, error: makeError(0) }).retry).toBe(true);
    expect(shouldRetryRequest({ retryCount: 3, error: makeError(0) }).retry).toBe(true);
    expect(shouldRetryRequest({ retryCount: 4, error: makeError(0) }).retry).toBe(false);
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
    const result = shouldRetryRequest({ retryCount: 0, error: makeError(429, null, { 'retry-after': '20' }) });
    expect(result).toEqual({ retry: true, delay: 20_000 });
  });

  it('should cap a retry-after the server asked for', () => {
    const result = shouldRetryRequest({ retryCount: 0, error: makeError(429, null, { 'retry-after': '3600' }) });
    expect(result).toEqual({ retry: true, delay: 30_000 });
  });

  it('should not retry on other 4xx errors', () => {
    expect(shouldRetryRequest({ retryCount: 0, error: makeError(400) }).retry).toBe(false);
    expect(shouldRetryRequest({ retryCount: 0, error: makeError(401) }).retry).toBe(false);
    expect(shouldRetryRequest({ retryCount: 0, error: makeError(404) }).retry).toBe(false);
  });

  it('should not retry something that is not an http error', () => {
    expect(shouldRetryRequest({ retryCount: 0, error: new TypeError('boom') as never }).retry).toBe(false);
  });

  it('should accept a bare HttpErrorResponse (retryCount defaults to 0)', () => {
    const result = shouldRetryRequest(makeError(0));
    expect(result.retry).toBe(true);
  });

  it('should double the delay per retry, capped at 30s', () => {
    const delayAt = (retryCount: number) => {
      const result = shouldRetryRequest({ retryCount, error: makeError(503) });
      return result.retry ? result.delay : null;
    };

    expect(delayAt(1)).toBe(2000);
    expect(delayAt(2)).toBe(4000);
    expect(delayAt(3)).toBe(8000);
  });
});

describe('createDefaultRetryFn', () => {
  it('should spread the delay over the jitter band', () => {
    const retryFn = createDefaultRetryFn();
    const delays = new Set<number>();

    for (let i = 0; i < 50; i++) {
      const result = retryFn({ retryCount: 3, error: makeError(503) });

      if (!result.retry) throw new Error('expected a retry');

      delays.add(result.delay);
      expect(result.delay).toBeGreaterThanOrEqual(6000);
      expect(result.delay).toBeLessThanOrEqual(10_000);
    }

    expect(delays.size).toBeGreaterThan(1);
  });

  it('should take an exact backoff without jitter', () => {
    const retryFn = createDefaultRetryFn({ jitter: 0 });

    expect(retryFn({ retryCount: 1, error: makeError(503) })).toEqual({ retry: true, delay: 2000 });
    expect(retryFn({ retryCount: 2, error: makeError(503) })).toEqual({ retry: true, delay: 4000 });
  });

  it('should retry indefinitely with maxAttempts 0', () => {
    const retryFn = createDefaultRetryFn({ maxAttempts: 0, jitter: 0 });

    expect(retryFn({ retryCount: 500, error: makeError(503) })).toEqual({ retry: true, delay: 30_000 });
  });

  it('should honour a custom ceiling, base delay and cap', () => {
    const retryFn = createDefaultRetryFn({ maxAttempts: 1, baseDelayMs: 100, maxDelayMs: 150, jitter: 0 });

    expect(retryFn({ retryCount: 1, error: makeError(503) })).toEqual({ retry: true, delay: 150 });
    expect(retryFn({ retryCount: 2, error: makeError(503) })).toEqual({ retry: false });
  });

  it('should replace the retryable statuses rather than add to them', () => {
    const retryFn = createDefaultRetryFn({ retryableStatusCodes: [409], jitter: 0 });

    expect(retryFn({ retryCount: 1, error: makeError(409) })).toEqual({ retry: true, delay: 2000 });
    expect(retryFn({ retryCount: 1, error: makeError(503) })).toEqual({ retry: false });
    expect(retryFn({ retryCount: 1, error: makeError(0) })).toEqual({ retry: false });
  });

  it('should never retry a Pagerfanta page past the end of a collection', () => {
    const outOfRange = {
      class: 'Pagerfanta\\Exception\\OutOfRangeCurrentPageException',
      detail: 'Page "9999" does not exist.',
      status: 503,
      title: 'An error occurred',
      trace: [],
      type: 'https://tools.ietf.org/html/rfc2616#section-10',
    };

    expect(createDefaultRetryFn()({ retryCount: 1, error: makeError(503, outOfRange) })).toEqual({ retry: false });
  });
});
