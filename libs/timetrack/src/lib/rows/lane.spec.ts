import { describe, expect, it } from 'vitest';
import { ActivityBlock, ActivityContext } from '../model/block';
import { laneKeyOf } from './lane';

const AT = (minutes: number) => new Date(new Date(2026, 7, 11, 8, 0, 0).getTime() + minutes * 60_000);

const block = (fromMinute: number, toMinute: number, context: ActivityContext): ActivityBlock => ({
  from: AT(fromMinute),
  to: AT(toMinute),
  context,
  evidence: [],
});

describe('laneKeyOf', () => {
  it('reads the checkout of a row that never left one', () => {
    expect(laneKeyOf([block(0, 20, { repoPath: '/dev/sdk', branch: 'a' })])).toBe('repo:/dev/sdk');
  });

  it('ignores the branch, so a row that switched branch keeps one lane', () => {
    const blocks = [
      block(0, 20, { repoPath: '/dev/sdk', branch: 'a' }),
      block(20, 40, { repoPath: '/dev/sdk', branch: 'b' }),
    ];

    expect(laneKeyOf(blocks)).toBe('repo:/dev/sdk');
  });

  it('takes the checkout that holds most of the time, not the first one seen', () => {
    const blocks = [block(0, 5, { repoPath: '/dev/other' }), block(5, 45, { repoPath: '/dev/sdk' })];

    expect(laneKeyOf(blocks)).toBe('repo:/dev/sdk');
  });

  it('lanes a row with no checkout by its application', () => {
    expect(laneKeyOf([block(0, 20, { appId: 'slack' })])).toBe('app:slack');
  });

  it('gives no lane to blocks that resolved to nothing', () => {
    expect(laneKeyOf([block(0, 20, {})])).toBeUndefined();
  });

  it('gives no lane to an empty row', () => {
    expect(laneKeyOf([])).toBeUndefined();
  });
});
