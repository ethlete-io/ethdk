import { DEFAULT_GIT_FLOW_CONFIG, GitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { ActivityBlock } from '../model/block';
import { CallWindow } from '../model/call';
import { CallNaming } from '../model/call-naming';
import { CalendarOccurrenceEvent, CollectedEvent } from '../model/event';
import { Evidence } from '../model/evidence';
import { MeetingNaming, namedIssueFor } from '../model/meeting-naming';
import { RecurringPattern, patternAt } from '../model/recurrence';
import { windowsOverlap } from '../model/time-window';
import { issueKeyInText } from './attribute';

/** Where a meeting's or a call's issue key came from, which is what its confidence is computed from. */
export type MeetingKeySource = 'event-title' | 'remembered' | 'remembered-call' | 'tempo-history';

/** The issue a call was named from, and the observation that named it. */
export type NamedIssue = {
  issueKey: string;
  keySource: MeetingKeySource;
  evidence?: Evidence;
  /**
   * How well the source fits this call, for a source that matches rather than observes. Only
   * `remembered-call` sets it; everything else either names the occurrence outright or names a time
   * of day, and `confidenceOf` reads those from the meeting instead.
   */
  strength?: 'likely' | 'weak';
};

export type MeetingOptions = {
  /** Standing commitments read out of Tempo history, the same ones the attribution ladder uses. */
  patterns?: RecurringPattern[];
  /** What the user already answered when a meeting of this series asked which issue it belongs to. */
  namings?: readonly MeetingNaming[];
  /** The same, for a call the calendar never held, which has no series to be remembered under. */
  callNamings?: readonly CallNaming[];
  config?: GitFlowConfig;
};

const pad = (value: number) => String(value).padStart(2, '0');

const timeOfDay = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

/** The day's calendar occurrences, in start order. */
export const calendarOccurrences = (events: readonly CollectedEvent[]): CalendarOccurrenceEvent[] =>
  events
    .filter((event): event is CalendarOccurrenceEvent => event.kind === 'calendar-event')
    .sort((a, b) => a.at.getTime() - b.at.getTime());

/**
 * The conference's own identifier — `abc-defg-hij` for Meet, the numeric id for Zoom. It is what a
 * browser puts in the window title, so it is the one string that ties a window to *this* meeting
 * rather than to any meeting.
 */
export const conferenceIdOf = (event: CalendarOccurrenceEvent) => {
  if (!event.conferenceUrl) return undefined;

  const path = event.conferenceUrl.replace(/^https?:\/\/[^/]+\/?/, '').split(/[?#]/)[0] ?? '';
  const segment = path.split('/').filter(Boolean).pop();

  return segment && segment.length >= 4 ? segment.toLowerCase() : undefined;
};

/**
 * The conferencing products the machine can tell apart, by the word both an application identifier and
 * a conference link carry. A call held in one of these was not a meeting held in another, and that is
 * the only way an application rules a candidate out.
 *
 * It names products, never the user's own applications or meetings: an identifier this does not know
 * rules nothing out, which leaves every candidate standing.
 */
const CONFERENCE_SERVICES = ['meet', 'zoom', 'teams', 'discord', 'slack', 'webex', 'whereby', 'jitsi', 'gather'];

const serviceIn = (value: string | undefined) => {
  if (!value) return undefined;

  const text = value.toLowerCase();

  return CONFERENCE_SERVICES.find((service) => text.includes(service));
};

const titlesDuring = (options: { blocks: readonly ActivityBlock[]; window: { from: Date; to: Date } }) =>
  options.blocks
    .flatMap((block) => block.evidence)
    .filter(
      (entry) =>
        entry.kind === 'window-title' &&
        entry.at.getTime() >= options.window.from.getTime() &&
        entry.at.getTime() <= options.window.to.getTime(),
    );

/**
 * Below this, an event name is not distinctive enough to confirm anything: `QA` matches a window
 * called `qa-report.ts`, and a false confirmation is a row that syncs without ever being reviewed.
 */
const MIN_TITLE_MATCH_LENGTH = 6;

/** How sure the candidate picking is that this call was this occurrence. */
export type CandidateMatch = 'certain' | 'likely';

/** One calendar occurrence a call may have been, with what the machine saw of it. */
export type CalendarCandidate = {
  event: CalendarOccurrenceEvent;
  /** How much of the call the occurrence covers. */
  overlapMs: number;
};

/** The occurrence a call was, how sure that is, and the observation that decided it. */
export type PickedCandidate = {
  event: CalendarOccurrenceEvent;
  match: CandidateMatch;
  evidence: Evidence[];
};

/** Every occurrence that overlaps this window at all, longest overlap first. */
export const candidatesFor = (options: {
  occurrences: readonly CalendarOccurrenceEvent[];
  window: { from: Date; to: Date };
}): CalendarCandidate[] =>
  options.occurrences
    .flatMap((event) => {
      const from = Math.max(event.at.getTime(), options.window.from.getTime());
      const to = Math.min(event.until.getTime(), options.window.to.getTime());

      return to > from ? [{ event, overlapMs: to - from }] : [];
    })
    .sort((left, right) => right.overlapMs - left.overlapMs);

/**
 * The window title seen during the call that names this occurrence and no other meeting: its
 * conference id, or its own name when that is distinctive enough to mean something.
 */
const decisiveTitle = (options: {
  blocks: readonly ActivityBlock[];
  window: { from: Date; to: Date };
  event: CalendarOccurrenceEvent;
}) => {
  const conferenceId = conferenceIdOf(options.event);
  const title = options.event.title.toLowerCase();
  const matchesTitle = title.length >= MIN_TITLE_MATCH_LENGTH;

  return titlesDuring(options).find((entry) => {
    const detail = entry.detail.toLowerCase();

    return (conferenceId && detail.includes(conferenceId)) || (matchesTitle && detail.includes(title));
  });
};

const calendarEvidence = (event: CalendarOccurrenceEvent): Evidence => ({
  kind: 'calendar',
  at: event.at,
  detail: `calendar event _${event.title}_ ${timeOfDay(event.at)}-${timeOfDay(event.until)}, you ${
    event.accepted ? 'accepted' : 'never answered'
  }`,
  summary: event.title,
});

/**
 * Which of the day's meetings a call was, from the call itself.
 *
 * A window title seen while the call ran that names the occurrence, or its conference id, is decisive
 * and returns `certain`. Otherwise the call's own application rules candidates out: a call held in a
 * conferencing service was not a meeting held in a different one. One accepted candidate left returns
 * `likely`, and anything else decides nothing, which leaves the call unnamed with its candidates
 * still listed.
 */
export const pickCandidate = (options: {
  call: CallWindow;
  window: { from: Date; to: Date };
  candidates: readonly CalendarCandidate[];
  blocks: readonly ActivityBlock[];
}): PickedCandidate | undefined => {
  const { call, window, candidates, blocks } = options;

  for (const candidate of candidates) {
    const found = decisiveTitle({ blocks, window, event: candidate.event });

    if (found)
      return { event: candidate.event, match: 'certain', evidence: [calendarEvidence(candidate.event), found] };
  }

  // Only a call the machine can place in a conferencing product may rule anything out. A browser names
  // no product, and a call in a browser could have been any of the candidates.
  const service = serviceIn(call.appId);
  const possible = service
    ? candidates.filter((candidate) => {
        const held = serviceIn(candidate.event.conferenceUrl);

        return !held || held === service;
      })
    : [...candidates];
  const accepted = possible.filter((candidate) => candidate.event.accepted);

  if (accepted.length !== 1) return undefined;

  const only = accepted[0] as CalendarCandidate;

  return {
    event: only.event,
    match: 'likely',
    evidence: [
      calendarEvidence(only.event),
      {
        kind: 'call',
        at: window.from,
        detail: `the only meeting you accepted over this call, ${timeOfDay(only.event.at)}-${timeOfDay(
          only.event.until,
        )}`,
        summary: only.event.title,
      },
    ],
  };
};

/**
 * The issue the user's own Tempo history says a commitment at this instant lands on, and nothing else.
 *
 * A call with no calendar candidate is named from this alone: a microphone that opened says a call
 * happened, never which one, so a call the history cannot place stays unattributed and the review
 * asks about it.
 */
export const patternIssueKey = (options: { at: Date; meetings: MeetingOptions }): NamedIssue | undefined => {
  const { at, meetings } = options;
  const pattern = meetings.patterns?.length ? patternAt({ patterns: meetings.patterns, at }) : undefined;

  if (!pattern) return undefined;

  return {
    issueKey: pattern.issueKey,
    keySource: 'tempo-history',
    evidence: {
      kind: 'tempo-history',
      at,
      detail: `${pattern.issueKey} logged at this time on ${pattern.occurrences} earlier weeks`,
    },
  };
};

/** The issue the user already answered for this occurrence's series, and the answer as evidence. */
export const rememberedIssueKey = (options: {
  event: CalendarOccurrenceEvent;
  meetings: MeetingOptions;
}): NamedIssue | undefined => {
  const naming = namedIssueFor({ event: options.event, namings: options.meetings.namings ?? [] });

  if (!naming) return undefined;

  return {
    issueKey: naming.issueKey,
    keySource: 'remembered',
    evidence: {
      kind: 'calendar',
      at: naming.createdAt,
      detail: `you named _${naming.title}_ ${naming.issueKey}, and this is the same meeting`,
      summary: naming.title,
    },
  };
};

/** A calendar occurrence the day observed no call for. It is a question the review asks, never a row. */
export type UnobservedOccurrence = {
  event: CalendarOccurrenceEvent;
  /** The issue its own title or a remembered naming gives it, for the card to offer with one press. */
  issueKey?: string;
  keySource?: MeetingKeySource;
};

/**
 * The occurrences no call was heard over.
 *
 * An invitation is an intention, and only the microphone records that a meeting happened, so one of
 * these proposes no row. It becomes a question the day asks instead, which is also the honest answer
 * for a meeting held in a room or on a telephone.
 *
 * Every call counts here, not only the ones a rule counted as work: a call the attendance gate
 * dropped still says the user was in something at that hour.
 */
export const unobservedOccurrences = (options: {
  occurrences: readonly CalendarOccurrenceEvent[];
  calls: readonly CallWindow[];
  meetings?: MeetingOptions;
}): UnobservedOccurrence[] => {
  const meetings = options.meetings ?? {};

  return options.occurrences
    .filter(
      (event) =>
        !options.calls.some((call) =>
          windowsOverlap({ from: call.from, to: call.to }, { from: event.at, to: event.until }),
        ),
    )
    .map((event) => {
      const key = occurrenceIssueKey({ event, meetings });

      return { event, ...(key ? { issueKey: key.issueKey, keySource: key.keySource } : {}) };
    });
};

/**
 * The issue an occurrence names on its own: a key written into its title, else the answer the user
 * already gave for its series. Tempo history is not read here — it names a time of day rather than a
 * meeting, and a call is what asks it.
 */
export const occurrenceIssueKey = (options: {
  event: CalendarOccurrenceEvent;
  meetings: MeetingOptions;
}): NamedIssue | undefined => {
  const { event, meetings } = options;
  const titleKey = issueKeyInText({ text: event.title, config: meetings.config ?? DEFAULT_GIT_FLOW_CONFIG });

  if (titleKey) return { issueKey: titleKey, keySource: 'event-title' };

  return rememberedIssueKey({ event, meetings });
};
