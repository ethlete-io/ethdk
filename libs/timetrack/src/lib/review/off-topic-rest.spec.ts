import { describe, expect, it } from 'vitest';
import { AgentApproval } from '../agent-api/approval-queue';
import { DayRows } from '../rows/build-rows';
import { matchCalls } from '../rows/calls';
import { CalendarOccurrenceEvent, CollectedEvent } from '../model/event';
import { WorklogProposal } from '../model/proposal';
import { approvalRowIdsOf } from './auto-mode';
import { endRowAt } from './end-call';
import { hideRow } from './edits';
import { DayReviewEdits, EMPTY_DAY_REVIEW_EDITS } from './model';
import { autoModeHideAsks, autoModeHideRequest, autoModeHideTarget, offTopicRests } from './off-topic-rest';
import { reviewDay } from './review-day';

const DAY = '2026-08-11';
const HELPER = 'com.hnc.Discord.helper.Renderer';
const at = (time: string) => new Date(`${DAY}T${time}:00Z`);

const meeting = (to: string): WorklogProposal => ({
  id: `FIP-3095@${at('14:00').toISOString()}`,
  issueKey: 'FIP-3095',
  from: at('14:00'),
  to: at(to),
  durationMs: at(to).getTime() - at('14:00').getTime(),
  observedMs: at(to).getTime() - at('14:00').getTime(),
  laneKey: 'lane:call',
  description: 'Meeting #1 | Braune Digital - Discord',
  confidence: 'likely',
  evidence: [],
  state: 'suggested',
});

const occurrence = (from: string, until: string): CalendarOccurrenceEvent => ({
  at: at(from),
  until: at(until),
  source: 'calendar',
  kind: 'calendar-event',
  occurrenceId: `sync@${from}`,
  title: 'Sync',
  accepted: true,
  conferenceUrl: 'https://call.example.com/qzx-room-71',
});

const day = (to: string, occurrences: CalendarOccurrenceEvent[] = []): DayRows => ({
  proposals: [meeting(to)],
  unattributed: [],
  unnamed: [],
  unobserved: [],
  calls: matchCalls({
    occurrences,
    calls: [
      {
        appId: HELPER,
        from: at('14:00'),
        to: at(to),
        title: 'Meeting #1 | Braune Digital - Discord',
        attendedMs: 0,
        countsAsWork: true,
        isPresence: true,
      },
    ],
    blocks: [],
    claimed: [],
  }),
  timers: [],
  behind: [],
  filledMs: 0,
  private: [],
  privateMs: 0,
});

const focus = (time: string, appId: string): CollectedEvent => ({
  at: at(time),
  source: 'window',
  kind: 'window-focus',
  appId,
  title: '',
});

const endedAt = (time: string, rows: DayRows) =>
  endRowAt({ edits: EMPTY_DAY_REVIEW_EDITS, row: reviewDay({ rows }).rows[0]!, at: at(time) });

const offTopic = (options: {
  through: string;
  events: CollectedEvent[];
  edits?: (rows: DayRows) => DayReviewEdits;
  occurrences?: CalendarOccurrenceEvent[];
}) => {
  const rows = day(options.through, options.occurrences);
  const edits = options.edits?.(rows) ?? endedAt('15:00', rows);

  return offTopicRests({ rows: reviewDay({ rows, edits }).rows, edits, calls: rows.calls, events: options.events }).map(
    (row) => ({ from: row.from.toISOString(), to: row.to.toISOString() }),
  );
};

const CODING: CollectedEvent[] = [focus('14:00', 'com.hnc.Discord'), focus('15:00', 'code')];

describe('offTopicRests', () => {
  it('finds the rest of an ended call the user spent in other applications', () => {
    expect(offTopic({ through: '16:00', events: CODING })).toEqual([
      { from: at('15:00').toISOString(), to: at('16:00').toISOString() },
    ]);
  });

  it('skips a rest shorter than half an hour', () => {
    expect(offTopic({ through: '15:15', events: CODING })).toEqual([]);
  });

  it('skips a rest the call held the focus for more than a twentieth of', () => {
    const events = [...CODING, focus('15:30', 'com.hnc.Discord'), focus('15:34', 'code')];

    expect(offTopic({ through: '16:00', events })).toEqual([]);
  });

  it('skips a rest the user spent away rather than in other applications', () => {
    const events: CollectedEvent[] = [
      ...CODING,
      { at: at('15:10'), source: 'idle', kind: 'idle-start' },
      { at: at('15:50'), source: 'idle', kind: 'idle-end' },
    ];

    expect(offTopic({ through: '16:00', events })).toEqual([]);
  });

  it('skips a rest a calendar meeting still runs over', () => {
    expect(offTopic({ through: '16:00', events: CODING, occurrences: [occurrence('14:00', '15:30')] })).toEqual([]);
  });

  it('takes a meeting that ended where the rest begins as over', () => {
    expect(offTopic({ through: '16:00', events: CODING, occurrences: [occurrence('14:00', '15:00')] })).toHaveLength(1);
  });

  it('skips a call nobody ended, whose band is still the named row', () => {
    expect(offTopic({ through: '16:00', events: CODING, edits: () => EMPTY_DAY_REVIEW_EDITS })).toEqual([]);
  });

  it('skips a rest the user already hid', () => {
    const hidden = (rows: DayRows) => {
      const edits = endedAt('15:00', rows);
      const rest = reviewDay({ rows, edits }).rows[1]!;

      return hideRow({ edits, row: rest });
    };

    expect(offTopic({ through: '16:00', events: CODING, edits: hidden })).toEqual([]);
  });
});

describe('the hide suggestion', () => {
  const rows = day('16:00');
  const edits = endedAt('15:00', rows);
  const review = reviewDay({ rows, edits });
  const rest = review.rows[1]!;
  const request = autoModeHideRequest({ day: DAY, row: rest });

  const asks = (approvals: Pick<AgentApproval, 'target'>[], today = DAY) =>
    autoModeHideAsks({ enabled: true, day: DAY, today, classes: {}, rests: [rest], approvals }).map((row) => row.id);

  it('asks once per rest band, and never again after any answer', () => {
    expect(asks([])).toEqual([rest.id]);
    expect(asks([{ target: autoModeHideTarget(DAY, rest.id) }])).toEqual([]);
  });

  it('asks only about today, and not while applying is one by one', () => {
    expect(asks([], '2026-08-12')).toEqual([]);
    expect(
      autoModeHideAsks({
        enabled: true,
        day: DAY,
        today: DAY,
        classes: { 'autoMode.apply': 'human-only' },
        rests: [rest],
        approvals: [],
      }),
    ).toEqual([]);
  });

  it('previews on the rest band it would hide', () => {
    expect(approvalRowIdsOf({ item: { request }, day: DAY, rows: review.rows, unattributed: [] })).toEqual([rest.id]);
  });

  it('hides the rest band, which stays hidden as the call runs on and can be shown again', () => {
    const hidden = hideRow({ edits, row: rest });
    const later = reviewDay({ rows: day('17:00'), edits: hidden });

    expect(later.rows.map((row) => row.issueKey)).toEqual(['FIP-3095']);
    expect(later.hidden.map((row) => [row.id, row.to.toISOString()])).toEqual([[rest.id, at('17:00').toISOString()]]);
  });
});
