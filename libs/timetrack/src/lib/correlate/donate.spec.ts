import { describe, expect, it } from 'vitest';
import { ActivityBlock } from '../model/block';
import { AttributedBlock } from './attribute';
import { donateBlocks } from './donate';
import { AttributionRule } from './rules';

const SDK = '/home/you/dev/shared-sdk';
const APP = '/home/you/dev/abc-frontend';

const DONOR_RULE: AttributionRule = {
  id: 'rule-donor',
  repoPath: SDK,
  target: { kind: 'donate' },
  createdAt: new Date('2026-08-01T00:00:00Z'),
};

const block = (repoPath: string, from: string, to: string): ActivityBlock => ({
  from: new Date(from),
  to: new Date(to),
  context: { repoPath, branch: 'next' },
  evidence: [],
});

const attributed = (repoPath: string, from: string, to: string, issueKey?: string): AttributedBlock => ({
  block: block(repoPath, from, to),
  issueKey,
  confidence: issueKey ? 'likely' : 'weak',
  evidence: [],
});

describe('donateBlocks', () => {
  it('gives a donating repository the issue of the work beside it', () => {
    const [donor] = donateBlocks({
      blocks: [
        attributed(SDK, '2026-08-13T10:00:00Z', '2026-08-13T11:00:00Z'),
        attributed(APP, '2026-08-13T11:30:00Z', '2026-08-13T13:00:00Z', 'ABC-2904'),
      ],
      rules: [DONOR_RULE],
    });

    expect(donor?.issueKey).toBe('ABC-2904');
    expect(donor?.confidence).toBe('weak');
    expect(donor?.evidence.at(-1)?.detail).toBe(
      '`shared-sdk` files no issues; logged with the work on ABC-2904 beside it',
    );
  });

  it('takes the nearest work rather than the first', () => {
    const [donor] = donateBlocks({
      blocks: [
        attributed(SDK, '2026-08-13T12:00:00Z', '2026-08-13T13:00:00Z'),
        attributed(APP, '2026-08-13T08:00:00Z', '2026-08-13T09:00:00Z', 'ABC-1000'),
        attributed(APP, '2026-08-13T13:15:00Z', '2026-08-13T15:00:00Z', 'ABC-2904'),
      ],
      rules: [DONOR_RULE],
    });

    expect(donor?.issueKey).toBe('ABC-2904');
  });

  /** A library is changed for something, and the thing it was changed for is usually what comes next. */
  it('gives a tie to the work that followed', () => {
    const [donor] = donateBlocks({
      blocks: [
        attributed(SDK, '2026-08-13T12:00:00Z', '2026-08-13T13:00:00Z'),
        attributed(APP, '2026-08-13T11:00:00Z', '2026-08-13T11:30:00Z', 'ABC-1000'),
        attributed(APP, '2026-08-13T13:30:00Z', '2026-08-13T15:00:00Z', 'ABC-2904'),
      ],
      rules: [DONOR_RULE],
    });

    expect(donor?.issueKey).toBe('ABC-2904');
  });

  it('leaves a donor with nothing near it unattributed', () => {
    const [donor] = donateBlocks({
      blocks: [
        attributed(SDK, '2026-08-13T09:00:00Z', '2026-08-13T10:00:00Z'),
        attributed(APP, '2026-08-13T20:00:00Z', '2026-08-13T21:00:00Z', 'ABC-2904'),
      ],
      rules: [DONOR_RULE],
    });

    expect(donor?.issueKey).toBeUndefined();
  });

  it('leaves a block the ladder already attributed alone', () => {
    const [donor] = donateBlocks({
      blocks: [
        attributed(SDK, '2026-08-13T10:00:00Z', '2026-08-13T11:00:00Z', 'ETH-1'),
        attributed(APP, '2026-08-13T11:30:00Z', '2026-08-13T13:00:00Z', 'ABC-2904'),
      ],
      rules: [DONOR_RULE],
    });

    expect(donor?.issueKey).toBe('ETH-1');
  });

  it('does not donate from a repository no rule names', () => {
    const [donor] = donateBlocks({
      blocks: [
        attributed('/Users/tom/dev/other', '2026-08-13T10:00:00Z', '2026-08-13T11:00:00Z'),
        attributed(APP, '2026-08-13T11:30:00Z', '2026-08-13T13:00:00Z', 'ABC-2904'),
      ],
      rules: [DONOR_RULE],
    });

    expect(donor?.issueKey).toBeUndefined();
  });

  it('leaves a donor too long to be a favour for something else unattributed', () => {
    const [donor] = donateBlocks({
      blocks: [
        attributed(SDK, '2026-08-13T08:00:00Z', '2026-08-13T11:00:00Z'),
        attributed(APP, '2026-08-13T11:30:00Z', '2026-08-13T13:00:00Z', 'ABC-2904'),
      ],
      rules: [DONOR_RULE],
    });

    expect(donor?.issueKey).toBeUndefined();
  });

  it('still folds a long donor in when the caller raised the limit', () => {
    const [donor] = donateBlocks({
      blocks: [
        attributed(SDK, '2026-08-13T08:00:00Z', '2026-08-13T11:00:00Z'),
        attributed(APP, '2026-08-13T11:30:00Z', '2026-08-13T13:00:00Z', 'ABC-2904'),
      ],
      rules: [DONOR_RULE],
      options: { maxDonationBlockMs: 4 * 60 * 60_000 },
    });

    expect(donor?.issueKey).toBe('ABC-2904');
  });
});
