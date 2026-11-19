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
