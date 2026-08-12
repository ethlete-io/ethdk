import { DEFAULT_GIT_FLOW_CONFIG, GitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { ActivityBlock } from '../model/block';
import { CalendarOccurrenceEvent, CollectedEvent } from '../model/event';
import { Confidence, Evidence } from '../model/evidence';
import { issueKeyInText } from './attribute';
import { WorkGroup } from './merge';
import { RecurringPattern, patternAt } from './recurrence';

/**
 * How much the machine saw of a meeting. `confirmed` means a window title named the conference or the
 * event while it was running; `observed` means the user was at the machine but doing something else;
 * `unobserved` means nothing was collected, which is what a meeting away from the desk looks like.
 */
export type MeetingAttendance = 'confirmed' | 'observed' | 'unobserved';

/** Where a meeting's issue key came from, which is what its confidence is computed from. */
export type MeetingKeySource = 'event-title' | 'tempo-history' | 'default';

export type MeetingMatch = {
  event: CalendarOccurrenceEvent;
  attendance: MeetingAttendance;
  keySource?: MeetingKeySource;
  /**
   * Activity time observed inside the meeting. It is time the day now proposes twice — once as the
   * meeting and once as whatever the user was typing during it — so a reviewer has to see it.
   */
  overlapMs: number;
  /** The reviewable row. Carries no `issueKey` when nothing could name one, which leaves it unattributed. */
  group: WorkGroup;
};

export type MeetingOptions = {
  /** The ticket meetings land on when nothing else names one — an internal "Meetings" issue. */
  defaultIssueKey?: string;
  /** Standing commitments read out of Tempo history, the same ones the attribution ladder uses. */
  patterns?: RecurringPattern[];
  config?: GitFlowConfig;
};

const pad = (value: number) => String(value).padStart(2, '0');

const timeOfDay = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

const overlapOf = (options: { block: ActivityBlock; from: Date; to: Date }) => {
  const { block, from, to } = options;
  const start = Math.max(block.from.getTime(), from.getTime());
  const end = Math.min(block.to.getTime(), to.getTime());

  return Math.max(0, end - start);
};

/**
 * The conference's own identifier — `abc-defg-hij` for Meet, the numeric id for Zoom. It is what a
 * browser puts in the window title, so it is the one string that ties a window to *this* meeting
 * rather than to any meeting.
 */
const conferenceIdOf = (event: CalendarOccurrenceEvent) => {
  if (!event.conferenceUrl) return undefined;

  const path = event.conferenceUrl.replace(/^https?:\/\/[^/]+\/?/, '').split(/[?#]/)[0] ?? '';
  const segment = path.split('/').filter(Boolean).pop();

  return segment && segment.length >= 4 ? segment.toLowerCase() : undefined;
};

const titlesDuring = (options: { blocks: ActivityBlock[]; event: CalendarOccurrenceEvent }) =>
  options.blocks
    .flatMap((block) => block.evidence)
    .filter(
      (entry) =>
        entry.kind === 'window-title' &&
        entry.at.getTime() >= options.event.at.getTime() &&
        entry.at.getTime() <= options.event.until.getTime(),
    );

/**
 * Below this, an event name is not distinctive enough to confirm anything: `QA` matches a window
 * called `qa-report.ts`, and a false confirmation is a row that syncs without ever being reviewed.
 */
const MIN_TITLE_MATCH_LENGTH = 6;

const confirmingTitle = (options: { blocks: ActivityBlock[]; event: CalendarOccurrenceEvent }) => {
  const conferenceId = conferenceIdOf(options.event);
  const title = options.event.title.toLowerCase();
  const matchesTitle = title.length >= MIN_TITLE_MATCH_LENGTH;

  return titlesDuring(options).find((entry) => {
    const detail = entry.detail.toLowerCase();

    return (conferenceId && detail.includes(conferenceId)) || (matchesTitle && detail.includes(title));
  });
};

const attendanceOf = (options: {
  blocks: ActivityBlock[];
  event: CalendarOccurrenceEvent;
  overlapMs: number;
}): { attendance: MeetingAttendance; evidence?: Evidence } => {
  const found = confirmingTitle(options);

  if (found) return { attendance: 'confirmed', evidence: found };

  return { attendance: options.overlapMs > 0 ? 'observed' : 'unobserved' };
};

/**
 * A key read out of the event's own name is as good as one read off a branch, so a confirmed meeting
 * on `FIP-2177 refinement` is `certain`. Everything else is a guess about which ticket a meeting
 * belongs to, however sure we are that it happened — and an invitation the user never answered is not
 * evidence they attended, whatever its title says.
 */
const confidenceOf = (options: {
  attendance: MeetingAttendance;
  keySource: MeetingKeySource;
  accepted: boolean;
}): Confidence => {
  const { attendance, keySource, accepted } = options;

  if (!accepted) return attendance === 'confirmed' ? 'likely' : 'weak';
  if (keySource === 'event-title') return attendance === 'confirmed' ? 'certain' : 'likely';

  return attendance === 'confirmed' ? 'likely' : 'weak';
};

const resolveKey = (options: {
  event: CalendarOccurrenceEvent;
  config: GitFlowConfig;
  meetings: MeetingOptions;
}): { issueKey: string; keySource: MeetingKeySource; evidence?: Evidence } | undefined => {
  const { event, config, meetings } = options;
  const titleKey = issueKeyInText({ text: event.title, config });

  if (titleKey) return { issueKey: titleKey, keySource: 'event-title' };

  const pattern = meetings.patterns?.length ? patternAt({ patterns: meetings.patterns, at: event.at }) : undefined;

  if (pattern) {
    return {
      issueKey: pattern.issueKey,
      keySource: 'tempo-history',
      evidence: {
        kind: 'tempo-history',
        at: event.at,
        detail: `${pattern.issueKey} logged at this time on ${pattern.occurrences} earlier weeks`,
      },
    };
  }

  return meetings.defaultIssueKey ? { issueKey: meetings.defaultIssueKey, keySource: 'default' } : undefined;
};

const calendarEvidence = (event: CalendarOccurrenceEvent): Evidence => ({
  kind: 'calendar',
  at: event.at,
  detail: `calendar event _${event.title}_ ${timeOfDay(event.at)}-${timeOfDay(event.until)}, you ${
    event.accepted ? 'accepted' : 'never answered'
  }`,
  summary: event.title,
});

const matchOne = (options: {
  event: CalendarOccurrenceEvent;
  blocks: ActivityBlock[];
  meetings: MeetingOptions;
}): MeetingMatch => {
  const { event, blocks, meetings } = options;
  const config = meetings.config ?? DEFAULT_GIT_FLOW_CONFIG;
  const overlapMs = blocks.reduce((sum, block) => sum + overlapOf({ block, from: event.at, to: event.until }), 0);
  const { attendance, evidence } = attendanceOf({ blocks, event, overlapMs });
  const key = resolveKey({ event, config, meetings });
  const evidenceChain = [
    calendarEvidence(event),
    ...(evidence ? [evidence] : []),
    ...(key?.evidence ? [key.evidence] : []),
  ];

  return {
    event,
    attendance,
    keySource: key?.keySource,
    overlapMs,
    group: {
      issueKey: key?.issueKey,
      from: event.at,
      to: event.until,
      // The calendar's own duration, never the time the collectors saw. Clipping a meeting to its
      // observed samples loses almost all of it: the collectors are edge-triggered, so sitting in
      // one Meet window for an hour emits a single focus event.
      observedMs: event.until.getTime() - event.at.getTime(),
      confidence: key ? confidenceOf({ attendance, keySource: key.keySource, accepted: event.accepted }) : 'weak',
      evidence: evidenceChain,
      blocks: [],
    },
  };
};

/**
 * Turns calendar occurrences into reviewable rows of their own. A meeting is the one kind of work the
 * machine cannot observe directly — the evidence that it happened is the invitation, and the evidence
 * that the user attended is a window title naming the conference while it ran.
 *
 * Rows come back in calendar order, and a meeting nothing could name an issue for comes back without
 * one, which lands it in the day's unattributed groups rather than on a guessed ticket.
 */
export const matchMeetings = (options: {
  events: CollectedEvent[];
  blocks: ActivityBlock[];
  meetings?: MeetingOptions;
}): MeetingMatch[] => {
  const meetings = options.meetings ?? {};

  return options.events
    .filter((event): event is CalendarOccurrenceEvent => event.kind === 'calendar-event')
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map((event) => matchOne({ event, blocks: options.blocks, meetings }));
};
