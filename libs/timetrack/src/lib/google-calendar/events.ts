import { Observable, map } from 'rxjs';
import { CalendarOccurrenceEvent } from '../model/event';
import { TimetrackTransport } from '../transport/ports';
import { GoogleCalendarCredentials, GoogleCalendarPagingOptions, googleCalendarPaged$ } from './client';

export type GoogleCalendarEventResource = {
  id?: string;
  status?: string;
  summary?: string;
  eventType?: string;
  transparency?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { self?: boolean; responseStatus?: string }[];
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
};

/**
 * Event types that are never worked time: where you are working from, somebody's birthday, and time
 * you marked as away. A deny-list rather than an allow-list, so a type Google adds for a real meeting
 * still reaches the day.
 */
const IGNORED_EVENT_TYPES = ['workingLocation', 'birthday', 'outOfOffice'];

const conferenceUrlOf = (resource: GoogleCalendarEventResource) => {
  const video = resource.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === 'video' && !!entry.uri);

  return video?.uri ?? resource.hangoutLink;
};

/**
 * Whether the user said yes. An event with no attendee list at all is one they created for
 * themselves, which counts as accepted; an invitation reaching them through a group alias has
 * attendees but no `self` entry, and an unanswered invitation is not a yes.
 */
const acceptedBySelf = (resource: GoogleCalendarEventResource) => {
  const attendees = resource.attendees ?? [];

  if (attendees.length === 0) return true;

  return attendees.find((attendee) => attendee.self)?.responseStatus === 'accepted';
};

const declinedBySelf = (resource: GoogleCalendarEventResource) =>
  (resource.attendees ?? []).find((attendee) => attendee.self)?.responseStatus === 'declined';

const momentOf = (value: string | undefined) => {
  if (!value) return undefined;

  const at = new Date(value);

  return Number.isNaN(at.getTime()) ? undefined : at;
};

/**
 * Normalizes one event, or drops it. Everything filtered here would otherwise claim time the user did
 * not spend: an all-day event has no clock times and would swallow the whole day (`Urlaub`, `OOO`), a
 * `transparent` event is one they explicitly marked as free, and a declined invitation is by
 * definition not where they were.
 */
const toOccurrence = (resource: GoogleCalendarEventResource): CalendarOccurrenceEvent | undefined => {
  const at = momentOf(resource.start?.dateTime);
  const until = momentOf(resource.end?.dateTime);

  if (!at || !until || until <= at) return undefined;
  if (resource.status === 'cancelled') return undefined;
  if (resource.transparency === 'transparent') return undefined;
  if (IGNORED_EVENT_TYPES.includes(resource.eventType ?? '')) return undefined;
  if (declinedBySelf(resource)) return undefined;

  return {
    at,
    source: 'calendar',
    kind: 'calendar-event',
    occurrenceId: resource.id ?? `${at.toISOString()}|${resource.summary ?? ''}`,
    until,
    title: resource.summary?.trim() || 'untitled event',
    accepted: acceptedBySelf(resource),
    conferenceUrl: conferenceUrlOf(resource),
  };
};

/**
 * Reads one calendar over a window as collectable events. `singleEvents` expands a recurring series
 * into the occurrences that actually fall inside the window, which is the only shape a day of
 * worklogs can be built from — a series master carries a recurrence rule, not a time.
 *
 * The window is Google's own overlap semantics: an event is returned when it ends after `from` and
 * starts before `to`, so a meeting spanning midnight appears in both days.
 */
export const fetchGoogleCalendarEvents$ = (options: {
  transport: TimetrackTransport;
  credentials: GoogleCalendarCredentials;
  from: Date;
  to: Date;
  /** Defaults to the user's primary calendar. */
  calendarId?: string;
  options?: Partial<GoogleCalendarPagingOptions>;
}): Observable<CalendarOccurrenceEvent[]> => {
  const calendarId = options.calendarId ?? 'primary';

  return googleCalendarPaged$<GoogleCalendarEventResource>({
    transport: options.transport,
    credentials: options.credentials,
    path: `/calendars/${encodeURIComponent(calendarId)}/events`,
    describe: `calendar ${calendarId}`,
    query: {
      singleEvents: true,
      orderBy: 'startTime',
      showDeleted: false,
      timeMin: options.from.toISOString(),
      timeMax: options.to.toISOString(),
    },
    options: options.options,
  }).pipe(
    map((resources) =>
      resources.flatMap((resource) => toOccurrence(resource) ?? []).sort((a, b) => a.at.getTime() - b.at.getTime()),
    ),
  );
};
