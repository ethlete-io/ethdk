import { describe, expect, it } from 'vitest';
import { WorklogProposal } from '../model/proposal';
import { WorkGroup } from './merge';
import { checkDay, roundDurations } from './round';

const MINUTE = 60_000;
const minutes = (values: number[]) => values.map((value) => value * MINUTE);
const asMinutes = (values: number[]) => values.map((value) => value / MINUTE);

const proposal = (options: { issueKey: string; durationMinutes: number }): WorklogProposal => ({
  id: `${options.issueKey}@2026-08-11T08:00:00.000Z`,
  issueKey: options.issueKey,
  from: new Date('2026-08-11T08:00:00Z'),
  to: new Date('2026-08-11T09:00:00Z'),
  durationMs: options.durationMinutes * MINUTE,
  observedMs: options.durationMinutes * MINUTE,
  description: 'work',
  confidence: 'certain',
  evidence: [],
  state: 'suggested',
});

const group = (observedMinutes: number): WorkGroup => ({
  from: new Date('2026-08-11T08:00:00Z'),
  to: new Date('2026-08-11T09:00:00Z'),
  observedMs: observedMinutes * MINUTE,
  confidence: 'weak',
  evidence: [],
  blocks: [],
});

describe('roundDurations', () => {
  it('leaves durations that are already whole increments alone', () => {
    expect(asMinutes(roundDurations({ durationsMs: minutes([90, 30]) }))).toEqual([90, 30]);
  });

  it('preserves the day total instead of rounding every row on its own', () => {
    const rounded = roundDurations({ durationsMs: minutes([50, 40, 30]) });

    expect(asMinutes(rounded)).toEqual([45, 45, 30]);
    expect(rounded.reduce((sum, ms) => sum + ms, 0)).toBe(120 * MINUTE);
  });

  it('keeps a row that would round away, taking the increment from the longest row', () => {
    const rounded = roundDurations({ durationsMs: minutes([235, 4]) });

    expect(asMinutes(rounded)).toEqual([225, 15]);
    expect(rounded.reduce((sum, ms) => sum + ms, 0)).toBe(240 * MINUTE);
  });

  it('gives a lone sub-increment row one increment rather than nothing', () => {
    expect(asMinutes(roundDurations({ durationsMs: minutes([4]) }))).toEqual([15]);
  });

  it('leaves a row at zero when there is no increment to spare', () => {
    expect(asMinutes(roundDurations({ durationsMs: minutes([4, 4]) }))).toEqual([15, 0]);
  });

  it('does not invent time for a row that observed none', () => {
    expect(asMinutes(roundDurations({ durationsMs: minutes([0, 60]) }))).toEqual([0, 60]);
  });

  it('honours a different increment', () => {
    expect(asMinutes(roundDurations({ durationsMs: minutes([22, 17]), options: { incrementMs: 5 * MINUTE } }))).toEqual(
      [25, 15],
    );
  });

  it('returns nothing for an empty day', () => {
    expect(roundDurations({ durationsMs: [] })).toEqual([]);
  });
});

describe('checkDay', () => {
  it('reports the proposed total and stays quiet without a target', () => {
    const check = checkDay({ proposals: [proposal({ issueKey: 'FIP-2177', durationMinutes: 240 })] });

    expect(check.proposedMs).toBe(240 * MINUTE);
    expect(check.targetMs).toBeUndefined();
    expect(check.deltaMs).toBeUndefined();
    expect(check.warnings).toEqual([]);
  });

  it('warns under target without filling the day', () => {
    const check = checkDay({
      proposals: [proposal({ issueKey: 'FIP-2177', durationMinutes: 300 })],
      options: { targetMs: 480 * MINUTE },
    });

    expect(check.warnings.map((warning) => warning.kind)).toEqual(['under-target']);
    expect(check.deltaMs).toBe(-180 * MINUTE);
    expect(check.proposedMs).toBe(300 * MINUTE);
  });

  it('warns over target', () => {
    const check = checkDay({
      proposals: [proposal({ issueKey: 'FIP-2177', durationMinutes: 600 })],
      options: { targetMs: 480 * MINUTE },
    });

    expect(check.warnings.map((warning) => warning.kind)).toEqual(['over-target']);
    expect(check.deltaMs).toBe(120 * MINUTE);
  });

  it('does not warn inside the tolerance', () => {
    const check = checkDay({
      proposals: [proposal({ issueKey: 'FIP-2177', durationMinutes: 470 })],
      options: { targetMs: 480 * MINUTE },
    });

    expect(check.warnings).toEqual([]);
  });

  it('surfaces unattributed time without counting it as proposed', () => {
    const check = checkDay({
      proposals: [proposal({ issueKey: 'FIP-2177', durationMinutes: 240 })],
      unattributed: [group(45)],
    });

    expect(check.unattributedMs).toBe(45 * MINUTE);
    expect(check.proposedMs).toBe(240 * MINUTE);
    expect(check.warnings.map((warning) => warning.kind)).toEqual(['unattributed-time']);
  });

  it('warns when a day is still above the row cap after consolidation', () => {
    const check = checkDay({
      proposals: Array.from({ length: 5 }, (_, index) => proposal({ issueKey: `FIP-${index}`, durationMinutes: 30 })),
      options: { maxRowsPerDay: 4 },
    });

    expect(check.warnings.map((warning) => warning.kind)).toEqual(['too-many-rows']);
  });

  it('names the rows that rounded to nothing', () => {
    const check = checkDay({ proposals: [proposal({ issueKey: 'FIP-2222', durationMinutes: 0 })] });

    expect(check.warnings[0]?.kind).toBe('zero-duration');
    expect(check.warnings[0]?.detail).toContain('FIP-2222');
  });
});
