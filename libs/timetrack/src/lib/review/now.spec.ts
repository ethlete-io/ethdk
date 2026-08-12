import { describe, expect, it } from 'vitest';
import { ActivityBlock } from '../model/block';
import { CollectedEvent } from '../model/event';
import { currentActivity } from './now';

const at = (hour: number, minute = 0) => new Date(2026, 7, 11, hour, minute);

const block = (options: { from: Date; to: Date; branch?: string }): ActivityBlock => ({
  from: options.from,
  to: options.to,
  context: { appId: 'code', repoPath: '/home/tom/dev/ethlete-sdk', branch: options.branch ?? 'next' },
  evidence: [],
});

const presence = (kind: 'idle-start' | 'idle-end' | 'lock' | 'unlock', when: Date): CollectedEvent => ({
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
