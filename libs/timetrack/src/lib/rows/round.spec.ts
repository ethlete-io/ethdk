import { describe, expect, it } from 'vitest';
import { ActivityBlock } from '../model/block';
import { WorklogProposal } from '../model/proposal';
import { CALL_LANE_KEY } from './lane';
import { WorkGroup } from './merge';
import { checkDay, roundDurationUp } from './round';

const MINUTE = 60_000;

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

const block = (context: ActivityBlock['context']): ActivityBlock => ({
  from: new Date('2026-08-11T08:00:00Z'),
  to: new Date('2026-08-11T09:00:00Z'),
  context,
  evidence: [],
});

/** A band in a checkout, which is time a worklog can hold. */
const group = (observedMinutes: number): WorkGroup => ({
  from: new Date('2026-08-11T08:00:00Z'),
  to: new Date('2026-08-11T09:00:00Z'),
  observedMs: observedMinutes * MINUTE,
  confidence: 'weak',
  evidence: [],
  blocks: [block({ repoPath: '/home/tom/dev/ethlete-sdk' })],
});

/** A band in an application alone, which no worklog can hold. */
const appGroup = (observedMinutes: number): WorkGroup => ({
  ...group(observedMinutes),
  blocks: [block({ appId: 'firefox' })],
});

describe('roundDurationUp', () => {
  it('books any part of an increment as the whole of it', () => {
    expect(roundDurationUp(1 * MINUTE) / MINUTE).toBe(15);
    expect(roundDurationUp(16 * MINUTE) / MINUTE).toBe(30);
    expect(roundDurationUp(47 * MINUTE) / MINUTE).toBe(60);
  });

  it('leaves a whole increment where it is', () => {
    expect(roundDurationUp(15 * MINUTE) / MINUTE).toBe(15);
    expect(roundDurationUp(105 * MINUTE) / MINUTE).toBe(105);
  });

  it('books nothing for a row that observed nothing', () => {
    expect(roundDurationUp(0)).toBe(0);
  });

  it('takes the increment from the caller', () => {
    expect(roundDurationUp(11 * MINUTE, { incrementMs: 5 * MINUTE }) / MINUTE).toBe(15);
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

  it('counts what Tempo already holds towards the target', () => {
    const check = checkDay({
      proposals: [proposal({ issueKey: 'FIP-2177', durationMinutes: 60 })],
      options: { targetMs: 480 * MINUTE, coveredMs: 420 * MINUTE },
    });

    expect(check.warnings).toEqual([]);
    expect(check.proposedMs).toBe(60 * MINUTE);
    expect(check.coveredMs).toBe(420 * MINUTE);
    expect(check.loggedMs).toBe(480 * MINUTE);
    expect(check.deltaMs).toBe(0);
  });

  it('names both halves of a covered day in the warning', () => {
    const check = checkDay({ proposals: [], options: { targetMs: 480 * MINUTE, coveredMs: 120 * MINUTE } });

    expect(check.warnings[0]?.kind).toBe('under-target');
    expect(check.warnings[0]?.detail).toBe('0m proposed and 2h 0m already in Tempo, against a 8h 0m target');
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

  it('counts a band nobody was at apart from the time waiting for a name', () => {
    const check = checkDay({
      proposals: [proposal({ issueKey: 'FIP-2177', durationMinutes: 240 })],
      unattributed: [group(45), { ...group(90), attended: false }],
    });

    expect(check.unattributedMs).toBe(45 * MINUTE);
    expect(check.unattendedMs).toBe(90 * MINUTE);
    expect(check.warnings.map((warning) => warning.kind)).toEqual(['unattributed-time', 'unattended-time']);
  });

  it('leaves time in an application alone out of the unattributed total', () => {
    const check = checkDay({
      proposals: [proposal({ issueKey: 'FIP-2177', durationMinutes: 240 })],
      unattributed: [group(45), appGroup(120)],
    });

    expect(check.unattributedMs).toBe(45 * MINUTE);
    expect(check.warnings[0]?.detail).toBe('45m in ethlete-sdk');
  });

  it('says which lane each band of unnamed work sits in, longest first', () => {
    const check = checkDay({
      proposals: [],
      unattributed: [group(45), { ...group(20), laneKey: CALL_LANE_KEY, blocks: [] }],
    });

    expect(check.warnings[0]?.detail).toBe('1h 5m: ethlete-sdk 45m, calls 20m');
  });

  it('counts a call nothing named, which a worklog can hold', () => {
    const check = checkDay({
      proposals: [],
      unattributed: [{ ...group(30), blocks: [], laneKey: CALL_LANE_KEY }],
    });

    expect(check.unattributedMs).toBe(30 * MINUTE);
  });

  it('says nothing about a day made only of application time', () => {
    const check = checkDay({ proposals: [], unattributed: [appGroup(120)] });

    expect(check.unattributedMs).toBe(0);
    expect(check.warnings).toEqual([]);
  });

  it('holds the under-target warning back while the day is still running', () => {
    const check = checkDay({
      proposals: [proposal({ issueKey: 'FIP-2177', durationMinutes: 120 })],
      options: { targetMs: 480 * MINUTE, finished: false },
    });

    expect(check.deltaMs).toBe(-360 * MINUTE);
    expect(check.warnings).toEqual([]);
  });

  it('warns under target once the day is over', () => {
    const check = checkDay({
      proposals: [proposal({ issueKey: 'FIP-2177', durationMinutes: 120 })],
      options: { targetMs: 480 * MINUTE, finished: true },
    });

    expect(check.warnings.map((warning) => warning.kind)).toEqual(['under-target']);
  });

  it('warns over target on a day still running, which no more work can fix', () => {
    const check = checkDay({
      proposals: [proposal({ issueKey: 'FIP-2177', durationMinutes: 600 })],
      options: { targetMs: 480 * MINUTE, finished: false },
    });

    expect(check.warnings.map((warning) => warning.kind)).toEqual(['over-target']);
  });

  it('warns when a day is still above the row cap after consolidation', () => {
    const check = checkDay({
      proposals: Array.from({ length: 5 }, (_, index) => proposal({ issueKey: `FIP-${index}`, durationMinutes: 30 })),
      options: { maxRowsPerDay: 4 },
    });

    expect(check.warnings.map((warning) => warning.kind)).toEqual(['too-many-rows']);
  });

  it('reports time a call and observed activity both claim, above a minute of noise', () => {
    const proposals = [proposal({ issueKey: 'FIP-2177', durationMinutes: 240 })];
    const overlap = (minutes: number) => [
      { label: 'FIFAGG-12652', from: new Date('2026-09-14T09:55:00'), overlapMs: minutes * MINUTE },
    ];

    expect(
      checkDay({ proposals, options: { meetingOverlaps: overlap(30) } }).warnings.map((warning) => warning.kind),
    ).toEqual(['meeting-overlap']);
    expect(checkDay({ proposals, options: { meetingOverlaps: overlap(1) } }).warnings).toEqual([]);
  });

  it('names each call the overlap is under, and when it ran', () => {
    const check = checkDay({
      proposals: [proposal({ issueKey: 'FIP-2177', durationMinutes: 240 })],
      options: {
        meetingOverlaps: [
          { label: 'BD-2049', from: new Date('2026-09-14T09:21:00'), overlapMs: 5 * MINUTE },
          { label: 'FIFAGG-12652', from: new Date('2026-09-14T09:55:00'), overlapMs: 17 * MINUTE },
        ],
      },
    });

    expect(check.warnings[0]?.detail).toBe('17m during the 09:55 call FIFAGG-12652, 5m during the 09:21 call BD-2049');
  });

  it('names the rows that rounded to nothing', () => {
    const check = checkDay({ proposals: [proposal({ issueKey: 'FIP-2222', durationMinutes: 0 })] });

    expect(check.warnings[0]?.kind).toBe('zero-duration');
    expect(check.warnings[0]?.detail).toContain('FIP-2222');
  });
});
