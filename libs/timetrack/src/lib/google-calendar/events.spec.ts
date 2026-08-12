import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { CalendarOccurrenceEvent } from '../model/event';
import { TimetrackRequest, TimetrackTransport } from '../transport/ports';
import { GoogleCalendarCredentials } from './client';
import { GoogleCalendarEventResource, fetchGoogleCalendarEvents$ } from './events';

const CREDENTIALS: GoogleCalendarCredentials = { accessToken: 'ya29.token' };

const eventTransport = (pages: { items: unknown[]; nextPageToken?: string }[]) => {
  const requests: TimetrackRequest[] = [];
  let page = 0;
  const transport: TimetrackTransport = {
    request$: vi.fn((request: TimetrackRequest) => {
      requests.push(request);
      const body = pages[page] ?? { items: [] };
      page += 1;

      return of({ status: 200, headers: {}, body }) as never;
    }),
  };

  return { transport, requests };
};

const events$ = (transport: TimetrackTransport, calendarId?: string) =>
  fetchGoogleCalendarEvents$({
    transport,
    credentials: CREDENTIALS,
    calendarId,
    from: new Date(2026, 7, 11, 0, 0),
    to: new Date(2026, 7, 12, 0, 0),
  });

const collect = (transport: TimetrackTransport, calendarId?: string) => {
  const seen = vi.fn();

  events$(transport, calendarId).subscribe(seen);

  return (seen.mock.calls[0]?.[0] ?? []) as CalendarOccurrenceEvent[];
};

const MEETING: GoogleCalendarEventResource = {
  id: 'evt1',
  status: 'confirmed',
  summary: 'Sprint Planning',
  start: { dateTime: '2026-08-11T10:00:00+02:00' },
  end: { dateTime: '2026-08-11T11:00:00+02:00' },
  attendees: [{ self: true, responseStatus: 'accepted' }, { responseStatus: 'accepted' }],
  conferenceData: {
    entryPoints: [
      { entryPointType: 'more', uri: 'https://tel.meet/x' },
      { entryPointType: 'video', uri: 'https://meet.google.com/abc-defg-hij' },
    ],
  },
};

describe('fetchGoogleCalendarEvents$', () => {
  it('expands recurring series over the window on the primary calendar', () => {
    const { transport, requests } = eventTransport([{ items: [] }]);

    events$(transport).subscribe();

    expect(requests[0]?.url).toContain('/calendars/primary/events');
    expect(requests[0]?.url).toContain('singleEvents=true');
    expect(requests[0]?.url).toContain('orderBy=startTime');
    expect(requests[0]?.url).toContain(`timeMin=${encodeURIComponent(new Date(2026, 7, 11).toISOString())}`);
    expect(requests[0]?.headers?.['authorization']).toBe('Bearer ya29.token');
  });

  it('escapes a calendar id, which is an email address', () => {
    const { transport, requests } = eventTransport([{ items: [] }]);

    events$(transport, 'trb@braune-digital.com').subscribe();

    expect(requests[0]?.url).toContain('/calendars/trb%40braune-digital.com/events');
  });

  it('normalizes a meeting, taking the video entry point as the conference url', () => {
    const { transport } = eventTransport([{ items: [MEETING] }]);

    expect(collect(transport)).toEqual([
      {
        at: new Date('2026-08-11T10:00:00+02:00'),
        source: 'calendar',
        kind: 'calendar-event',
        until: new Date('2026-08-11T11:00:00+02:00'),
        title: 'Sprint Planning',
        accepted: true,
        conferenceUrl: 'https://meet.google.com/abc-defg-hij',
      },
    ]);
  });

  it('falls back to the legacy hangout link', () => {
    const { transport } = eventTransport([
      { items: [{ ...MEETING, conferenceData: undefined, hangoutLink: 'https://meet.google.com/zzz-yyyy-xxx' }] },
    ]);

    expect(collect(transport)[0]?.conferenceUrl).toBe('https://meet.google.com/zzz-yyyy-xxx');
  });

  it('drops an all-day event, which would otherwise claim the whole day', () => {
    const { transport } = eventTransport([
      { items: [{ ...MEETING, start: { date: '2026-08-11' }, end: { date: '2026-08-12' }, summary: 'Urlaub' }] },
    ]);

    expect(collect(transport)).toEqual([]);
  });

  it('drops a cancelled occurrence of a recurring series', () => {
    const { transport } = eventTransport([{ items: [{ ...MEETING, status: 'cancelled' }] }]);

    expect(collect(transport)).toEqual([]);
  });

  it('drops an event the user marked as free', () => {
    const { transport } = eventTransport([{ items: [{ ...MEETING, transparency: 'transparent' }] }]);

    expect(collect(transport)).toEqual([]);
  });

  it('drops an event the user declined', () => {
    const { transport } = eventTransport([
      { items: [{ ...MEETING, attendees: [{ self: true, responseStatus: 'declined' }] }] },
    ]);

    expect(collect(transport)).toEqual([]);
  });

  it('drops working location, birthday and out-of-office entries but keeps focus time', () => {
    const { transport } = eventTransport([
      {
        items: [
          { ...MEETING, eventType: 'workingLocation' },
          { ...MEETING, eventType: 'birthday' },
          { ...MEETING, eventType: 'outOfOffice' },
          { ...MEETING, eventType: 'focusTime', summary: 'Deep work' },
        ],
      },
    ]);

    expect(collect(transport).map((event) => event.title)).toEqual(['Deep work']);
  });

  it('drops an event that ends before it starts', () => {
    const { transport } = eventTransport([{ items: [{ ...MEETING, end: { dateTime: '2026-08-11T09:00:00+02:00' } }] }]);

    expect(collect(transport)).toEqual([]);
  });

  it('treats an event with no attendees as the user own accepted time', () => {
    const { transport } = eventTransport([{ items: [{ ...MEETING, attendees: undefined }] }]);

    expect(collect(transport)[0]?.accepted).toBe(true);
  });

  it('treats an invitation with no self attendee as unanswered', () => {
    const { transport } = eventTransport([{ items: [{ ...MEETING, attendees: [{ responseStatus: 'accepted' }] }] }]);

    expect(collect(transport)[0]?.accepted).toBe(false);
  });

  it('treats a tentative response as unanswered rather than dropping it', () => {
    const { transport } = eventTransport([
      { items: [{ ...MEETING, attendees: [{ self: true, responseStatus: 'tentative' }] }] },
    ]);

    expect(collect(transport)[0]?.accepted).toBe(false);
  });

  it('names an untitled event rather than proposing an empty description', () => {
    const { transport } = eventTransport([{ items: [{ ...MEETING, summary: '  ' }] }]);

    expect(collect(transport)[0]?.title).toBe('untitled event');
  });

  it('follows the page token and returns the occurrences in order', () => {
    const later = {
      ...MEETING,
      id: 'evt2',
      summary: 'Retro',
      start: { dateTime: '2026-08-11T14:00:00+02:00' },
      end: { dateTime: '2026-08-11T15:00:00+02:00' },
    };
    const { transport, requests } = eventTransport([{ items: [later], nextPageToken: 'page-2' }, { items: [MEETING] }]);

    expect(collect(transport).map((event) => event.title)).toEqual(['Sprint Planning', 'Retro']);
    expect(requests[1]?.url).toContain('pageToken=page-2');
  });
});
