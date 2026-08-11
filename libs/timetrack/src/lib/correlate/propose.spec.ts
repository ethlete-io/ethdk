import { resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { describe, expect, it } from 'vitest';
import { Confidence, Evidence } from '../model/evidence';
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

  it('rounds the day as a whole and keeps the observed time beside it', () => {
    const { proposals } = propose({
      groups: [
        group({ fromMinute: 0, observedMinutes: 50, issueKey: 'FIP-2177' }),
        group({ fromMinute: 60, observedMinutes: 40, issueKey: 'FIP-2222' }),
        group({ fromMinute: 120, observedMinutes: 30, issueKey: 'FIP-2333' }),
      ],
    });

    expect(proposals.map((proposal) => proposal.durationMs / MINUTE)).toEqual([45, 45, 30]);
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

  it('does not let unattributed time affect the rounding of the rest', () => {
    const { proposals } = propose({
      groups: [
        group({ fromMinute: 0, observedMinutes: 50, issueKey: 'FIP-2177' }),
        group({ fromMinute: 60, observedMinutes: 7, confidence: 'weak' }),
      ],
    });

    expect(proposals[0]?.durationMs).toBe(45 * MINUTE);
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
