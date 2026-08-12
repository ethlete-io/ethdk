import { Observable, map } from 'rxjs';
import { TimetrackTransport } from '../transport/ports';
import { GoogleCalendarCredentials, googleCalendarPaged$ } from './client';

export type GoogleCalendar = {
  id: string;
  name: string;
  /** The account's own calendar, which is the one `fetchGoogleCalendarEvents$` defaults to. */
  primary: boolean;
  /** Whether the user has this calendar shown in Google's own UI — a sensible default for the picker. */
  selected: boolean;
  /** True when the token may only read the calendar, which is all this app ever needs. */
  readOnly: boolean;
};

type GoogleCalendarListResource = {
  id?: string;
  summary?: string;
  summaryOverride?: string;
  primary?: boolean;
  selected?: boolean;
  accessRole?: string;
  deleted?: boolean;
};

const READ_ONLY_ROLES = ['freeBusyReader', 'reader'];

/**
 * The calendars the account can read, for the settings picker. A user has several — a work calendar, a
 * personal one, shared team ones — and which of them count as work is a decision only they can make,
 * so nothing here filters beyond dropping the ones Google has deleted.
 */
export const fetchGoogleCalendarList$ = (options: {
  transport: TimetrackTransport;
  credentials: GoogleCalendarCredentials;
}): Observable<GoogleCalendar[]> =>
  googleCalendarPaged$<GoogleCalendarListResource>({
    transport: options.transport,
    credentials: options.credentials,
    path: '/users/me/calendarList',
    describe: 'your calendar list',
  }).pipe(
    map((resources) =>
      resources.flatMap((resource): GoogleCalendar | [] => {
        if (!resource.id || resource.deleted) return [];

        return {
          id: resource.id,
          name: resource.summaryOverride ?? resource.summary ?? resource.id,
          primary: resource.primary === true,
          selected: resource.selected === true,
          readOnly: READ_ONLY_ROLES.includes(resource.accessRole ?? ''),
        };
      }),
    ),
  );
