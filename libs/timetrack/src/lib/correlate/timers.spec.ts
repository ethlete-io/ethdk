import { describe, expect, it } from 'vitest';
import { ActivityBlock } from '../model/block';
import { ClosedTimerRun } from '../model/timer';
import { matchTimerRuns } from './timers';

const at = (hour: number, minute = 0) => new Date(2026, 7, 11, hour, minute);

const block = (from: Date, to: Date): ActivityBlock => ({ from, to, context: { appId: 'code' }, evidence: [] });

const run = (options: Partial<ClosedTimerRun> & { from: Date; to: Date }): ClosedTimerRun => ({
  id: 'run-1',
  ...options,
});

describe('matchTimerRuns', () => {
  it('proposes the run its own duration, not the time the collectors saw', () => {
    const [match] = matchTimerRuns({
      runs: [run({ from: at(14), to: at(15), issueKey: 'FIP-1' })],
      blocks: [block(at(14), at(14, 10))],
    });

    expect(match?.group.observedMs).toBe(60 * 60_000);
    expect(match?.observedMs).toBe(10 * 60_000);
  });

  it('is certain, because the user said so', () => {
    const [match] = matchTimerRuns({ runs: [run({ from: at(14), to: at(15), issueKey: 'FIP-1' })], blocks: [] });

    expect(match?.group.confidence).toBe('certain');
    expect(match?.group.issueKey).toBe('FIP-1');
  });

  it('carries no issue key until the run is named, which leaves the row unattributed', () => {
    const [match] = matchTimerRuns({ runs: [run({ from: at(14), to: at(15) })], blocks: [] });

    expect(match?.group.issueKey).toBeUndefined();
  });

  it('lends the note to the description and states the run in the evidence', () => {
    const [match] = matchTimerRuns({
      runs: [run({ from: at(14, 5), to: at(15, 20), note: 'Pairing on the importer' })],
      blocks: [],
    });

    expect(match?.group.evidence).toEqual([
      { kind: 'timer', at: at(14, 5), detail: 'timer you ran 14:05-15:20', summary: 'Pairing on the importer' },
    ]);
  });

  it('reports no observed activity for an hour away from the machine', () => {
    const [match] = matchTimerRuns({ runs: [run({ from: at(14), to: at(15) })], blocks: [block(at(9), at(11))] });

    expect(match?.observedMs).toBe(0);
  });

  it('returns the runs in start order however they arrive', () => {
    const matches = matchTimerRuns({
      runs: [run({ id: 'late', from: at(16), to: at(17) }), run({ id: 'early', from: at(9), to: at(10) })],
      blocks: [],
    });

    expect(matches.map((match) => match.run.id)).toEqual(['early', 'late']);
  });
});
