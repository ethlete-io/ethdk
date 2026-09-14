import { describe, expect, it } from 'vitest';
import { AttributionRule } from '../model/attribution';
import { ActivityBlock, ActivityContext } from '../model/block';
import { CallWindow } from '../model/call';
import { CalendarOccurrenceEvent } from '../model/event';
import { StandIn } from '../model/stand-in';
import { buildRows } from './build-rows';
import { CALL_LANE_KEY } from './lane';
import { checkDay } from './round';

const at = (hour: number, minute = 0) => new Date(2026, 8, 10, hour, minute);

const block = (options: { from: Date; to: Date; context: ActivityContext }): ActivityBlock => ({
  from: options.from,
  to: options.to,
  context: options.context,
  evidence: [],
});

const HUDDLE: CallWindow = {
  from: at(10),
  to: at(11),
  appId: 'com.slack.Slack',
  title: 'Huddle | Braune Digital',
  attendedMs: 30 * 60_000,
  countsAsWork: true,
};

describe('buildRows with no-work-context applications', () => {
  it('proposes no row for the application itself', () => {
    const rows = buildRows({
      blocks: [block({ from: at(9), to: at(10), context: { appId: 'com.slack.Slack' } })],
      events: [],
      noWorkContext: { apps: ['com.slack.Slack'] },
    });

    expect(rows.proposals).toEqual([]);
    expect(rows.unnamed).toEqual([]);
  });

  it('keeps the call the application held', () => {
    const rows = buildRows({
      blocks: [block({ from: at(10), to: at(11), context: { appId: 'com.slack.Slack' } })],
      events: [],
      calls: [HUDDLE],
      noWorkContext: { apps: ['com.slack.Slack'] },
    });

    expect(rows.calls).toHaveLength(1);
    expect(rows.calls[0]?.group.observedMs).toBe(60 * 60_000);
  });

  it('warns of no double count for a call whose own application proposes nothing', () => {
    const rows = buildRows({
      blocks: [block({ from: at(10), to: at(11), context: { appId: 'com.slack.Slack' } })],
      events: [],
      calls: [HUDDLE],
      noWorkContext: { apps: ['com.slack.Slack'] },
    });

    expect(rows.calls[0]?.overlapMs).toBe(0);
  });
});

describe('buildRows with a transient window over the work', () => {
  const POPUP = 'chrome-hhieiojnefblcnbdbmeamnljodladlem-Default';
  const OCCURRENCE: CalendarOccurrenceEvent = {
    at: at(10),
    until: at(11),
    source: 'calendar',
    kind: 'calendar-event',
    occurrenceId: 'one',
    title: 'weekly',
    accepted: true,
  };

  const laneKeys = (rows: ReturnType<typeof buildRows>) =>
    [...rows.proposals, ...rows.unnamed].map((row) => row.laneKey);

  it('gives it no lane of its own', () => {
    const rows = buildRows({
      blocks: [block({ from: at(10, 10), to: at(10, 11), context: { appId: POPUP } })],
      events: [],
      noWorkContext: { transientApps: [POPUP] },
    });

    expect(laneKeys(rows)).not.toContain(`app:${POPUP}`);
  });

  it('gives it no lane when a call over a meeting runs over it either', () => {
    const rows = buildRows({
      blocks: [block({ from: at(10, 10), to: at(10, 11), context: { appId: POPUP } })],
      events: [OCCURRENCE],
      calls: [HUDDLE],
      noWorkContext: { transientApps: [POPUP] },
    });

    expect(rows.calls[0]?.meeting?.event.title).toBe('weekly');
    expect(laneKeys(rows)).not.toContain(`app:${POPUP}`);
  });

  it('asks about the meeting rather than billing it when no call was heard', () => {
    const rows = buildRows({
      blocks: [block({ from: at(10, 10), to: at(10, 11), context: { appId: POPUP } })],
      events: [OCCURRENCE],
      noWorkContext: { transientApps: [POPUP] },
    });

    expect(rows.unobserved.map((entry) => entry.event.title)).toEqual(['weekly']);
    expect(rows.calls).toEqual([]);
  });

  it('gives it no lane when a timer runs over it either', () => {
    const rows = buildRows({
      blocks: [block({ from: at(10, 10), to: at(10, 11), context: { appId: POPUP } })],
      events: [],
      noWorkContext: { transientApps: [POPUP] },
      timerRuns: [{ id: 'run', issueKey: 'ABC-1', from: at(10), to: at(11) }],
    });

    expect(rows.timers).toHaveLength(1);
    expect(laneKeys(rows)).not.toContain(`app:${POPUP}`);
  });

  it('draws it in the lane it interrupted', () => {
    const context: ActivityContext = { repoPath: '/dev/a', branch: 'main' };
    const rows = buildRows({
      blocks: [
        block({ from: at(10), to: at(10, 10), context }),
        block({ from: at(10, 10), to: at(10, 11), context: { appId: POPUP } }),
        block({ from: at(10, 11), to: at(11), context }),
      ],
      events: [],
      noWorkContext: { transientApps: [POPUP] },
    });

    expect(laneKeys(rows)).toEqual(['repo:/dev/a']);
  });
});

describe('buildRows with a call a rule excluded', () => {
  const ROOM: CallWindow = { ...HUDDLE, title: 'Open Room #1 | Braune Digital', countsAsWork: false };

  it('draws the room as a row of its own', () => {
    const rows = buildRows({ blocks: [], events: [], calls: [ROOM] });

    expect(rows.unnamed).toHaveLength(1);
    expect(rows.unnamed[0]?.laneKey).toBe(CALL_LANE_KEY);
    expect(rows.unnamed[0]?.description).toContain('Open Room #1');
    expect(rows.unnamed[0]?.excluded).toBe(true);
  });

  it('is not time the day reports as waiting for a name', () => {
    const rows = buildRows({ blocks: [], events: [], calls: [ROOM] });
    const check = checkDay({ proposals: rows.proposals, unattributed: rows.unattributed });

    expect(check.unattributedMs).toBe(0);
    expect(check.warnings.map((warning) => warning.kind)).not.toContain('unattributed-time');
  });

  it('lets an open room say nothing about whether anybody was at the machine', () => {
    const rows = buildRows({
      blocks: [block({ from: at(10), to: at(11), context: { repoPath: '/dev/a', branch: 'main' } })],
      events: [],
      calls: [ROOM],
    });
    const worked = rows.unattributed.find((group) => group.laneKey !== CALL_LANE_KEY);

    expect(worked?.attended).toBe(false);
  });
});

describe('buildRows with a rule naming a stand-in', () => {
  const STAND_IN: StandIn = {
    id: 'stand-in-1',
    name: 'The feature with no ticket',
    state: 'open',
    days: [],
    author: 'user',
    createdAt: at(8),
  };

  const RULE: AttributionRule = {
    id: 'rule-1',
    repoPath: '/dev/a',
    target: { kind: 'stand-in', standInId: STAND_IN.id },
    author: 'user',
    createdAt: at(8),
  };

  const WORK = [block({ from: at(9), to: at(10), context: { repoPath: '/dev/a', branch: 'no-key-here' } })];

  it('names the row with the stand-in and leaves it unbookable', () => {
    const rows = buildRows({ blocks: WORK, events: [], rules: [RULE], standIns: [STAND_IN] });

    expect(rows.unnamed).toHaveLength(1);
    expect(rows.unnamed[0]?.standInId).toBe(STAND_IN.id);
    expect(rows.proposals).toEqual([]);
  });

  it('leaves the row unnamed when the stand-in the rule points at is gone', () => {
    const rows = buildRows({ blocks: WORK, events: [], rules: [RULE], standIns: [] });

    expect(rows.unnamed[0]?.standInId).toBeUndefined();
  });

  it('takes the row out of the work the day still has to ask about', () => {
    const named = buildRows({ blocks: WORK, events: [], rules: [RULE], standIns: [STAND_IN] });
    const gone = buildRows({ blocks: WORK, events: [], rules: [RULE], standIns: [] });

    expect(named.unattributed).toEqual([]);
    expect(gone.unattributed).toHaveLength(1);
  });
});
