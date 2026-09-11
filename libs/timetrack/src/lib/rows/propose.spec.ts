import { resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { describe, expect, it } from 'vitest';
import { Confidence, Evidence } from '../model/evidence';
import { CALL_LANE_KEY } from './lane';
import { WorkGroup } from './merge';
import { propose } from './propose';

const MINUTE = 60_000;
const AT = (minute: number) => new Date(new Date(2026, 7, 11, 8, 0, 0).getTime() + minute * MINUTE);
const FIP = resolveGitFlowConfig({ keyPrefixes: ['FIP'] });

const group = (options: {
  fromMinute: number;
  observedMinutes: number;
  issueKey?: string;
  storyKey?: string;
  confidence?: Confidence;
  evidence?: Evidence[];
  branch?: string;
}): WorkGroup => ({
  issueKey: options.issueKey,
  storyKey: options.storyKey,
  from: AT(options.fromMinute),
  to: AT(options.fromMinute + options.observedMinutes),
  observedMs: options.observedMinutes * MINUTE,
  confidence: options.confidence ?? 'certain',
  evidence: options.evidence ?? [],
  blocks: [
    {
      from: AT(options.fromMinute),
      to: AT(options.fromMinute + options.observedMinutes),
      context: { branch: options.branch },
      evidence: options.evidence ?? [],
    },
  ],
});

describe('propose', () => {
  it('builds a reviewable worklog out of a group', () => {
    const { proposals } = propose({
      groups: [
        group({
          fromMinute: 0,
          observedMinutes: 90,
          issueKey: 'FIP-2178',
          storyKey: 'FIP-2177',
          branch: 'sub/feat/FIP-2177-user-management/FIP-2178-user-password-reset',
          evidence: [
            {
              kind: 'commit',
              at: AT(30),
              detail: 'abc1234 feat(auth): Add the reset form',
              summary: 'feat(auth): Add the reset form',
            },
          ],
        }),
      ],
      config: FIP,
    });

    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({
      issueKey: 'FIP-2178',
      storyKey: 'FIP-2177',
      durationMs: 90 * MINUTE,
      observedMs: 90 * MINUTE,
      description: 'feat(auth): Add the reset form',
      confidence: 'certain',
      state: 'suggested',
    });
  });

  it('gives a proposal an id that survives re-running the same day', () => {
    const day = [group({ fromMinute: 0, observedMinutes: 60, issueKey: 'FIP-2177' })];

    expect(propose({ groups: day }).proposals[0]?.id).toBe(propose({ groups: day }).proposals[0]?.id);
  });

  it('books each row up to a whole increment and keeps the observed time beside it', () => {
    const { proposals } = propose({
      groups: [
        group({ fromMinute: 0, observedMinutes: 50, issueKey: 'FIP-2177' }),
        group({ fromMinute: 60, observedMinutes: 40, issueKey: 'FIP-2222' }),
        group({ fromMinute: 120, observedMinutes: 30, issueKey: 'FIP-2333' }),
      ],
    });

    expect(proposals.map((proposal) => proposal.durationMs / MINUTE)).toEqual([60, 45, 30]);
    expect(proposals.map((proposal) => proposal.observedMs / MINUTE)).toEqual([50, 40, 30]);
  });

  it('hands unattributed groups back untouched rather than forcing them into a row', () => {
    const { proposals, unattributed } = propose({
      groups: [
        group({ fromMinute: 0, observedMinutes: 60, issueKey: 'FIP-2177' }),
        group({ fromMinute: 60, observedMinutes: 20, confidence: 'weak' }),
      ],
    });

    expect(proposals).toHaveLength(1);
    expect(unattributed).toHaveLength(1);
    expect(unattributed[0]?.observedMs).toBe(20 * MINUTE);
  });

  it('books a row from its own time alone, whatever else the day holds', () => {
    const { proposals } = propose({
      groups: [
        group({ fromMinute: 0, observedMinutes: 50, issueKey: 'FIP-2177' }),
        group({ fromMinute: 60, observedMinutes: 7, confidence: 'weak' }),
      ],
    });

    expect(proposals[0]?.durationMs).toBe(60 * MINUTE);
  });

  it('carries the evidence chain onto the proposal', () => {
    const evidence: Evidence[] = [
      { kind: 'branch', at: AT(0), detail: 'branch `feat/FIP-2177-user-management` checked out' },
      { kind: 'inherited-branch', at: AT(0), detail: 'inherited FIP-2177' },
    ];

    const { proposals } = propose({
      groups: [group({ fromMinute: 0, observedMinutes: 60, issueKey: 'FIP-2177', evidence })],
    });

    expect(proposals[0]?.evidence.map((entry) => entry.kind)).toEqual(['branch', 'inherited-branch']);
  });
});

describe('propose, the work nothing named', () => {
  it('draws an unattributed group as a row of its own', () => {
    const { proposals, unattributed, unnamed } = propose({
      groups: [group({ fromMinute: 0, observedMinutes: 45 })],
      config: FIP,
    });

    expect(proposals).toEqual([]);
    expect(unattributed).toHaveLength(1);
    expect(unnamed).toHaveLength(1);
    expect(unnamed[0]).toMatchObject({ observedMs: 45 * MINUTE, description: 'unattributed activity' });
  });

  it('keeps two contexts that started together apart', () => {
    const inRepo = (repoPath: string): WorkGroup => {
      const base = group({ fromMinute: 0, observedMinutes: 30 });

      return { ...base, blocks: base.blocks.map((block) => ({ ...block, context: { repoPath } })) };
    };

    const { unnamed } = propose({ groups: [inRepo('/dev/a'), inRepo('/dev/b')] });

    expect(new Set(unnamed.map((row) => row.id)).size).toBe(2);
  });

  it('books a whole increment too, so naming it never changes its size', () => {
    const { unnamed } = propose({ groups: [group({ fromMinute: 0, observedMinutes: 47 })] });

    expect(unnamed[0]?.durationMs).toBe(60 * MINUTE);
    expect(unnamed[0]?.observedMs).toBe(47 * MINUTE);
  });

  it('books every short band its own increment rather than sharing a day of them out', () => {
    const minutes = [7, 7, 7, 105];
    const { unnamed } = propose({
      groups: minutes.map((observedMinutes, index) => group({ fromMinute: index * 180, observedMinutes })),
    });

    expect(unnamed.map((row) => row.durationMs / MINUTE)).toEqual([15, 15, 15, 105]);
  });

  it(`leaves a proposal's duration where it was`, () => {
    const named = group({ fromMinute: 0, observedMinutes: 37, issueKey: 'FIP-1' });
    const alone = propose({ groups: [named] });
    const beside = propose({ groups: [named, group({ fromMinute: 60, observedMinutes: 23 })] });

    expect(beside.proposals[0]?.durationMs).toBe(alone.proposals[0]?.durationMs);
  });

  it('draws a row in the lane it names rather than the one its blocks read', () => {
    const base = group({ fromMinute: 0, observedMinutes: 30 });
    const inRepo = base.blocks.map((block) => ({ ...block, context: { repoPath: '/dev/a' } }));
    const { unnamed } = propose({ groups: [{ ...base, blocks: inRepo, laneKey: CALL_LANE_KEY }] });

    expect(unnamed[0]?.laneKey).toBe(CALL_LANE_KEY);
  });

  it('reads the lane off the blocks of a row that names none', () => {
    const base = group({ fromMinute: 0, observedMinutes: 30 });
    const inRepo = base.blocks.map((block) => ({ ...block, context: { repoPath: '/dev/a' } }));
    const { unnamed } = propose({ groups: [{ ...base, blocks: inRepo }] });

    expect(unnamed[0]?.laneKey).toBe('repo:/dev/a');
  });

  it('puts a row on an increment boundary at both ends', () => {
    const { proposals } = propose({
      groups: [group({ fromMinute: 38, observedMinutes: 23, issueKey: 'FIP-2178' })],
      config: FIP,
    });

    expect(proposals[0]?.from).toEqual(AT(30));
    expect(proposals[0]?.to).toEqual(AT(60));
    expect(proposals[0]?.observedMs).toBe(23 * MINUTE);
    expect(proposals[0]?.durationMs).toBe(30 * MINUTE);
  });

  it('snaps a named row and an unnamed one against each other, so neither invents an overlap', () => {
    const { proposals, unnamed } = propose({
      groups: [
        group({ fromMinute: 38, observedMinutes: 30, issueKey: 'FIP-2178' }),
        group({ fromMinute: 68, observedMinutes: 22 }),
      ],
      config: FIP,
    });

    expect(proposals[0]?.to).toEqual(AT(60));
    expect(unnamed[0]?.from).toEqual(AT(60));
  });
});
