import { describe, expect, it } from 'vitest';
import { ActivityBlock } from '../model/block';
import { CollectedEvent } from '../model/event';
import { WorklogProposal } from '../model/proposal';
import { currentActivity, currentAttribution } from './now';

const at = (hour: number, minute = 0) => new Date(2026, 7, 11, hour, minute);

const block = (options: { from: Date; to: Date; branch?: string }): ActivityBlock => ({
  from: options.from,
  to: options.to,
  context: { appId: 'code', repoPath: '/home/tom/dev/ethlete-sdk', branch: options.branch ?? 'next' },
  evidence: [],
});

const presence = (
  kind: 'idle-start' | 'idle-end' | 'lock' | 'unlock' | 'pause-start' | 'pause-end',
  when: Date,
): CollectedEvent => ({
  at: when,
  source: 'idle',
  kind,
});

const focus = (when: Date): CollectedEvent => ({
  at: when,
  source: 'window',
  kind: 'window-focus',
  appId: 'code',
  title: 'x',
});

describe('currentActivity', () => {
  it('reports the newest block as what is being worked on', () => {
    const newest = block({ from: at(14), to: at(15), branch: 'feat/hub' });

    expect(currentActivity({ events: [], blocks: [block({ from: at(9), to: at(11) }), newest] })).toEqual({
      state: 'working',
      since: at(14),
      block: newest,
    });
  });

  it('reports idle when the machine said so after the last block ended', () => {
    expect(
      currentActivity({
        events: [focus(at(14)), presence('idle-start', at(15))],
        blocks: [block({ from: at(14), to: at(15) })],
      }),
    ).toEqual({ state: 'idle', since: at(15) });
  });

  it('keeps working through a lock the user has already come back from', () => {
    const newest = block({ from: at(15, 30), to: at(16) });

    expect(
      currentActivity({
        events: [presence('lock', at(12)), presence('unlock', at(15, 30))],
        blocks: [newest],
      }),
    ).toEqual({ state: 'working', since: at(15, 30), block: newest });
  });

  it('treats an idle stretch with nothing observed since as idle even with no blocks at all', () => {
    expect(currentActivity({ events: [presence('idle-start', at(9))], blocks: [] })).toEqual({
      state: 'idle',
      since: at(9),
    });
  });

  it('says paused rather than naming the work that was running when collection stopped', () => {
    expect(
      currentActivity({
        events: [focus(at(14)), presence('pause-start', at(15))],
        blocks: [block({ from: at(14), to: at(15) })],
      }),
    ).toEqual({ state: 'paused', since: at(15) });
  });

  it('goes back to the work once collection is resumed', () => {
    const newest = block({ from: at(16), to: at(17) });

    expect(
      currentActivity({
        events: [presence('pause-start', at(15)), presence('pause-end', at(16))],
        blocks: [newest],
      }),
    ).toEqual({ state: 'working', since: at(16), block: newest });
  });

  it('says nothing when the day has produced no evidence', () => {
    expect(currentActivity({ events: [], blocks: [] })).toEqual({ state: 'unknown' });
  });

  it('reads blocks in whatever order they arrive', () => {
    const newest = block({ from: at(14), to: at(15) });

    expect(currentActivity({ events: [], blocks: [newest, block({ from: at(9), to: at(11) })] }).state).toBe('working');
    expect(currentActivity({ events: [], blocks: [newest, block({ from: at(9), to: at(11) })] })).toMatchObject({
      block: newest,
    });
  });
});

describe('currentAttribution', () => {
  const row = (options: { from: Date; to: Date; issueKey: string; confidence?: WorklogProposal['confidence'] }) =>
    ({
      id: `row-${options.issueKey}-${options.from.getHours()}`,
      issueKey: options.issueKey,
      from: options.from,
      to: options.to,
      durationMs: options.to.getTime() - options.from.getTime(),
      observedMs: options.to.getTime() - options.from.getTime(),
      description: '',
      confidence: options.confidence ?? 'certain',
      evidence: [],
      state: 'suggested',
    }) satisfies WorklogProposal;

  const working = (from: Date, to: Date) => currentActivity({ events: [], blocks: [block({ from, to })] });

  it('names the issue the current work would be logged on', () => {
    const attribution = currentAttribution({
      activity: working(at(14), at(15)),
      rows: [row({ from: at(9), to: at(11), issueKey: 'FIP-1' }), row({ from: at(14), to: at(15), issueKey: 'FIP-2' })],
    });

    expect(attribution).toEqual({ issueKey: 'FIP-2', confidence: 'certain' });
  });

  it('reports the confidence the row carries, so a guess never reads as a fact', () => {
    const attribution = currentAttribution({
      activity: working(at(14), at(15)),
      rows: [row({ from: at(13), to: at(16), issueKey: 'FIP-2', confidence: 'weak' })],
    });

    expect(attribution).toEqual({ issueKey: 'FIP-2', confidence: 'weak' });
  });

  it('answers nothing for work no row claims', () => {
    expect(currentAttribution({ activity: working(at(14), at(15)), rows: [] })).toBeNull();
  });

  it('answers nothing while the machine is idle or paused', () => {
    const idle = currentActivity({ events: [{ at: at(15), source: 'idle', kind: 'idle-start' }], blocks: [] });

    expect(
      currentAttribution({ activity: idle, rows: [row({ from: at(9), to: at(18), issueKey: 'FIP-1' })] }),
    ).toBeNull();
  });
});
