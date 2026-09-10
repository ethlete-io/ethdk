import { describe, expect, it } from 'vitest';
import { ActivityBlock, ActivityContext } from '../model/block';
import { CallWindow } from '../model/call';
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
