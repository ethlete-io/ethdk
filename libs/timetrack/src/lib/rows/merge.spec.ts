import { describe, expect, it } from 'vitest';
import { ActivityBlock } from '../model/block';
import { Confidence } from '../model/evidence';
import { AttributedBlock } from './attribute';
import { DEFAULT_MERGE_OPTIONS, mergeBlocks } from './merge';

const AT = (minutes: number) => new Date(new Date(2026, 7, 11, 8, 0, 0).getTime() + minutes * 60_000);

const attributed = (options: {
  fromMinute: number;
  toMinute: number;
  issueKey?: string;
  storyKey?: string;
  confidence?: Confidence;
  branch?: string;
  repoPath?: string;
}): AttributedBlock => {
  const block: ActivityBlock = {
    from: AT(options.fromMinute),
    to: AT(options.toMinute),
    context: { appId: 'code', branch: options.branch, repoPath: options.repoPath },
    evidence: [{ kind: 'branch', at: AT(options.fromMinute), detail: `branch \`${options.branch}\`` }],
  };

  return {
    block,
    issueKey: options.issueKey,
    storyKey: options.storyKey,
    confidence: options.confidence ?? 'certain',
    evidence: block.evidence,
  };
};

describe('mergeBlocks', () => {
  it('combines consecutive blocks on the same issue into one row', () => {
    const rows = mergeBlocks({
      blocks: [
        attributed({ fromMinute: 0, toMinute: 30, issueKey: 'FIP-2177' }),
        attributed({ fromMinute: 35, toMinute: 60, issueKey: 'FIP-2177' }),
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.observedMs).toBe(55 * 60_000);
    expect(rows[0]?.to).toEqual(AT(60));
  });

  it('joins one issue across a short switch to another, and books the switch to itself', () => {
    const rows = mergeBlocks({
      blocks: [
        attributed({ fromMinute: 0, toMinute: 30, issueKey: 'FIP-2177' }),
        attributed({ fromMinute: 30, toMinute: 32, issueKey: 'FIP-2222' }),
        attributed({ fromMinute: 32, toMinute: 60, issueKey: 'FIP-2177' }),
      ],
    });

    expect(rows.map((row) => row.issueKey)).toEqual(['FIP-2177', 'FIP-2222']);
    expect(rows[0]?.observedMs).toBe(58 * 60_000);
    expect(rows[1]?.observedMs).toBe(2 * 60_000);
  });

  it('does not merge the same issue across a gap wider than the threshold', () => {
    const rows = mergeBlocks({
      blocks: [
        attributed({ fromMinute: 0, toMinute: 30, issueKey: 'FIP-2177' }),
        attributed({ fromMinute: 90, toMinute: 120, issueKey: 'FIP-2177' }),
      ],
    });

    expect(rows).toHaveLength(2);
  });

  it('combines the unnamed blocks of one context into one band', () => {
    const rows = mergeBlocks({
      blocks: [
        attributed({ fromMinute: 0, toMinute: 20, confidence: 'weak', repoPath: '/a' }),
        attributed({ fromMinute: 20, toMinute: 40, confidence: 'weak', repoPath: '/a' }),
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.issueKey).toBeUndefined();
    expect(rows[0]?.observedMs).toBe(40 * 60_000);
  });

  it('joins an unnamed context across the other context that interleaved with it', () => {
    const blocks = Array.from({ length: 20 }, (_, index) => [
      attributed({ fromMinute: index * 2, toMinute: index * 2 + 1, confidence: 'weak', repoPath: '/a' }),
      attributed({ fromMinute: index * 2 + 1, toMinute: index * 2 + 2, confidence: 'weak', repoPath: '/b' }),
    ]).flat();

    const rows = mergeBlocks({ blocks });

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.observedMs)).toEqual([20 * 60_000, 20 * 60_000]);
  });

  it('keeps unnamed bands of two contexts apart', () => {
    const rows = mergeBlocks({
      blocks: [
        attributed({ fromMinute: 0, toMinute: 20, confidence: 'weak', repoPath: '/a' }),
        attributed({ fromMinute: 20, toMinute: 40, confidence: 'weak', repoPath: '/b' }),
      ],
    });

    expect(rows).toHaveLength(2);
  });

  it('does not draw a band across the idle between two short touches of one context', () => {
    const blocks = Array.from({ length: 36 }, (_, index) =>
      attributed({ fromMinute: index * 15, toMinute: index * 15 + 1, confidence: 'weak', repoPath: '/a' }),
    );

    const rows = mergeBlocks({ blocks });

    for (const row of rows) {
      expect(row.to.getTime() - row.from.getTime()).toBeLessThanOrEqual(2 * row.observedMs);
    }
  });

  it('does not merge one context across a break wider than the threshold', () => {
    const rows = mergeBlocks({
      blocks: [
        attributed({ fromMinute: 0, toMinute: 20, confidence: 'weak', repoPath: '/a' }),
        attributed({ fromMinute: 60, toMinute: 80, confidence: 'weak', repoPath: '/a' }),
      ],
    });

    expect(rows).toHaveLength(2);
  });

  it('gives a merged row the confidence tier holding most of its time', () => {
    const rows = mergeBlocks({
      blocks: [
        attributed({ fromMinute: 0, toMinute: 5, issueKey: 'FIP-2177', confidence: 'certain' }),
        attributed({ fromMinute: 5, toMinute: 120, issueKey: 'FIP-2177', confidence: 'weak' }),
      ],
    });

    expect(rows[0]?.confidence).toBe('weak');
  });

  it('does not let a short weak scrap drag a well-evidenced row into review', () => {
    const rows = mergeBlocks({
      blocks: [
        attributed({ fromMinute: 0, toMinute: 120, issueKey: 'FIP-2177', confidence: 'certain' }),
        attributed({ fromMinute: 120, toMinute: 125, issueKey: 'FIP-2177', confidence: 'weak' }),
      ],
    });

    expect(rows[0]?.confidence).toBe('certain');
  });

  it('keeps the story key when only one of the merged blocks carried it', () => {
    const rows = mergeBlocks({
      blocks: [
        attributed({ fromMinute: 0, toMinute: 30, issueKey: 'FIP-2178' }),
        attributed({ fromMinute: 30, toMinute: 60, issueKey: 'FIP-2178', storyKey: 'FIP-2177' }),
      ],
    });

    expect(rows[0]?.storyKey).toBe('FIP-2177');
  });

  it('drops a day past the row cap to fewer rows per track, without drawing one past its work', () => {
    const blocks = Array.from({ length: 6 }, (_, index) => [
      attributed({ fromMinute: index * 60, toMinute: index * 60 + 25, issueKey: 'FIP-2177' }),
      attributed({ fromMinute: index * 60 + 30, toMinute: index * 60 + 55, issueKey: 'FIP-2222' }),
    ]).flat();

    const rows = mergeBlocks({ blocks, options: { maxRowsPerDay: 4 } });

    expect(rows.length).toBeLessThan(12);
    expect(rows.filter((row) => row.issueKey === 'FIP-2177').length).toBeLessThan(6);

    for (const row of rows) {
      expect(row.to.getTime() - row.from.getTime()).toBeLessThanOrEqual(
        DEFAULT_MERGE_OPTIONS.maxLaneSpanRatio * row.observedMs,
      );
    }
  });

  it('joins short touches of one lane that the shared span cap would have kept apart', () => {
    const blocks = Array.from({ length: 12 }, (_, index) =>
      attributed({ fromMinute: index * 8, toMinute: index * 8 + 3, confidence: 'weak', repoPath: '/a' }),
    );

    const laned = mergeBlocks({ blocks });
    const shared = mergeBlocks({ blocks, options: { maxLaneSpanRatio: DEFAULT_MERGE_OPTIONS.maxSpanRatio } });

    expect(laned).toHaveLength(1);
    expect(shared.length).toBeGreaterThan(3);
  });

  it('holds a band of two lanes to the shared span cap', () => {
    const blocks = Array.from({ length: 12 }, (_, index) =>
      attributed({
        fromMinute: index * 8,
        toMinute: index * 8 + 3,
        issueKey: 'FIP-2177',
        repoPath: index % 2 ? '/a' : '/b',
      }),
    );

    const rows = mergeBlocks({ blocks });

    for (const row of rows) {
      expect(row.to.getTime() - row.from.getTime()).toBeLessThanOrEqual(
        DEFAULT_MERGE_OPTIONS.maxSpanRatio * row.observedMs,
      );
    }
  });

  it('gives no lane cap to a band whose blocks name no checkout and no application', () => {
    const blocks = Array.from({ length: 12 }, (_, index) => {
      const entry = attributed({ fromMinute: index * 8, toMinute: index * 8 + 3, issueKey: 'FIP-2177' });

      return { ...entry, block: { ...entry.block, context: {} } };
    });

    const rows = mergeBlocks({ blocks });

    for (const row of rows) {
      expect(row.to.getTime() - row.from.getTime()).toBeLessThanOrEqual(
        DEFAULT_MERGE_OPTIONS.maxSpanRatio * row.observedMs,
      );
    }
  });

  it('collapses the unnamed rows of one context too, so the cap holds for the whole day', () => {
    const blocks = Array.from({ length: 5 }, (_, index) => [
      attributed({ fromMinute: index * 60, toMinute: index * 60 + 25, issueKey: 'FIP-2177' }),
      attributed({ fromMinute: index * 60 + 30, toMinute: index * 60 + 55, confidence: 'weak', repoPath: '/a' }),
    ]).flat();

    const rows = mergeBlocks({ blocks, options: { maxRowsPerDay: 4 } });

    expect(rows.filter((row) => !row.issueKey).length).toBeLessThan(5);
    expect(rows.filter((row) => row.issueKey).length).toBeLessThan(5);
  });

  it('orders blocks by start time before merging', () => {
    const rows = mergeBlocks({
      blocks: [
        attributed({ fromMinute: 35, toMinute: 60, issueKey: 'FIP-2177' }),
        attributed({ fromMinute: 0, toMinute: 30, issueKey: 'FIP-2177' }),
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.from).toEqual(AT(0));
  });
});

describe('mergeBlocks across a break', () => {
  const work = [
    attributed({ fromMinute: 0, toMinute: 30, issueKey: 'FIP-2177' }),
    attributed({ fromMinute: 40, toMinute: 70, issueKey: 'FIP-2177' }),
  ];

  it('joins the two stretches when nothing separates them', () => {
    expect(mergeBlocks({ blocks: work })).toHaveLength(1);
  });

  it('ends the band at a break the gap holds', () => {
    const rows = mergeBlocks({ blocks: work, barriers: [{ from: AT(31), to: AT(39) }] });

    expect(rows).toHaveLength(2);
    expect(rows[0]?.to).toEqual(AT(30));
    expect(rows[1]?.from).toEqual(AT(40));
  });

  it('ends it in the no-gap-limit pass too', () => {
    const rows = mergeBlocks({
      blocks: work,
      barriers: [{ from: AT(31), to: AT(39) }],
      options: { maxRowsPerDay: 1 },
    });

    expect(rows).toHaveLength(2);
  });

  it('joins across a break that ended before the first stretch did', () => {
    expect(mergeBlocks({ blocks: work, barriers: [{ from: AT(0), to: AT(20) }] })).toHaveLength(1);
  });
});

describe('mergeBlocks and a sliver', () => {
  it('folds the focus flashes of one lane into the band they belong to', () => {
    const rows = mergeBlocks({
      blocks: [
        attributed({ fromMinute: 0, toMinute: 0.1, confidence: 'weak', repoPath: '/a' }),
        attributed({ fromMinute: 6, toMinute: 6.1, confidence: 'weak', repoPath: '/a' }),
        attributed({ fromMinute: 8, toMinute: 23, confidence: 'weak', repoPath: '/a' }),
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.from).toEqual(AT(0));
    expect(rows[0]?.observedMs).toBe(15.2 * 60_000);
  });

  it('leaves the one short touch of a lane that holds nothing else', () => {
    const rows = mergeBlocks({
      blocks: [
        attributed({ fromMinute: 0, toMinute: 0.5, confidence: 'weak', repoPath: '/a' }),
        attributed({ fromMinute: 8, toMinute: 23, confidence: 'weak', repoPath: '/b' }),
      ],
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]?.observedMs).toBe(0.5 * 60_000);
  });

  it('leaves a sliver an hour away from the work of its own lane', () => {
    const rows = mergeBlocks({
      blocks: [
        attributed({ fromMinute: 0, toMinute: 0.5, confidence: 'weak', repoPath: '/a' }),
        attributed({ fromMinute: 120, toMinute: 150, confidence: 'weak', repoPath: '/a' }),
      ],
    });

    expect(rows).toHaveLength(2);
  });
});

describe('mergeBlocks and an unobserved branch', () => {
  it('continues the checkout it belongs to, whatever branch the band names', () => {
    const rows = mergeBlocks({
      blocks: [
        attributed({ fromMinute: 0, toMinute: 20, confidence: 'weak', repoPath: '/a' }),
        attributed({ fromMinute: 20, toMinute: 40, confidence: 'weak', repoPath: '/a', branch: 'feat/x' }),
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.observedMs).toBe(40 * 60_000);
  });

  it('keeps two branches the day did observe apart', () => {
    const rows = mergeBlocks({
      blocks: [
        attributed({ fromMinute: 0, toMinute: 20, confidence: 'weak', repoPath: '/a', branch: 'feat/x' }),
        attributed({ fromMinute: 20, toMinute: 40, confidence: 'weak', repoPath: '/a', branch: 'feat/y' }),
      ],
    });

    expect(rows).toHaveLength(2);
  });
});
