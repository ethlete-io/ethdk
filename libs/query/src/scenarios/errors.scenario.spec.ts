import { HttpBackend, HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { withDefaultRetry, withEthleteApiErrors, withHtmlErrorParsing, withSymfonyErrors } from '../index';
import { createScenario, sequence, useScenario } from './harness';

// Error parsers and the default retry policy are installed process-wide (see apps/docs/query/errors.md), not
// per client - `registerQueryErrorParser` / `setDefaultQueryRetryFn` are module-level singletons that are
// never reset between tests in this file. Describe blocks below are ordered so that the one asserting the
// unparsed / no-retry baseline runs first, before any later block opts a client into a feature that would
// otherwise leak into it.

describe('baseline error normalization (no client features)', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('normalizes a 500 with a JSON { message } body into the documented QueryErrorResponse shape', () => {
    const s = scenario();
    s.api.on('GET', '/broken', () => ({ status: 500, body: { message: 'Internal error occurred' } }));

    const getBroken = s.get<{ response: unknown }>('/broken');
    const c = s.consumer();
    const query = c.run(() => getBroken());

    s.tick();

    expect(query.response()).toBeNull();
    const error = query.error();
    expect(error?.isList).toBe(false);
    expect(error && !error.isList ? error.error.message : null).toBe('Internal error occurred');
    expect(error?.code).toBe(500);
    expect(error?.raw).toBeInstanceOf(HttpErrorResponse);
    expect(error?.retryState).toEqual({ retry: false });

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);
    c.destroy();
  });

  it('clears error() after a manual re-execute that now succeeds', () => {
    const s = scenario();
    s.api.on('GET', '/flaky-once', sequence([{ status: 500, body: { message: 'temporary' } }, { body: { ok: true } }]));

    const getFlakyOnce = s.get<{ response: { ok: boolean } }>('/flaky-once');
    const c = s.consumer();
    const query = c.run(() => getFlakyOnce());

    s.tick();

    expect(query.error()?.code).toBe(500);
    expect(query.response()).toBeNull();

    c.run(() => query.execute());
    s.tick();

    expect(query.response()).toEqual({ ok: true });
    expect(query.error()).toBeNull();

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);
    c.destroy();
  });
});

describe('connection failures (status 0)', () => {
  it('sets error() and clears loading() on a network failure', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });

    // The fake API's `on()` handler always answers through `HttpResponse` / `HttpErrorResponse` with an
    // explicit status, and its own delivery path only treats a status >= 400 as an error (see
    // `fake-api.ts` `handle()`), so a status of `0` - a real connection failure - can never be produced
    // through it. Worked around here with a dedicated `HttpBackend` that fails the way a dropped
    // connection does, bypassing the fake API for this one scenario. Reported as a harness gap.
    //
    // Also runs before every other describe in this file: `withDefaultRetry`'s retry function is a
    // process-wide singleton (see the file header), and status 0 is retryable by default - a scenario
    // built after `the default retry policy` block below would inherit its leftover retry function and
    // retry this failure instead of surfacing it once.
    const failingBackend: HttpBackend = {
      handle: () =>
        new Observable((subscriber) => {
          const timer = setTimeout(
            () =>
              subscriber.error(
                new HttpErrorResponse({ status: 0, statusText: 'Unknown Error', url: 'https://api.test/offline' }),
              ),
            0,
          );

          return () => clearTimeout(timer);
        }),
    };

    const scenario = createScenario({
      clientOptions: { keepUnusedFor: 0 },
      providers: [{ provide: HttpBackend, useValue: failingBackend }],
    });

    const s = scenario();
    const getOffline = s.get<{ response: unknown }>('/offline');
    const c = s.consumer();
    const query = c.run(() => getOffline());

    s.tick();

    expect(query.response()).toBeNull();
    expect(query.loading()).toBeNull();
    expect(query.error()?.code).toBe(0);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 0);

    c.destroy();
    s.destroy();

    vi.useRealTimers();
  });
});

describe('HTML error pages (withHtmlErrorParsing)', () => {
  const scenario = useScenario({
    clientOptions: { keepUnusedFor: 0 },
    clientFeatures: [withHtmlErrorParsing()],
  });

  it('parses the readable text out of an HTML error page', () => {
    const s = scenario();
    s.api.on('GET', '/proxy-down', () => ({
      status: 502,
      body: '<h1>Service Unavailable</h1><p>The server is currently restarting.</p>',
    }));

    const getProxyDown = s.get<{ response: unknown }>('/proxy-down');
    const c = s.consumer();
    const query = c.run(() => getProxyDown());

    s.tick();

    const error = query.error();
    expect(error?.isList).toBe(false);
    expect(error && !error.isList ? error.error.message : null).toBe(
      'Service Unavailable: The server is currently restarting.',
    );
    expect(error?.code).toBe(502);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 502);
    c.destroy();
  });
});

describe('Symfony violations (withSymfonyErrors)', () => {
  const scenario = useScenario({
    clientOptions: { keepUnusedFor: 0 },
    clientFeatures: [withSymfonyErrors()],
  });

  it('turns a Symfony violation list into the documented QueryErrorResponse violation list', () => {
    const s = scenario();
    s.api.on('POST', '/users', () => ({
      status: 422,
      body: {
        violations: [
          { message: 'This value should not be blank.', propertyPath: 'email', invalidValue: null },
          { message: 'This value is too short.', propertyPath: 'name', invalidValue: 'Al' },
        ],
      },
    }));

    const createUser = s.post<{ response: unknown; body: { email: string; name: string } }>('/users');
    const c = s.consumer();
    const query = c.run(() => createUser());
    c.run(() => query.execute({ args: { body: { email: '', name: 'Al' } } }));

    s.tick();

    const error = query.error();
    expect(error?.isList).toBe(true);
    expect(error && error.isList ? error.errors.map((e) => e.message) : null).toEqual([
      'This value should not be blank.',
      'This value is too short.',
    ]);
    expect(error?.code).toBe(422);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 422);
    c.destroy();
  });
});

describe('withEthleteApiErrors (html + symfony + retry in one feature)', () => {
  const scenario = useScenario({
    clientOptions: { keepUnusedFor: 0 },
    clientFeatures: [withEthleteApiErrors()],
  });

  it('parses a Symfony violation payload and retries a 503, both from the single feature', () => {
    const s = scenario();
    s.api.on('POST', '/orders', () => ({
      status: 422,
      body: { violations: [{ message: 'Quantity must be positive.', propertyPath: 'quantity', invalidValue: -1 }] },
    }));
    s.api.on('GET', '/reports', () => ({ status: 503, body: { message: 'unavailable' } }));

    const createOrder = s.post<{ response: unknown; body: { quantity: number } }>('/orders');
    const getReports = s.get<{ response: unknown }>('/reports');

    const a = s.consumer();
    const orderQuery = a.run(() => createOrder());
    a.run(() => orderQuery.execute({ args: { body: { quantity: -1 } } }));

    const b = s.consumer();
    const reportsQuery = b.run(() => getReports());

    s.tick();

    const orderError = orderQuery.error();
    expect(orderError?.isList).toBe(false);
    expect(orderError && !orderError.isList ? orderError.error.message : null).toBe('Quantity must be positive.');

    expect(reportsQuery.error()).toBeNull();
    expect(reportsQuery.response()).toBeNull();
    expect(reportsQuery.loading()).not.toBeNull();

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 422);

    a.destroy();
    b.destroy();
  });
});

describe('the default retry policy (withDefaultRetry)', () => {
  const scenario = useScenario({
    clientOptions: { keepUnusedFor: 0 },
    clientFeatures: [withDefaultRetry({ jitter: 0 })],
  });

  it('retries a 503 with the documented exponential backoff (2s, 4s, 8s) and recovers on success', () => {
    const s = scenario();
    s.api.on(
      'GET',
      '/flaky-retry',
      sequence([{ status: 503 }, { status: 503 }, { status: 503 }, { body: { ok: true } }]),
    );

    const getFlakyRetry = s.get<{ response: { ok: boolean } }>('/flaky-retry');
    const c = s.consumer();
    const query = c.run(() => getFlakyRetry());

    // Each stage below advances by the retry policy's own backoff delay, then ticks 1ms further: the
    // attempt sent at the end of the big tick answers through its own 0ms-delay fake-API response timer,
    // scheduled (mid-`advanceTimersByTime`) for exactly the clock value that call is advancing to - and a
    // timer newly created at exactly that boundary is not re-examined within the same `advanceTimersByTime`
    // call, only a later one. The 1ms flush is what crosses that boundary and lets the *next* backoff get
    // scheduled from the response it unblocks.
    s.tick();
    s.tick(1);
    expect(s.api.requestCount('GET', '/flaky-retry')).toBe(1);
    expect(query.response()).toBeNull();

    s.tick(2000);
    s.tick(1);
    expect(s.api.requestCount('GET', '/flaky-retry')).toBe(2);

    s.tick(4000);
    s.tick(1);
    expect(s.api.requestCount('GET', '/flaky-retry')).toBe(3);

    s.tick(8000);
    s.tick(1);
    expect(s.api.requestCount('GET', '/flaky-retry')).toBe(4);
    expect(query.response()).toEqual({ ok: true });
    expect(query.error()).toBeNull();

    c.destroy();
  });

  it('does not retry a 400', () => {
    const s = scenario();
    s.api.on('GET', '/bad-request', () => ({ status: 400, body: { message: 'Bad input' } }));

    const getBadRequest = s.get<{ response: unknown }>('/bad-request');
    const c = s.consumer();
    const query = c.run(() => getBadRequest());

    s.tick();

    expect(query.error()?.code).toBe(400);
    expect(query.error()?.retryState).toEqual({ retry: false });
    expect(s.api.requestCount('GET', '/bad-request')).toBe(1);

    s.tick(30_000);
    expect(s.api.requestCount('GET', '/bad-request')).toBe(1);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    c.destroy();
  });

  it('stops retrying after the documented maximum (3) and surfaces the final error', () => {
    const s = scenario();
    s.api.on('GET', '/always-503', () => ({ status: 503, body: { message: 'down' } }));

    const getAlways503 = s.get<{ response: unknown }>('/always-503');
    const c = s.consumer();
    const query = c.run(() => getAlways503());

    s.tick();
    s.tick(1);
    s.tick(2000);
    s.tick(1);
    s.tick(4000);
    s.tick(1);
    s.tick(8000);
    s.tick(1);

    expect(s.api.requestCount('GET', '/always-503')).toBe(4);
    expect(query.error()?.code).toBe(503);
    expect(query.error()?.retryState).toEqual({ retry: false });

    s.tick(30_000);
    expect(s.api.requestCount('GET', '/always-503')).toBe(4);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 503);
    c.destroy();
  });

  it('cancels the in-flight retry timer when the consumer is destroyed mid-backoff', () => {
    const s = scenario();
    s.api.on('GET', '/always-503-b', () => ({ status: 503, body: { message: 'down' } }));

    const getAlways503 = s.get<{ response: unknown }>('/always-503-b');
    const c = s.consumer();
    c.run(() => getAlways503());

    s.tick();
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    c.destroy();

    // Angular's change detection scheduler arms a zero-delay timer after the last signal write; only
    // the retry timer is under test here.
    s.tick(1);

    expect(vi.getTimerCount()).toBe(0);
    expect(s.api.pending().length).toBe(0);
  });
});
