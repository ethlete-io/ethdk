import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { ShouldRetryRequestFn, withDefaultRetry } from '../index';
import { useScenario } from './harness';

const isStatus = (status: number) => (entry: { error: unknown }) =>
  entry.error instanceof HttpErrorResponse && entry.error.status === status;

describe('retryState after the automatic retries are exhausted', () => {
  const scenario = useScenario({
    clientOptions: { keepUnusedFor: 0 },
    clientFeatures: [withDefaultRetry({ maxAttempts: 2, baseDelayMs: 100, jitter: 0 })],
  });

  it('still offers a manual retry for a transient failure', () => {
    const s = scenario();
    s.api.on('GET', '/down', () => ({ status: 503, body: { message: 'down' } }));

    const getDown = s.get<{ response: unknown }>('/down');
    const c = s.consumer();
    const query = c.run(() => getDown());

    for (const delay of [0, 200, 400]) {
      s.tick(delay);
      s.tick(1);
    }

    expect(s.api.requestCount('GET', '/down')).toBe(3);
    expect(query.error()?.retryState.retry).toBe(true);

    s.expectError(isStatus(503));
    c.destroy();
  });

  it('offers no manual retry for a failure a retry cannot fix', () => {
    const s = scenario();
    s.api.on('GET', '/missing', () => ({ status: 404, body: { message: 'missing' } }));

    const getMissing = s.get<{ response: unknown }>('/missing');
    const c = s.consumer();
    const query = c.run(() => getMissing());

    s.flush();

    expect(s.api.requestCount('GET', '/missing')).toBe(1);
    expect(query.error()?.retryState).toEqual({ retry: false });

    s.expectError(isStatus(404));
    c.destroy();
  });

  it('hands a custom policy the real number of retries spent', () => {
    const s = scenario();
    s.api.on('GET', '/counted', () => ({ status: 503, body: { message: 'down' } }));

    const seen: number[] = [];
    const retryFn: ShouldRetryRequestFn = ({ retryCount }) => {
      seen.push(retryCount);

      return retryCount <= 2 ? { retry: true, delay: 10 } : { retry: false };
    };

    const getCounted = s.get<{ response: unknown }>('/counted').clone({ retryFn });
    const c = s.consumer();
    const query = c.run(() => getCounted());

    s.flush();

    expect(s.api.requestCount('GET', '/counted')).toBe(3);
    expect(seen.slice(0, 3)).toEqual([1, 2, 3]);
    expect(query.error()?.retryState.retry).toBe(true);

    s.expectError(isStatus(503));
    c.destroy();
  });
});

describe('retryState without a retry feature', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('offers a manual retry for a transient failure it never retried', () => {
    const s = scenario();
    s.api.on('GET', '/down', () => ({ status: 503, body: { message: 'down' } }));

    const getDown = s.get<{ response: unknown }>('/down');
    const c = s.consumer();
    const query = c.run(() => getDown());

    s.flush();

    expect(s.api.requestCount('GET', '/down')).toBe(1);
    expect(query.error()?.retryState.retry).toBe(true);

    s.expectError(isStatus(503));
    c.destroy();
  });

  it('offers no manual retry for a POST', () => {
    const s = scenario();
    s.api.on('POST', '/orders', () => ({ status: 503, body: { message: 'down' } }));

    const createOrder = s.post<{ response: unknown; body: { id: string } }>('/orders');
    const c = s.consumer();
    const query = c.run(() => createOrder());

    c.run(() => query.execute({ args: { body: { id: '1' } } }));
    s.flush();

    expect(query.error()?.code).toBe(503);
    expect(query.error()?.retryState).toEqual({ retry: false });

    s.expectError(isStatus(503));
    c.destroy();
  });
});
