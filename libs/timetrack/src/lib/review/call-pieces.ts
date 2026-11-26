import { CallMatch } from '../rows/calls';
import { describeWork } from '../rows/describe';
import { CALL_LANE_KEY, storedLaneKey } from '../rows/lane';
import { calendarEvidence } from '../rows/meetings';
import { CalendarOccurrenceEvent } from '../model/event';
import { TimeWindow } from '../model/time-window';

const sharedMs = (left: TimeWindow, right: TimeWindow) =>
  Math.max(0, Math.min(left.to.getTime(), right.to.getTime()) - Math.max(left.from.getTime(), right.from.getTime()));

const meetingWindow = (event: CalendarOccurrenceEvent): TimeWindow => ({ from: event.at, to: event.until });

const acceptedMeetingsOver = (options: { calls: readonly CallMatch[]; window: TimeWindow }) => {
  const byId = new Map<string, CalendarOccurrenceEvent>();

  for (const { event } of options.calls.flatMap((match) => match.candidates)) {
    if (event.accepted && sharedMs(meetingWindow(event), options.window) > 0) byId.set(event.occurrenceId, event);
  }

  return [...byId.values()].sort(
    (left, right) => sharedMs(meetingWindow(right), options.window) - sharedMs(meetingWindow(left), options.window),
  );
};

/**
 * Re-describes a piece the reviewer cut out of a call row from the minutes it holds: the accepted
 * meeting over them, or the call's own label where none is. A description that is not one the day
 * wrote for a call is the reviewer's, and is kept.
 */
export const describeCallPiece = <T extends TimeWindow & { laneKey?: string; description: string }>(options: {
  row: T;
  calls: readonly CallMatch[];
}): T => {
  const { row, calls } = options;

  if (storedLaneKey(row.laneKey) !== CALL_LANE_KEY) return row;
  if (!calls.some((match) => describeWork({ group: match.group }) === row.description)) return row;

  const [call] = calls
    .filter((match) => sharedMs(match.group, row) > 0)
    .sort((left, right) => sharedMs(right.group, row) - sharedMs(left.group, row));

  if (!call) return row;

  const meetings = acceptedMeetingsOver({ calls, window: row });
  const meeting =
    meetings.find((event) => row.description.includes(calendarEvidence(event).summary ?? event.title)) ?? meetings[0];
  const description = describeWork({
    group: {
      ...call.group,
      evidence: [
        ...call.group.evidence.filter((entry) => entry.kind !== 'calendar' && !call.meeting?.evidence.includes(entry)),
        ...(meeting ? [calendarEvidence(meeting)] : []),
      ],
    },
  });

  return description === row.description ? row : { ...row, description };
};
