import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TimetrackRequest, TimetrackTransport } from '../transport/ports';
import { GoogleCalendarCredentials } from './client';
import { GoogleCalendar, fetchGoogleCalendarList$ } from './calendars';

const CREDENTIALS: GoogleCalendarCredentials = { accessToken: 'ya29.token' };

const listTransport = (items: unknown[]) => {
  const requests: TimetrackRequest[] = [];
  const transport: TimetrackTransport = {
    request$: vi.fn((request: TimetrackRequest) => {
      requests.push(request);

      return of({ status: 200, headers: {}, body: { items } }) as never;
    }),
  };

  return { transport, requests };
};

const collect = (transport: TimetrackTransport) => {
  const seen = vi.fn();

  fetchGoogleCalendarList$({ transport, credentials: CREDENTIALS }).subscribe(seen);

  return (seen.mock.calls[0]?.[0] ?? []) as GoogleCalendar[];
};

describe('fetchGoogleCalendarList$', () => {
  it('reads the account calendar list', () => {
    const { transport, requests } = listTransport([]);

    collect(transport);

    expect(requests[0]?.url).toContain('/users/me/calendarList');
  });

  it('normalizes a calendar, preferring the name the user gave it', () => {
    const { transport } = listTransport([
      {
        id: 'trb@braune-digital.com',
        summary: 'trb@braune-digital.com',
        summaryOverride: 'Work',
        primary: true,
        selected: true,
        accessRole: 'owner',
      },
    ]);

    expect(collect(transport)).toEqual([{ id: 'trb@braune-digital.com', name: 'Work' }]);
  });

  it('falls back to the id for a calendar with no name', () => {
    const { transport } = listTransport([{ id: 'team' }]);

    expect(collect(transport)).toEqual([{ id: 'team', name: 'team' }]);
  });

  it('drops a deleted calendar and one with no id', () => {
    const { transport } = listTransport([{ id: 'gone', summary: 'Gone', deleted: true }, { summary: 'Nameless' }]);

    expect(collect(transport)).toEqual([]);
  });
});
