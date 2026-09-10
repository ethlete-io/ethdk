import { describe, expect, it } from 'vitest';
import { ActivityBlock, ActivityContext } from '../model/block';
import { CallWindow } from '../model/call';
import { CalendarOccurrenceEvent } from '../model/event';
import { buildRows } from './build-rows';

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

  it('gives it no lane when a meeting runs over it either', () => {
    const rows = buildRows({
      blocks: [block({ from: at(10, 10), to: at(10, 11), context: { appId: POPUP } })],
      events: [OCCURRENCE],
      noWorkContext: { transientApps: [POPUP] },
      meetings: { defaultIssueKey: 'ABC-1' },
    });

    expect(rows.meetings).toHaveLength(1);
    expect(laneKeys(rows)).not.toContain(`app:${POPUP}`);
  });

  it('gives it no lane when a timer runs over it either', () => {
    const rows = buildRows({
      blocks: [block({ from: at(10, 10), to: at(10, 11), context: { appId: POPUP } })],
      events: [],
      noWorkContext: { transientApps: [POPUP] },
      timerRuns: [{ id: 'run', issueKey: 'ABC-1', from: at(10), to: at(11), description: 'timed' }],
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
