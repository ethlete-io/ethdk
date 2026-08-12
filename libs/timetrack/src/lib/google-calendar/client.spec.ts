import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
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
    const error = errorFrom(failing(403, quotaBody('rateLimitExceeded')));

    expect(error.rateLimited).toBe(true);
    expect(error.message).toContain('rate-limited');
  });

  it('recognises a plain 429 with no error body', () => {
    expect(errorFrom(failing(429)).rateLimited).toBe(true);
  });
});
