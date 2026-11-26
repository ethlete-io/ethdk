import { describe, expect, it } from 'vitest';
import { ActivityBlock } from '../model/block';
import { stretchesOf } from './stretches';

const AT = (minutes: number) => new Date(new Date(2026, 7, 11, 8, 0, 0).getTime() + minutes * 60_000);

const block = (fromMinute: number, toMinute: number): ActivityBlock => ({
  from: AT(fromMinute),
  to: AT(toMinute),
  context: { appId: 'code' },
  evidence: [],
});

describe('stretchesOf', () => {
  it('reads touching blocks as one stretch', () => {
    expect(stretchesOf([block(0, 20), block(20, 40)])).toEqual([{ from: AT(0), to: AT(40) }]);
  });

  it('joins across a gap shorter than the work already in the stretch', () => {
    expect(stretchesOf([block(0, 20), block(25, 45)])).toEqual([{ from: AT(0), to: AT(45) }]);
  });

  it('keeps two stretches apart when the gap is longer than the work before it', () => {
    expect(stretchesOf([block(0, 5), block(20, 40)])).toEqual([
      { from: AT(0), to: AT(5) },
      { from: AT(20), to: AT(40) },
    ]);
  });

  it('orders blocks before reading them', () => {
    expect(stretchesOf([block(20, 40), block(0, 20)])).toEqual([{ from: AT(0), to: AT(40) }]);
  });
});
