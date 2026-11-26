import { describe, expect, it } from 'vitest';
import { WorklogProposal } from '../model/proposal';
import { subtractForeignTime } from './subtract';

const HOUR = 3_600_000;

const proposal = (overrides: Partial<WorklogProposal>): WorklogProposal => ({
  id: 'p1',
  issueKey: 'FIP-3010',
  from: new Date(2026, 7, 11, 9, 0),
  to: new Date(2026, 7, 11, 10, 0),
  durationMs: HOUR,
  observedMs: HOUR,
  description: 'Logout on idle',
  confidence: 'certain',
  evidence: [],
  state: 'accepted',
  ...overrides,
});

describe('subtractForeignTime', () => {
  it('leaves a day tempo knows nothing about untouched', () => {
    const proposals = [proposal({})];
    const result = subtractForeignTime({ proposals, foreign: [] });

    expect(result.proposals[0]).toBe(proposals[0]);
    expect(result.subtractions).toEqual([]);
    expect(result.coveredProposalIds).toEqual([]);
    expect(result.unmatchedMs).toBe(0);
  });

  it('reduces a proposal by time already logged against the same issue', () => {
    const result = subtractForeignTime({
      proposals: [proposal({ durationMs: 2 * HOUR })],
      foreign: [{ issueKey: 'FIP-3010', from: new Date(2026, 7, 11, 14, 0), durationMs: HOUR }],
    });

    expect(result.proposals[0]?.durationMs).toBe(HOUR);
    expect(result.subtractions).toEqual([
      { proposalId: 'p1', issueKey: 'FIP-3010', subtractedMs: HOUR, remainingMs: HOUR },
    ]);
    expect(result.unmatchedMs).toBe(0);
  });

  it('marks a proposal tempo already accounts for in full as covered', () => {
    const result = subtractForeignTime({
      proposals: [proposal({})],
      foreign: [{ issueKey: 'FIP-3010', from: new Date(2026, 7, 11, 9, 0), durationMs: HOUR }],
    });

    expect(result.proposals[0]?.durationMs).toBe(0);
    expect(result.coveredProposalIds).toEqual(['p1']);
  });

  it('spends foreign time on the earliest proposal first', () => {
    const result = subtractForeignTime({
      proposals: [
        proposal({ id: 'late', from: new Date(2026, 7, 11, 15, 0) }),
        proposal({ id: 'early', from: new Date(2026, 7, 11, 9, 0) }),
      ],
      foreign: [{ issueKey: 'FIP-3010', from: new Date(2026, 7, 11, 12, 0), durationMs: HOUR }],
    });

    expect(result.coveredProposalIds).toEqual(['early']);
    expect(result.proposals.map((entry) => [entry.id, entry.durationMs])).toEqual([
      ['late', HOUR],
      ['early', 0],
    ]);
  });

  it('never drives a duration negative, and reports the overflow as already-accounted time', () => {
    const result = subtractForeignTime({
      proposals: [proposal({})],
      foreign: [{ issueKey: 'FIP-3010', from: new Date(2026, 7, 11, 9, 0), durationMs: 3 * HOUR }],
    });

    expect(result.proposals[0]?.durationMs).toBe(0);
    expect(result.unmatchedMs).toBe(2 * HOUR);
  });

  it('reports foreign time on an issue the day proposed nothing for', () => {
    const result = subtractForeignTime({
      proposals: [proposal({})],
      foreign: [
        { issueKey: 'FIP-3010', from: new Date(2026, 7, 11, 9, 0), durationMs: HOUR },
        { issueKey: 'FIP-9999', from: new Date(2026, 7, 11, 13, 0), durationMs: 2 * HOUR },
      ],
    });

    expect(result.unmatchedMs).toBe(2 * HOUR);
  });

  it('sums several foreign worklogs on one issue', () => {
    const result = subtractForeignTime({
      proposals: [proposal({ durationMs: 4 * HOUR })],
      foreign: [
        { issueKey: 'FIP-3010', from: new Date(2026, 7, 11, 9, 0), durationMs: HOUR },
        { issueKey: 'FIP-3010', from: new Date(2026, 7, 11, 11, 0), durationMs: HOUR },
      ],
    });

    expect(result.proposals[0]?.durationMs).toBe(2 * HOUR);
  });

  it('keeps a proposal that had already rounded to nothing out of the covered set', () => {
    const result = subtractForeignTime({ proposals: [proposal({ durationMs: 0 })], foreign: [] });

    expect(result.coveredProposalIds).toEqual([]);
    expect(result.proposals).toHaveLength(1);
  });

  it('only spends foreign time on the issue it was logged against', () => {
    const result = subtractForeignTime({
      proposals: [proposal({ id: 'other', issueKey: 'FIP-4000' })],
      foreign: [{ issueKey: 'FIP-3010', from: new Date(2026, 7, 11, 9, 0), durationMs: HOUR }],
    });

    expect(result.proposals[0]?.durationMs).toBe(HOUR);
    expect(result.unmatchedMs).toBe(HOUR);
  });
});
