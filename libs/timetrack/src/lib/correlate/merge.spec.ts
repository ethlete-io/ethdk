import { describe, expect, it } from 'vitest';
import { ActivityBlock } from '../model/block';
import { Confidence } from '../model/evidence';
import { AttributedBlock } from './attribute';
import { mergeBlocks } from './merge';

const AT = (minutes: number) => new Date(new Date(2026, 7, 11, 8, 0, 0).getTime() + minutes * 60_000);

const attributed = (options: {
  fromMinute: number;
  toMinute: number;
  issueKey?: string;
  storyKey?: string;
  confidence?: Confidence;
  branch?: string;
}): AttributedBlock => {
  const block: ActivityBlock = {
    from: AT(options.fromMinute),
    to: AT(options.toMinute),
    context: { appId: 'code', branch: options.branch },
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

  it('keeps a context switch separate however short it was', () => {
    const rows = mergeBlocks({
      blocks: [
        attributed({ fromMinute: 0, toMinute: 30, issueKey: 'FIP-2177' }),
        attributed({ fromMinute: 30, toMinute: 32, issueKey: 'FIP-2222' }),
        attributed({ fromMinute: 32, toMinute: 60, issueKey: 'FIP-2177' }),
      ],
    });

    expect(rows.map((row) => row.issueKey)).toEqual(['FIP-2177', 'FIP-2222', 'FIP-2177']);
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

  it('never merges blocks nothing could attribute', () => {
    const rows = mergeBlocks({
      blocks: [
        attributed({ fromMinute: 0, toMinute: 20, confidence: 'weak' }),
        attributed({ fromMinute: 20, toMinute: 40, confidence: 'weak' }),
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

  it('collapses a day past the row cap into one row per issue, gaps and all', () => {
    const blocks = Array.from({ length: 6 }, (_, index) => [
      attributed({ fromMinute: index * 60, toMinute: index * 60 + 25, issueKey: 'FIP-2177' }),
      attributed({ fromMinute: index * 60 + 30, toMinute: index * 60 + 55, issueKey: 'FIP-2222' }),
    ]).flat();

    const rows = mergeBlocks({ blocks, options: { maxRowsPerDay: 4 } });

    expect(rows.map((row) => row.issueKey)).toEqual(['FIP-2177', 'FIP-2222']);
    expect(rows[0]?.observedMs).toBe(6 * 25 * 60_000);
    expect(rows[0]?.to).toEqual(AT(5 * 60 + 25));
  });

  it('leaves unattributed rows out of the collapse so each stays its own question', () => {
    const blocks = Array.from({ length: 5 }, (_, index) => [
      attributed({ fromMinute: index * 60, toMinute: index * 60 + 25, issueKey: 'FIP-2177' }),
      attributed({ fromMinute: index * 60 + 30, toMinute: index * 60 + 55, confidence: 'weak' }),
    ]).flat();

    const rows = mergeBlocks({ blocks, options: { maxRowsPerDay: 4 } });

    expect(rows.filter((row) => !row.issueKey)).toHaveLength(5);
    expect(rows.filter((row) => row.issueKey)).toHaveLength(1);
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
