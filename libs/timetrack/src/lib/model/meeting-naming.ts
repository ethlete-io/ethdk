import { CalendarOccurrenceEvent } from './event';

/**
 * What the user answered when a meeting asked which issue it belongs to, remembered against the
 * calendar series the meeting repeats in. Naming one occurrence names every later one.
 */
export type MeetingNaming = {
  /** From {@link meetingSeriesKey}. */
  seriesKey: string;
  issueKey: string;
  /** The occurrence title the answer was given for, so a list of these reads as meetings. */
  title: string;
  createdAt: Date;
};

/**
 * What a naming is remembered against: the provider's own series id, so a renamed meeting keeps its
 * answer, and the folded title for a one-off event, which has no series id at all.
 */
export const meetingSeriesKey = (event: Pick<CalendarOccurrenceEvent, 'recurringEventId' | 'title'>) =>
  event.recurringEventId ?? event.title.trim().toLowerCase().replace(/\s+/g, ' ');

/** The issue the user already named this series after, or nothing. */
export const namedIssueFor = (options: {
  event: Pick<CalendarOccurrenceEvent, 'recurringEventId' | 'title'>;
  namings: readonly MeetingNaming[];
}) => {
  const key = meetingSeriesKey(options.event);

  return options.namings.find((naming) => naming.seriesKey === key);
};

/**
 * The namings with this answer written in. An answer for a series the store already holds replaces
 * it, so the newest answer is the one that applies.
 */
export const rememberMeetingNaming = (options: {
  namings: readonly MeetingNaming[];
  event: Pick<CalendarOccurrenceEvent, 'recurringEventId' | 'title'>;
  issueKey: string;
  at: Date;
}): MeetingNaming[] => {
  const seriesKey = meetingSeriesKey(options.event);
  const written: MeetingNaming = {
    seriesKey,
    issueKey: options.issueKey.trim().toUpperCase(),
    title: options.event.title,
    createdAt: options.at,
  };

  return [...options.namings.filter((naming) => naming.seriesKey !== seriesKey), written];
};
