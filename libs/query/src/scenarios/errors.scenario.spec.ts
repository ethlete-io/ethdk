import { HttpBackend, HttpErrorResponse, HttpEventType, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDefaultRetryFn,
  isHtmlErrorPayload,
  registerQueryErrorParser,
  setDefaultQueryRetryFn,
  withDefaultRetry,
  withEthleteApiErrors,
  withErrorHandling,
  withHtmlErrorParsing,
  withPolling,
  withSymfonyErrors,
  withSuccessHandling,
} from '../index';
import { createScenario, sequence, useScenario } from './harness';

// Error parsers are installed process-wide (see apps/docs/query/errors.md), not per client -
// `registerQueryErrorParser` is a module-level singleton that is never reset between tests in this file.
// Describe blocks below are ordered so that the one asserting the unparsed baseline runs first, before any
// later block opts a client into a parser that would otherwise leak into it.

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

  it('normalizes a { detail } body without any client feature', () => {
    const s = scenario();
    s.api.on('GET', '/detail-body', () => ({ status: 400, body: { detail: 'The report is no longer available.' } }));

    const getDetailBody = s.get<{ response: unknown }>('/detail-body');
    const c = s.consumer();
    const query = c.run(() => getDetailBody());

    s.tick();

    const error = query.error();
    expect(error?.isList).toBe(false);
    expect(error && !error.isList ? error.error.message : null).toBe('The report is no longer available.');

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    c.destroy();
  });

  it('normalizes a plain string error body into a single message', () => {
    const s = scenario();
    s.api.on('GET', '/string-body', () => ({ status: 400, body: 'The report is no longer available.' }));

    const getStringBody = s.get<{ response: unknown }>('/string-body');
    const c = s.consumer();
    const query = c.run(() => getStringBody());

    s.tick();

    const error = query.error();
    expect(error?.isList).toBe(false);
    expect(error && !error.isList ? error.error.message : null).toBe('The report is no longer available.');

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    c.destroy();
  });

  it('normalizes a string array error body into the documented violation list', () => {
    const s = scenario();
    s.api.on('GET', '/string-array-body', () => ({
      status: 400,
      body: ['Email is required.', 'Name is too short.'],
    }));

    const getStringArrayBody = s.get<{ response: unknown }>('/string-array-body');
    const c = s.consumer();
    const query = c.run(() => getStringArrayBody());

    s.tick();

    const error = query.error();
    expect(error?.isList).toBe(true);
    expect(error && error.isList ? error.errors.map((item) => item.message) : null).toEqual([
      'Email is required.',
      'Name is too short.',
    ]);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    c.destroy();
  });

  it('sends a retryable 503 exactly once without the default retry feature', () => {
    const s = scenario();
    s.api.on('GET', '/unretried-503', () => ({ status: 503, body: { message: 'down' } }));

    const getUnretried = s.get<{ response: unknown }>('/unretried-503');
    const c = s.consumer();
    const query = c.run(() => getUnretried());

    s.tick();

    expect(query.error()?.retryState).toEqual({ retry: false });
    expect(s.api.requestCount('GET', '/unretried-503')).toBe(1);

    s.tick(30_000);
    expect(s.api.requestCount('GET', '/unretried-503')).toBe(1);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 503);
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

  it('turns a bare violation array into the documented violation list', () => {
    const s = scenario();
    s.api.on('POST', '/bare-violations', () => ({
      status: 422,
      body: [
        { message: 'This value should not be blank.', propertyPath: 'email', invalidValue: null },
        { message: 'This value is too short.', propertyPath: 'name', invalidValue: 'Al' },
      ],
    }));

    const createBare = s.post<{ response: unknown; body: Record<string, never> }>('/bare-violations');
    const c = s.consumer();
    const query = c.run(() => createBare());
    c.run(() => query.execute({ args: { body: {} } }));

    s.tick();

    const error = query.error();
    expect(error?.isList).toBe(true);
    expect(error && error.isList ? error.errors.map((item) => item.message) : null).toEqual([
      'This value should not be blank.',
      'This value is too short.',
    ]);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 422);
    c.destroy();
  });

  it('turns a class-validator { message: [] } body into a violation list', () => {
    const s = scenario();
    s.api.on('POST', '/class-validator', () => ({
      status: 400,
      body: { statusCode: 400, error: 'Bad Request', message: ['email must be an email', 'name should not be empty'] },
    }));

    const createClassValidated = s.post<{ response: unknown; body: Record<string, never> }>('/class-validator');
    const c = s.consumer();
    const query = c.run(() => createClassValidated());
    c.run(() => query.execute({ args: { body: {} } }));

    s.tick();

    const error = query.error();
    expect(error?.isList).toBe(true);
    expect(error && error.isList ? error.errors.map((item) => item.message) : null).toEqual([
      'email must be an email',
      'name should not be empty',
    ]);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
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

  it('parses an HTML error page from the single withEthleteApiErrors feature', () => {
    const s = scenario();
    s.api.on('GET', '/gateway', () => ({
      status: 400,
      body: '<h1>Bad Gateway</h1><p>The upstream did not answer.</p>',
    }));

    const getGateway = s.get<{ response: unknown }>('/gateway');
    const c = s.consumer();
    const query = c.run(() => getGateway());

    s.tick();

    const error = query.error();
    expect(error && !error.isList ? error.error.message : null).toBe('Bad Gateway: The upstream did not answer.');

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    c.destroy();
  });
});

// Placed after the blocks whose clients install the symfony and html parsers: this client declares no
// error feature at all, so anything it parses beyond the baseline ladder came from another client.
describe('error parsers are installed process-wide, not per client', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('lets a second client see the parser the first client installed', () => {
    const s = scenario();
    s.api.on('POST', '/other-client-violations', () => ({
      status: 422,
      body: {
        violations: [
          { message: 'This value should not be blank.', propertyPath: 'email' },
          { message: 'This value is too short.', propertyPath: 'name' },
        ],
      },
    }));

    const createOnOtherClient = s.post<{ response: unknown; body: Record<string, never> }>('/other-client-violations');
    const c = s.consumer();
    const query = c.run(() => createOnOtherClient());
    c.run(() => query.execute({ args: { body: {} } }));

    s.tick();

    const error = query.error();
    expect(error?.isList).toBe(true);
    expect(error && error.isList ? error.errors.map((item) => item.message) : null).toEqual([
      'This value should not be blank.',
      'This value is too short.',
    ]);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 422);
    c.destroy();
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

  it('does not retry a 500', () => {
    const s = scenario();
    s.api.on('GET', '/internal-error', () => ({ status: 500, body: { message: 'boom' } }));

    const getInternalError = s.get<{ response: unknown }>('/internal-error');
    const c = s.consumer();
    const query = c.run(() => getInternalError());

    s.tick();

    expect(query.error()?.code).toBe(500);
    expect(query.error()?.retryState).toEqual({ retry: false });
    expect(s.api.requestCount('GET', '/internal-error')).toBe(1);

    s.tick(30_000);
    expect(s.api.requestCount('GET', '/internal-error')).toBe(1);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);
    c.destroy();
  });

  it('retries a 408, a 425 and a 429 (no retry-after header) using the default backoff', () => {
    const s = scenario();
    s.api.on('GET', '/timeout', sequence([{ status: 408 }, { body: { ok: true } }]));
    s.api.on('GET', '/too-early', sequence([{ status: 425 }, { body: { ok: true } }]));
    s.api.on('GET', '/rate-limited-plain', sequence([{ status: 429 }, { body: { ok: true } }]));

    const getTimeout = s.get<{ response: { ok: boolean } }>('/timeout');
    const getTooEarly = s.get<{ response: { ok: boolean } }>('/too-early');
    const getRateLimited = s.get<{ response: { ok: boolean } }>('/rate-limited-plain');

    const a = s.consumer();
    const b = s.consumer();
    const d = s.consumer();
    const timeoutQuery = a.run(() => getTimeout());
    const tooEarlyQuery = b.run(() => getTooEarly());
    const rateLimitedQuery = d.run(() => getRateLimited());

    s.tick();
    s.tick(1);
    expect(s.api.requestCount('GET', '/timeout')).toBe(1);
    expect(s.api.requestCount('GET', '/too-early')).toBe(1);
    expect(s.api.requestCount('GET', '/rate-limited-plain')).toBe(1);

    s.tick(2000);
    s.tick(1);

    expect(s.api.requestCount('GET', '/timeout')).toBe(2);
    expect(s.api.requestCount('GET', '/too-early')).toBe(2);
    expect(s.api.requestCount('GET', '/rate-limited-plain')).toBe(2);
    expect(timeoutQuery.response()).toEqual({ ok: true });
    expect(tooEarlyQuery.response()).toEqual({ ok: true });
    expect(rateLimitedQuery.response()).toEqual({ ok: true });

    a.destroy();
    b.destroy();
    d.destroy();
  });

  it('honors a retry-after header in seconds for a 429, ahead of the exponential backoff', () => {
    const s = scenario();
    s.api.on(
      'GET',
      '/rate-limited-after',
      sequence([{ status: 429, headers: { 'retry-after': '5' } }, { body: { ok: true } }]),
    );

    const getRateLimitedAfter = s.get<{ response: { ok: boolean } }>('/rate-limited-after');
    const c = s.consumer();
    const query = c.run(() => getRateLimitedAfter());

    s.tick();
    s.tick(1);

    // The default backoff's first delay is 2000ms - flushing past it and its own boundary tick without
    // a second request proves the header (5000ms), not the exponential schedule, is driving the wait.
    s.tick(2000);
    s.tick(1);
    expect(s.api.requestCount('GET', '/rate-limited-after')).toBe(1);

    s.tick(3000);
    s.tick(1);
    expect(s.api.requestCount('GET', '/rate-limited-after')).toBe(2);
    expect(query.response()).toEqual({ ok: true });

    c.destroy();
  });

  it('honors an x-retry-after header the same way', () => {
    const s = scenario();
    s.api.on(
      'GET',
      '/rate-limited-x',
      sequence([{ status: 429, headers: { 'x-retry-after': '3' } }, { body: { ok: true } }]),
    );

    const getRateLimitedX = s.get<{ response: { ok: boolean } }>('/rate-limited-x');
    const c = s.consumer();
    const query = c.run(() => getRateLimitedX());

    s.tick();
    s.tick(1);

    s.tick(2000);
    s.tick(1);
    expect(s.api.requestCount('GET', '/rate-limited-x')).toBe(1);

    s.tick(1000);
    s.tick(1);
    expect(s.api.requestCount('GET', '/rate-limited-x')).toBe(2);
    expect(query.response()).toEqual({ ok: true });

    c.destroy();
  });

  it('caps a retry-after delay at the documented maximum (30s)', () => {
    const s = scenario();
    s.api.on(
      'GET',
      '/rate-limited-huge',
      sequence([{ status: 429, headers: { 'retry-after': '999999' } }, { body: { ok: true } }]),
    );

    const getRateLimitedHuge = s.get<{ response: { ok: boolean } }>('/rate-limited-huge');
    const c = s.consumer();
    const query = c.run(() => getRateLimitedHuge());

    s.tick();
    s.tick(1);

    s.tick(30_000);
    s.tick(1);
    expect(s.api.requestCount('GET', '/rate-limited-huge')).toBe(2);
    expect(query.response()).toEqual({ ok: true });

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

describe('connection failures are retried by the default policy', () => {
  it('retries a status-0 network failure and recovers', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });

    let attempt = 0;
    const flakyOfflineBackend: HttpBackend = {
      handle: () =>
        new Observable((subscriber) => {
          const timer = setTimeout(() => {
            attempt++;

            if (attempt === 1) {
              subscriber.error(
                new HttpErrorResponse({
                  status: 0,
                  statusText: 'Unknown Error',
                  url: 'https://api.test/offline-retry',
                }),
              );
              return;
            }

            subscriber.next(
              new HttpResponse({ status: 200, url: 'https://api.test/offline-retry', body: { ok: true } }),
            );
            subscriber.complete();
          }, 0);

          return () => clearTimeout(timer);
        }),
    };

    const scenario = createScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [withDefaultRetry({ jitter: 0 })],
      providers: [{ provide: HttpBackend, useValue: flakyOfflineBackend }],
    });

    const s = scenario();
    const getOfflineRetry = s.get<{ response: { ok: boolean } }>('/offline-retry');
    const c = s.consumer();
    const query = c.run(() => getOfflineRetry());

    s.tick();
    s.tick(1);
    expect(query.response()).toBeNull();

    s.tick(2000);
    s.tick(1);

    expect(query.response()).toEqual({ ok: true });
    expect(query.error()).toBeNull();

    c.destroy();
    s.destroy();

    vi.useRealTimers();
  });
});

describe('an unlimited default retry policy', () => {
  const scenario = useScenario({
    clientOptions: { keepUnusedFor: 0 },
    clientFeatures: [withDefaultRetry({ jitter: 0, maxAttempts: 0 })],
  });

  it('keeps a retryable request loading beyond the normal attempt limit', () => {
    const s = scenario();
    s.api.on('GET', '/retry-forever', () => ({ status: 503, body: { message: 'down' } }));

    const getRetryForever = s.get<{ response: unknown }>('/retry-forever');
    const c = s.consumer();
    const query = c.run(() => getRetryForever());

    for (const delay of [0, 2_000, 4_000, 8_000, 16_000]) {
      s.tick(delay);
      s.tick(1);
    }

    expect(s.api.requestCount('GET', '/retry-forever')).toBe(5);
    expect(query.loading()).not.toBeNull();
    expect(query.error()).toBeNull();
    expect(query.executionState()?.type).toBe('loading');

    c.destroy();
    s.tick(1);
  });
});

describe('custom error parsers (registerQueryErrorParser)', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  // `registerQueryErrorParser` installs process-wide and is never reset (see the file header), so both
  // parsers below only ever act on a body carrying this file's own marker field - never on another
  // scenario file's response shapes, past or future.
  it('lets a custom parser ahead of the built-in ladder shape error(), and a null result fall through to the next one', () => {
    const s = scenario();

    registerQueryErrorParser((detail) =>
      typeof detail === 'object' && !!detail && 'errorsSpecMarker' in detail && detail.errorsSpecMarker === 'first'
        ? ['handled by the first parser']
        : null,
    );
    registerQueryErrorParser((detail) =>
      typeof detail === 'object' && !!detail && 'errorsSpecMarker' in detail && detail.errorsSpecMarker === 'second'
        ? ['handled by the second parser']
        : null,
    );

    s.api.on('GET', '/custom-parser-first', () => ({ status: 400, body: { errorsSpecMarker: 'first' } }));
    s.api.on('GET', '/custom-parser-second', () => ({ status: 400, body: { errorsSpecMarker: 'second' } }));

    const getFirst = s.get<{ response: unknown }>('/custom-parser-first');
    const getSecond = s.get<{ response: unknown }>('/custom-parser-second');

    const a = s.consumer();
    const b = s.consumer();
    const firstQuery = a.run(() => getFirst());
    const secondQuery = b.run(() => getSecond());

    s.tick();

    const firstError = firstQuery.error();
    expect(firstError?.isList).toBe(false);
    expect(firstError && !firstError.isList ? firstError.error.message : null).toBe('handled by the first parser');

    // The first parser returns null for this body (marker is 'second', not 'first'), so it falls
    // through to the second - proving a null result passes the body on rather than ending the search.
    const secondError = secondQuery.error();
    expect(secondError?.isList).toBe(false);
    expect(secondError && !secondError.isList ? secondError.error.message : null).toBe('handled by the second parser');

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);

    a.destroy();
    b.destroy();
  });
});

describe('HTML error parsing edge cases (withHtmlErrorParsing)', () => {
  const scenario = useScenario({
    clientOptions: { keepUnusedFor: 0 },
    clientFeatures: [withHtmlErrorParsing()],
  });

  it('falls back to <title> when the page has no heading', () => {
    const s = scenario();
    s.api.on('GET', '/html-title-fallback', () => ({
      status: 400,
      body: '<html><head><title>Site Down</title></head><body><p>Try again soon.</p></body></html>',
    }));

    const getPage = s.get<{ response: unknown }>('/html-title-fallback');
    const c = s.consumer();
    const query = c.run(() => getPage());

    s.tick();

    const error = query.error();
    expect(error && !error.isList ? error.error.message : null).toBe('Site Down: Try again soon.');

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    c.destroy();
  });

  it('excludes <script> and <style> content from the extracted message', () => {
    const s = scenario();
    s.api.on('GET', '/html-noise', () => ({
      status: 400,
      body:
        '<style>.foo{color:red}</style><h1>Maintenance</h1><script>doEvilThings()</script>' +
        '<p>We are updating things.</p>',
    }));

    const getPage = s.get<{ response: unknown }>('/html-noise');
    const c = s.consumer();
    const query = c.run(() => getPage());

    s.tick();

    const error = query.error();
    const message = error && !error.isList ? error.error.message : null;
    expect(message).toBe('Maintenance: We are updating things.');
    expect(message).not.toContain('doEvilThings');
    expect(message).not.toContain('color:red');

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    c.destroy();
  });

  it('caps the extracted message at 300 characters', () => {
    const s = scenario();
    const longSentence = 'a'.repeat(400);
    s.api.on('GET', '/html-too-long', () => ({ status: 400, body: `<p>${longSentence}</p>` }));

    const getPage = s.get<{ response: unknown }>('/html-too-long');
    const c = s.consumer();
    const query = c.run(() => getPage());

    s.tick();

    const error = query.error();
    const message = error && !error.isList ? error.error.message : null;
    expect(message?.length).toBeLessThanOrEqual(300);
    expect(message?.endsWith('…')).toBe(true);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    c.destroy();
  });

  it("parses the { error, text } wrapper Angular's XHR backend produces for a mis-parsed body", () => {
    const s = scenario();
    s.api.on('GET', '/html-wrapper', () => ({
      status: 400,
      body: { error: new Error('Unexpected token <'), text: '<h1>Bad Gateway</h1><p>Try later.</p>' },
    }));

    const getPage = s.get<{ response: unknown }>('/html-wrapper');
    const c = s.consumer();
    const query = c.run(() => getPage());

    s.tick();

    const error = query.error();
    expect(error && !error.isList ? error.error.message : null).toBe('Bad Gateway: Try later.');

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    c.destroy();
  });

  it('does not repeat the heading when the first paragraph only restates it', () => {
    const s = scenario();
    s.api.on('GET', '/html-restated', () => ({
      status: 400,
      body:
        '<h1>Service Temporarily Unavailable</h1><p>Service Temporarily Unavailable</p>' +
        '<p>The server is currently restarting.</p>',
    }));

    const getPage = s.get<{ response: unknown }>('/html-restated');
    const c = s.consumer();
    const query = c.run(() => getPage());

    s.tick();

    const error = query.error();
    expect(error && !error.isList ? error.error.message : null).toBe(
      'Service Temporarily Unavailable: The server is currently restarting.',
    );

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    c.destroy();
  });

  it('falls back to the flattened page text for a page with neither heading nor paragraph', () => {
    const s = scenario();
    s.api.on('GET', '/html-unstructured', () => ({
      status: 400,
      body: '<div><span>The gateway</span> is having a bad day.</div>',
    }));

    const getPage = s.get<{ response: unknown }>('/html-unstructured');
    const c = s.consumer();
    const query = c.run(() => getPage());

    s.tick();

    const error = query.error();
    expect(error && !error.isList ? error.error.message : null).toBe('The gateway is having a bad day.');

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    c.destroy();
  });

  it('decodes entities and drops tags from the extracted message', () => {
    const s = scenario();
    s.api.on('GET', '/html-entities', () => ({
      status: 400,
      body: '<h1>Ops &amp; Support</h1><p>The &lt;b&gt;server&lt;/b&gt; is down &mdash; try later.</p>',
    }));

    const getPage = s.get<{ response: unknown }>('/html-entities');
    const c = s.consumer();
    const query = c.run(() => getPage());

    s.tick();

    const error = query.error();
    expect(error && !error.isList ? error.error.message : null).toBe(
      'Ops & Support: The <b>server</b> is down - try later.',
    );

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    c.destroy();
  });

  it('keeps the HttpErrorResponse message when the page has no readable text', () => {
    const s = scenario();
    s.api.on('GET', '/html-blank', () => ({ status: 400, body: '<div>   </div>' }));

    const getPage = s.get<{ response: unknown }>('/html-blank');
    const c = s.consumer();
    const query = c.run(() => getPage());

    s.tick();

    const error = query.error();
    const message = error && !error.isList ? error.error.message : null;
    expect(message).toBe(error?.raw.message);
    expect(message).toContain('Http failure response');

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    c.destroy();
  });

  it('leaves a plain message containing a stray < untouched', () => {
    const s = scenario();
    s.api.on('GET', '/stray-angle-bracket', () => ({ status: 400, body: 'Quantity must be < 100 and > 0.' }));

    expect(isHtmlErrorPayload('Quantity must be < 100 and > 0.')).toBe(false);
    expect(isHtmlErrorPayload('Line one<br>line two')).toBe(false);

    const getPage = s.get<{ response: unknown }>('/stray-angle-bracket');
    const c = s.consumer();
    const query = c.run(() => getPage());

    s.tick();

    const error = query.error();
    expect(error && !error.isList ? error.error.message : null).toBe('Quantity must be < 100 and > 0.');

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    c.destroy();
  });
});

describe('a transformResponse that throws', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  type TransformArgs = { response: { name: string }; rawResponse: { data?: { name: string } } };

  it('a throwing transformResponse fails the query and does not run success handlers', () => {
    const s = scenario();
    s.api.on('GET', '/transform', sequence([{ body: { data: { name: 'ok' } } }, { body: {} }]));

    const getTransformed = s.get<TransformArgs>('/transform', {
      transformResponse: (raw) => {
        if (!raw.data) throw new Error('unmappable response');

        return raw.data;
      },
    });

    const handled: unknown[] = [];
    const c = s.consumer();
    const query = c.run(() => getTransformed(withSuccessHandling<TransformArgs>({ handler: (r) => handled.push(r) })));

    s.tick();
    expect(handled).toEqual([{ name: 'ok' }]);

    query.execute();
    s.tick();

    expect(query.executionState()?.type).toBe('failure');
    expect(query.error()?.code).toBe(0);
    expect(handled).toEqual([{ name: 'ok' }]);

    c.destroy();
  });

  it('reports the wire response to withErrorHandling and latestHttpEvent, not the transform failure', () => {
    const s = scenario();
    s.api.on('GET', '/transform-events', () => ({ body: { unmappable: true } }));

    const getTransformed = s.get<TransformArgs>('/transform-events', {
      transformResponse: (raw) => {
        if (!raw.data) throw new Error('unmappable response');

        return raw.data;
      },
    });

    const handledErrors: unknown[] = [];
    const c = s.consumer();
    const query = c.run(() =>
      getTransformed(withErrorHandling<TransformArgs>({ handler: (error) => handledErrors.push(error) })),
    );

    s.tick();

    expect(query.executionState()?.type).toBe('failure');
    expect(query.error()?.code).toBe(0);
    expect(handledErrors).toEqual([]);

    const event = query.latestHttpEvent();
    expect(event?.type).toBe(HttpEventType.Response);
    expect((event as HttpResponse<unknown>).body).toEqual({ unmappable: true });

    c.destroy();
  });
});

describe('configuring the default retry policy', () => {
  describe('maxAttempts', () => {
    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [withDefaultRetry({ jitter: 0, maxAttempts: 5 })],
    });

    it('retries five times with maxAttempts: 5 before surfacing the error', () => {
      const s = scenario();
      s.api.on('GET', '/always-503-five', () => ({ status: 503, body: { message: 'down' } }));

      const getAlways503 = s.get<{ response: unknown }>('/always-503-five');
      const c = s.consumer();
      const query = c.run(() => getAlways503());

      // The last delay is the exponential 32000 clamped to the 30000 default `maxDelayMs`.
      for (const delay of [0, 2_000, 4_000, 8_000, 16_000, 30_000]) {
        s.tick(delay);
        s.tick(1);
      }

      expect(s.api.requestCount('GET', '/always-503-five')).toBe(6);
      expect(query.error()?.code).toBe(503);
      expect(query.error()?.retryState).toEqual({ retry: false });

      s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 503);
      c.destroy();
    });
  });

  describe('baseDelayMs', () => {
    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [withDefaultRetry({ jitter: 0, baseDelayMs: 250 })],
    });

    it('starts the backoff at twice the configured baseDelayMs', () => {
      const s = scenario();
      s.api.on('GET', '/base-delay', sequence([{ status: 503 }, { body: { ok: true } }]));

      const getBaseDelay = s.get<{ response: { ok: boolean } }>('/base-delay');
      const c = s.consumer();
      const query = c.run(() => getBaseDelay());

      s.tick();
      s.tick(1);
      expect(s.api.requestCount('GET', '/base-delay')).toBe(1);

      s.tick(400);
      expect(s.api.requestCount('GET', '/base-delay')).toBe(1);

      s.tick(100);
      s.tick(1);
      expect(s.api.requestCount('GET', '/base-delay')).toBe(2);
      expect(query.response()).toEqual({ ok: true });

      c.destroy();
    });
  });

  describe('maxDelayMs', () => {
    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [withDefaultRetry({ jitter: 0, maxDelayMs: 3_000 })],
    });

    it('caps the exponential backoff at maxDelayMs', () => {
      const s = scenario();
      s.api.on('GET', '/capped-backoff', sequence([{ status: 503 }, { status: 503 }, { body: { ok: true } }]));

      const getCapped = s.get<{ response: { ok: boolean } }>('/capped-backoff');
      const c = s.consumer();
      const query = c.run(() => getCapped());

      s.tick();
      s.tick(1);
      s.tick(2_000);
      s.tick(1);
      expect(s.api.requestCount('GET', '/capped-backoff')).toBe(2);

      // Uncapped the second delay would be 4000.
      s.tick(2_900);
      expect(s.api.requestCount('GET', '/capped-backoff')).toBe(2);

      s.tick(100);
      s.tick(1);
      expect(s.api.requestCount('GET', '/capped-backoff')).toBe(3);
      expect(query.response()).toEqual({ ok: true });

      c.destroy();
    });
  });

  describe('retryableStatusCodes', () => {
    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [withDefaultRetry({ jitter: 0, retryableStatusCodes: [418] })],
    });

    it('retries only the statuses retryableStatusCodes names, and no longer the defaults', () => {
      const s = scenario();
      s.api.on('GET', '/teapot', sequence([{ status: 418 }, { body: { ok: true } }]));
      s.api.on('GET', '/no-longer-retried', () => ({ status: 503, body: { message: 'down' } }));

      const getTeapot = s.get<{ response: { ok: boolean } }>('/teapot');
      const getNoLongerRetried = s.get<{ response: unknown }>('/no-longer-retried');

      const a = s.consumer();
      const b = s.consumer();
      const teapotQuery = a.run(() => getTeapot());
      const droppedQuery = b.run(() => getNoLongerRetried());

      s.tick();
      s.tick(1);
      expect(droppedQuery.error()?.retryState).toEqual({ retry: false });

      s.tick(2_000);
      s.tick(1);

      expect(s.api.requestCount('GET', '/teapot')).toBe(2);
      expect(teapotQuery.response()).toEqual({ ok: true });
      expect(s.api.requestCount('GET', '/no-longer-retried')).toBe(1);

      s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 503);
      a.destroy();
      b.destroy();
    });
  });

  describe('jitter', () => {
    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [withDefaultRetry()],
    });

    it('spreads the default backoff over ±25% of its computed delay', () => {
      const s = scenario();
      s.api.on('GET', '/jitter-low', sequence([{ status: 503 }, { body: { ok: true } }]));
      s.api.on('GET', '/jitter-high', sequence([{ status: 503 }, { body: { ok: true } }]));

      const random = vi.spyOn(Math, 'random').mockReturnValue(0);

      const getLow = s.get<{ response: { ok: boolean } }>('/jitter-low');
      const a = s.consumer();
      a.run(() => getLow());

      s.tick();
      s.tick(1);

      // 0.75x of the 2000ms first delay.
      s.tick(1_400);
      expect(s.api.requestCount('GET', '/jitter-low')).toBe(1);
      s.tick(100);
      s.tick(1);
      expect(s.api.requestCount('GET', '/jitter-low')).toBe(2);

      random.mockReturnValue(1);

      const getHigh = s.get<{ response: { ok: boolean } }>('/jitter-high');
      const b = s.consumer();
      b.run(() => getHigh());

      s.tick();
      s.tick(1);

      // 1.25x of the same delay.
      s.tick(2_400);
      expect(s.api.requestCount('GET', '/jitter-high')).toBe(1);
      s.tick(100);
      s.tick(1);
      expect(s.api.requestCount('GET', '/jitter-high')).toBe(2);

      random.mockRestore();
      a.destroy();
      b.destroy();
    });
  });

  describe('a Symfony Pagerfanta out-of-range error', () => {
    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [withDefaultRetry({ jitter: 0 })],
    });

    it('does not retry a 5xx carrying a Pagerfanta out-of-range detail', () => {
      const s = scenario();
      s.api.on('GET', '/page-past-the-end', () => ({
        status: 503,
        body: {
          class: 'Pagerfanta\\Exception\\OutOfRangeCurrentPageException',
          detail: 'Page "99" does not exist. The currentPage must be inferior to "3".',
          status: 503,
          title: 'An error occurred',
          trace: [],
          type: 'https://tools.ietf.org/html/rfc2616#section-10',
        },
      }));

      const getPastTheEnd = s.get<{ response: unknown }>('/page-past-the-end');
      const c = s.consumer();
      const query = c.run(() => getPastTheEnd());

      s.tick();

      expect(query.error()?.retryState).toEqual({ retry: false });
      expect(s.api.requestCount('GET', '/page-past-the-end')).toBe(1);

      s.tick(30_000);
      expect(s.api.requestCount('GET', '/page-past-the-end')).toBe(1);

      s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 503);
      c.destroy();
    });
  });
});

describe('overriding the retry policy per client and per creator', () => {
  const scenario = useScenario({
    clientOptions: { keepUnusedFor: 0, retryFn: createDefaultRetryFn({ jitter: 0, retryableStatusCodes: [400] }) },
  });

  it('honors a retryFn given as a client option and one given through clone()', () => {
    const s = scenario();
    s.api.on('GET', '/client-retry-fn', sequence([{ status: 400 }, { body: { ok: true } }]));
    s.api.on('GET', '/creator-retry-fn', () => ({ status: 400, body: { message: 'no retry here' } }));

    const getClientRetry = s.get<{ response: { ok: boolean } }>('/client-retry-fn');
    const getCreatorRetry = s
      .get<{ response: unknown }>('/creator-retry-fn')
      .clone({ retryFn: () => ({ retry: false }) });

    const a = s.consumer();
    const b = s.consumer();
    const clientRetryQuery = a.run(() => getClientRetry());
    const creatorRetryQuery = b.run(() => getCreatorRetry());

    s.tick();
    s.tick(1);
    expect(creatorRetryQuery.error()?.retryState).toEqual({ retry: false });

    s.tick(2_000);
    s.tick(1);

    expect(s.api.requestCount('GET', '/client-retry-fn')).toBe(2);
    expect(clientRetryQuery.response()).toEqual({ ok: true });
    expect(s.api.requestCount('GET', '/creator-retry-fn')).toBe(1);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    a.destroy();
    b.destroy();
  });
});

describe('a retry nobody is waiting for is dropped', () => {
  const scenario = useScenario({
    clientOptions: { keepUnusedFor: 10_000 },
    clientFeatures: [withDefaultRetry({ jitter: 0 })],
  });

  it('keeps the last good response when a retrying consumer leaves, and re-executes for the next one', () => {
    const s = scenario();
    let failing = false;
    let version = 1;
    s.api.on('GET', '/report', () => (failing ? { status: 503, body: { message: 'down' } } : { body: { version } }));

    const getReport = s.get<{ response: { version: number } }>('/report');

    const a = s.consumer();
    const first = a.run(() => getReport());

    s.tick();
    s.tick(1);
    expect(first.response()).toEqual({ version: 1 });

    failing = true;
    a.run(() => first.execute());
    s.tick();
    s.tick(1);
    expect(s.api.requestCount('GET', '/report')).toBe(2);

    a.destroy();
    s.tick(1);
    s.tick(5_000);
    expect(s.api.requestCount('GET', '/report')).toBe(2);
    expect(s.api.pending().length).toBe(0);

    failing = false;
    version = 2;

    const b = s.consumer();
    const second = b.run(() => getReport());

    expect(second.response()).toEqual({ version: 1 });

    s.tick();
    s.tick(1);
    expect(s.api.requestCount('GET', '/report')).toBe(3);
    expect(second.response()).toEqual({ version: 2 });

    b.destroy();
    s.tick(10_001);
  });
});

describe('dev-mode misuse errors', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('throws when withPolling is used on a POST query', () => {
    const s = scenario();
    const createThing = s.post<{ response: unknown; body: Record<string, never> }>('/things');
    const c = s.consumer();

    expect(() => c.run(() => createThing(withPolling({ interval: 1_000 })))).toThrow(/withPolling/);

    c.destroy();
  });

  it('throws when a function route is created without a withArgs feature', () => {
    const s = scenario();
    const getThing = s.get<{ response: unknown; pathParams: { id: string } }>((p) => `/things/${p.id}`);
    const c = s.consumer();

    expect(() => c.run(() => getThing())).toThrow(/withArgs/);

    c.destroy();
  });
});

describe('a client that asked for no retry policy', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('does not retry a 503 and leaves retryState at { retry: false }', () => {
    const s = scenario();
    s.api.on('GET', '/unstable', () => ({ status: 503, body: { message: 'down' } }));

    const getUnstable = s.get<{ response: unknown }>('/unstable');
    const c = s.consumer();
    const query = c.run(() => getUnstable());

    s.tick();
    s.tick(30_000);

    expect(s.api.requestCount('GET', '/unstable')).toBe(1);
    expect(query.error()?.code).toBe(503);
    expect(query.error()?.retryState).toEqual({ retry: false });

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 503);
    c.destroy();
  });
});

// `setDefaultQueryRetryFn` writes a process-global with no way back to "no policy at all", so this
// describe must stay last in the file - the no-op it restores is not the same as never having called it.
describe('the process-global default retry policy (@internal escape hatch)', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  afterEach(() => setDefaultQueryRetryFn(() => ({ retry: false })));

  it('retries for a client that declared none of its own', () => {
    const s = scenario();
    setDefaultQueryRetryFn(({ retryCount }) => (retryCount <= 2 ? { retry: true, delay: 10 } : { retry: false }));

    s.api.on('GET', '/globally-retried', () => ({ status: 503, body: { message: 'down' } }));

    const getIt = s.get<{ response: unknown }>('/globally-retried');
    const c = s.consumer();
    const query = c.run(() => getIt());

    s.tick();
    s.tick(10);
    s.tick(10);
    s.tick(10);

    expect(s.api.requestCount('GET', '/globally-retried')).toBe(3);
    expect(query.error()?.code).toBe(503);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 503);
    c.destroy();
  });
});
