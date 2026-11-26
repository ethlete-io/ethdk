import { ReviewedRow } from '@ethlete/timetrack';
import { describe, expect, it } from 'vitest';
import { foldUnattended } from './unattended-fold';

const AT = (minutes: number) => new Date(new Date(2026, 10, 19, 12, 30, 0).getTime() + minutes * 60_000);

const row = (id: string, from: number, to: number, extra: Partial<ReviewedRow> = {}) =>
  ({
    id,
    from: AT(from),
    to: AT(to),
    durationMs: (to - from) * 60_000,
    observedMs: 60_000,
    laneKey: 'repo:/dev/sdk',
    description: id,
    confidence: 'likely',
    evidence: [],
    state: 'suggested',
    edited: false,
    hidden: false,
    unattended: true,
    withheldIssueKey: 'ET-772',
    ...extra,
  }) as ReviewedRow;

describe('foldUnattended', () => {
  it('draws the unattended pieces of one issue in one lane as one band', () => {
    const folded = foldUnattended([row('a', 0, 15), row('b', 0, 15), row('c', 15, 30)]);

    expect(folded).toHaveLength(1);
    expect(folded[0]).toMatchObject({ id: 'a', from: AT(0), to: AT(30), observedMs: 180_000, folded: ['b', 'c'] });
  });

  it('draws touching accepted rows of one issue, lane and description as one block with the summed duration', () => {
    const accepted = { state: 'accepted', unattended: false, issueKey: 'FIFAGG-12769', description: 'work' } as const;
    const folded = foldUnattended([
      row('a', 15, 30, accepted),
      row('b', 30, 45, accepted),
      row('c', 60, 75, accepted),
      row('d', 45, 60, { ...accepted, description: 'other' }),
      row('e', 30, 45, { ...accepted, issueKey: 'FIFAGG-1' }),
    ]);

    expect(folded.map((kept) => kept.id)).toEqual(['a', 'c', 'd', 'e']);
    expect(folded[0]).toMatchObject({ from: AT(15), to: AT(45), durationMs: 30 * 60_000, folded: ['b'] });
  });

  it('keeps parallel accepted rows of one issue, lane and description apart', () => {
    const accepted = { state: 'accepted', unattended: false, issueKey: 'XYZ-4200', description: 'work' } as const;
    const folded = foldUnattended([
      row('one', 0, 60, accepted),
      row('two', 20, 50, accepted),
      row('next', 50, 70, accepted),
    ]);

    expect(folded.map((kept) => kept.id)).toEqual(['one', 'two']);
    expect(folded[1]).toMatchObject({ from: AT(20), to: AT(70), folded: ['next'] });
  });

  it('draws touching rows of one stand-in as one block that keeps each row its own description', () => {
    const cleanup = { withheldIssueKey: undefined, standInId: 'stand-in:1:specs-cleanup' } as const;
    const folded = foldUnattended([
      row('a', 0, 15, { ...cleanup, description: 'NX-11: cause' }),
      row('b', 15, 30, { ...cleanup, description: 'NX-11: fix ok' }),
      row('c', 30, 45, { ...cleanup, description: 'NX-11: fix ok' }),
      row('gap', 60, 75, cleanup),
      row('other', 75, 90, { ...cleanup, standInId: 'stand-in:2:specs-e2e' }),
      row('attended', 90, 105, { ...cleanup, unattended: false }),
    ]);

    expect(folded.map((kept) => kept.id)).toEqual(['a', 'gap', 'other', 'attended']);
    expect(folded[0]).toMatchObject({
      to: AT(45),
      durationMs: 45 * 60_000,
      description: 'NX-11: cause; NX-11: fix ok',
      folded: ['b', 'c'],
    });
  });

  it('keeps apart what another issue, another lane, a gap or a person separates', () => {
    const rows = [
      row('a', 0, 15),
      row('other-issue', 0, 15, { withheldIssueKey: 'ET-1' }),
      row('other-lane', 0, 15, { laneKey: 'repo:/dev/app' }),
      row('later', 30, 45),
      row('attended', 15, 30, { unattended: false }),
    ];

    expect(foldUnattended(rows).map((kept) => kept.id)).toEqual([
      'a',
      'other-issue',
      'other-lane',
      'later',
      'attended',
    ]);
  });
});
