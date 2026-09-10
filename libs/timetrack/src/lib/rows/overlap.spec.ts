import { describe, expect, it } from 'vitest';
import { ActivityBlock } from '../model/block';
import { Evidence } from '../model/evidence';
import { clipBlocks, overlapMs } from './overlap';

const at = (hour: number, minute = 0) => new Date(2026, 7, 11, hour, minute);

const evidence = (when: Date, detail: string): Evidence => ({ kind: 'window-title', at: when, detail });

const block = (from: Date, to: Date, entries: Evidence[] = []): ActivityBlock => ({
  from,
  to,
  context: { appId: 'code' },
  evidence: entries,
});

const spans = (blocks: ActivityBlock[]) => blocks.map((piece) => [piece.from.getHours(), piece.to.getHours()]);

describe('overlapMs', () => {
  it('measures only the part of the block inside the window', () => {
    expect(overlapMs({ block: block(at(9), at(11)), window: { from: at(10), to: at(12) } })).toBe(60 * 60_000);
  });

  it('is zero for a block that ends where the window begins', () => {
    expect(overlapMs({ block: block(at(9), at(10)), window: { from: at(10), to: at(12) } })).toBe(0);
  });
});

describe('clipBlocks', () => {
  it('returns the blocks untouched when there is nothing to cut', () => {
    expect(spans(clipBlocks({ blocks: [block(at(9), at(11))], windows: [] }))).toEqual([[9, 11]]);
  });

  it('splits a block a window falls inside of', () => {
    const clipped = clipBlocks({ blocks: [block(at(9), at(15))], windows: [{ from: at(11), to: at(13) }] });

    expect(spans(clipped)).toEqual([
      [9, 11],
      [13, 15],
    ]);
  });

  it('drops a block the window swallows whole', () => {
    expect(clipBlocks({ blocks: [block(at(11), at(12))], windows: [{ from: at(10), to: at(13) }] })).toEqual([]);
  });

  it('trims a block the window only overlaps at one end', () => {
    expect(spans(clipBlocks({ blocks: [block(at(9), at(12))], windows: [{ from: at(11), to: at(13) }] }))).toEqual([
      [9, 11],
    ]);
    expect(spans(clipBlocks({ blocks: [block(at(12), at(16))], windows: [{ from: at(11), to: at(13) }] }))).toEqual([
      [13, 16],
    ]);
  });

  it('cuts every window out, not only the first', () => {
    const clipped = clipBlocks({
      blocks: [block(at(8), at(18))],
      windows: [
        { from: at(10), to: at(11) },
        { from: at(14), to: at(15) },
      ],
    });

    expect(spans(clipped)).toEqual([
      [8, 10],
      [11, 14],
      [15, 18],
    ]);
  });

  it('leaves each piece only the evidence observed inside it', () => {
    const clipped = clipBlocks({
      blocks: [
        block(at(9), at(15), [evidence(at(9, 30), 'before'), evidence(at(12), 'during'), evidence(at(14), 'after')]),
      ],
      windows: [{ from: at(11), to: at(13) }],
    });

    expect(clipped.map((piece) => piece.evidence.map((entry) => entry.detail))).toEqual([['before'], ['after']]);
  });

  it('keeps the context of the block it came from', () => {
    const clipped = clipBlocks({
      blocks: [{ ...block(at(9), at(15)), context: { repoPath: '/dev/sdk', branch: 'next' } }],
      windows: [{ from: at(11), to: at(13) }],
    });

    expect(clipped.every((piece) => piece.context.branch === 'next')).toBe(true);
  });
});
