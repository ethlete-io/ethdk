import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TimetrackTransport } from '../transport/ports';
import { GoogleCalendarCredentials, GoogleCalendarRequestError, googleCalendarRequest$ } from './client';

const CREDENTIALS: GoogleCalendarCredentials = { accessToken: 'ya29.token' };

const failing = (status: number, body: unknown = {}) =>
  ({ request$: vi.fn(() => of({ status, headers: {}, body }) as never) }) satisfies TimetrackTransport;

const request$ = (transport: TimetrackTransport) =>
  googleCalendarRequest$({ transport, credentials: CREDENTIALS, path: '/calendars/primary/events', describe: 'today' });

const errorFrom = (transport: TimetrackTransport) => {
  const failed = vi.fn();

  request$(transport).subscribe({ error: failed });

  return failed.mock.calls[0]?.[0] as GoogleCalendarRequestError;
};

const quotaBody = (reason: string) => ({ error: { errors: [{ reason }] } });

describe('googleCalendarRequest$', () => {
  afterEach(() => vi.useRealTimers());
  it('sends the bearer token and asks for json', () => {
    const transport = failing(200);

    request$(transport).subscribe();

    expect(transport.request$).toHaveBeenCalledWith({
      method: 'GET',
      url: 'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      headers: { authorization: 'Bearer ya29.token', accept: 'application/json' },
    });
  });

  it('reports an expired token as something the host has to refresh', () => {
    expect(errorFrom(failing(401)).message).toContain('needs refreshing');
  });

  it('reads google reason out of the error body', () => {
    const error = errorFrom(failing(403, quotaBody('insufficientPermissions')));

    expect(error.reason).toBe('insufficientPermissions');
    expect(error.rateLimited).toBe(false);
    expect(error.message).toContain('granted scopes');
  });

  it('recognises a quota breach dressed as a 403', () => {
    vi.useFakeTimers();

    const failed = vi.fn();

    request$(failing(403, quotaBody('rateLimitExceeded'))).subscribe({ error: failed });
    vi.runAllTimers();

    const error = failed.mock.calls[0]?.[0] as GoogleCalendarRequestError;

    expect(error.rateLimited).toBe(true);
    expect(error.message).toContain('rate-limited');
  });

  it('recognises a plain 429 with no error body', () => {
    vi.useFakeTimers();

    const failed = vi.fn();

    request$(failing(429)).subscribe({ error: failed });
    vi.runAllTimers();

    expect((failed.mock.calls[0]?.[0] as GoogleCalendarRequestError).rateLimited).toBe(true);
  });

  describe('on a rate limit', () => {
    const answering = (...responses: { status: number; headers?: Record<string, string>; body?: unknown }[]) => {
      let call = 0;

      return {
        request$: vi.fn(() => {
          const response = responses[Math.min(call++, responses.length - 1)];

          return of({ headers: {}, body: {}, ...response }) as never;
        }),
      } satisfies TimetrackTransport;
    };

    it('asks again after the wait Google named, and answers with what follows', () => {
      vi.useFakeTimers();

      const transport = answering({ status: 429, headers: { 'Retry-After': '3' } }, { status: 200, body: 'ok' });
      const seen = vi.fn();

      request$(transport).subscribe(seen);
      vi.advanceTimersByTime(2_999);

      expect(seen).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);

      expect(seen).toHaveBeenCalledWith('ok');
      expect(transport.request$).toHaveBeenCalledTimes(2);
    });

    it('gives up after a bounded number of retries', () => {
      vi.useFakeTimers();

      const transport = answering({ status: 403, body: quotaBody('userRateLimitExceeded') });
      const failed = vi.fn();

      request$(transport).subscribe({ error: failed });
      vi.runAllTimers();

      expect(failed).toHaveBeenCalledTimes(1);
      expect(transport.request$).toHaveBeenCalledTimes(3);
    });

    it('never retries a refusal that is not a rate limit', () => {
      const transport = answering({ status: 403, body: quotaBody('insufficientPermissions') });

      request$(transport).subscribe({ error: vi.fn() });

      expect(transport.request$).toHaveBeenCalledTimes(1);
    });
  });
});
