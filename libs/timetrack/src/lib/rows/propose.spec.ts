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

  it('books the whole band, so a row never reads shorter than the time it covers', () => {
    const { proposals } = propose({
      groups: [
        {
          issueKey: 'FIP-2177',
          from: AT(22),
          to: AT(47),
          observedMs: 13 * MINUTE,
          confidence: 'certain',
          evidence: [],
          blocks: [
            { from: AT(22), to: AT(30), context: {}, evidence: [] },
            { from: AT(40), to: AT(47), context: {}, evidence: [] },
          ],
        },
      ],
    });

    expect(proposals[0]?.from).toEqual(AT(15));
    expect(proposals[0]?.to).toEqual(AT(45));
    expect(proposals[0]?.durationMs).toBe(30 * MINUTE);
    expect(proposals[0]?.observedMs).toBe(13 * MINUTE);
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

  it('keeps two pieces of one checkout that started together apart, and the first on its old id', () => {
    const inPiece = (piece: string): WorkGroup => {
      const base = group({ fromMinute: 0, observedMinutes: 30 });

      return { ...base, blocks: base.blocks.map((block) => ({ ...block, context: { repoPath: '/dev/a', piece } })) };
    };

    const alone = propose({ groups: [inPiece('one')] });
    const { unnamed, unattributed } = propose({ groups: [inPiece('one'), inPiece('two')] });

    expect(unnamed.map((row) => row.id)).toEqual([alone.unnamed[0]?.id, `${alone.unnamed[0]?.id}+two`]);
    expect(unattributed.map((row) => row.rowId)).toEqual(unnamed.map((row) => row.id));
  });

  it('gives a band one id whatever branches its blocks were on', () => {
    const onBranches = (...branches: string[]): WorkGroup => {
      const base = group({ fromMinute: 0, observedMinutes: 60 });

      return {
        ...base,
        blocks: branches.map((branch, index) => ({
          from: AT(index * 20),
          to: AT(index * 20 + 20),
          context: { repoPath: '/dev/app', branch },
          evidence: [],
        })),
      };
    };

    const early = propose({ groups: [onBranches('next')] });
    const later = propose({ groups: [onBranches('next', 'dev-toty', 'dev-toty')] });

    expect(early.unnamed[0]?.id).toBe(later.unnamed[0]?.id);
    expect(later.unnamed[0]?.id).not.toContain('next');
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
  it("keeps a row id still while the band before it grows into the band's raw start", () => {
    const first = propose({
      groups: [group({ fromMinute: 22, observedMinutes: 20, issueKey: 'FIP-2178' })],
      config: FIP,
    });
    const later = propose({
      groups: [group({ fromMinute: 27, observedMinutes: 15, issueKey: 'FIP-2178' })],
      config: FIP,
    });

    expect(later.proposals[0]?.from).toEqual(first.proposals[0]?.from);
    expect(later.proposals[0]?.id).toBe(first.proposals[0]?.id);
  });

  it('keeps an unnamed row id still the same way', () => {
    const first = propose({ groups: [group({ fromMinute: 22, observedMinutes: 20 })] });
    const later = propose({ groups: [group({ fromMinute: 27, observedMinutes: 15 })] });

    expect(later.unnamed[0]?.from).toEqual(first.unnamed[0]?.from);
    expect(later.unnamed[0]?.id).toBe(first.unnamed[0]?.id);
  });

  it('keeps on a band that gains a name the id it carried while unnamed', () => {
    const unnamed = propose({ groups: [group({ fromMinute: 0, observedMinutes: 30 })] });
    const named = propose({ groups: [group({ fromMinute: 0, observedMinutes: 30, issueKey: 'FIP-2866' })] });

    expect(named.proposals[0]?.unnamedId).toBe(unnamed.unnamed[0]?.id);
  });

  describe('activeUntil', () => {
    const inPiece = (piece: string, fromMinute: number, observedMinutes: number): WorkGroup => {
      const base = group({ fromMinute, observedMinutes, issueKey: 'FIP-2178' });

      return { ...base, blocks: base.blocks.map((block) => ({ ...block, context: { repoPath: '/dev/a', piece } })) };
    };
    const ran = (piece: string, fromMinute: number, toMinute: number) => ({
      from: AT(fromMinute),
      to: AT(toMinute),
      context: { repoPath: '/dev/a', piece },
      evidence: [],
    });

    it("reads how long the row's own session went on, past the minutes a sibling held", () => {
      const { proposals } = propose({
        groups: [inPiece('a', 0, 10)],
        sessionBlocks: [ran('a', 0, 45), ran('b', 10, 90)],
      });

      expect(proposals[0]?.activeUntil).toEqual(AT(45));
    });

    it("leaves a sibling session's later activity out", () => {
      const { proposals } = propose({
        groups: [inPiece('a', 0, 30)],
        sessionBlocks: [ran('a', 0, 30), ran('b', 0, 120)],
      });

      expect(proposals[0]?.activeUntil).toEqual(AT(30));
    });

    it('is absent on a row with no piece', () => {
      const { proposals } = propose({
        groups: [group({ fromMinute: 0, observedMinutes: 10, issueKey: 'FIP-2178' })],
        sessionBlocks: [ran('a', 0, 45)],
      });

      expect(proposals[0]?.activeUntil).toBeUndefined();
    });
  });
});

describe('propose, for parallel sessions on one ticket', () => {
  const session = (windows: readonly [number, number][]): WorkGroup => {
    const [first] = windows;
    const last = windows.at(-1);

    return {
      ...group({ fromMinute: first?.[0] ?? 0, observedMinutes: 0, issueKey: 'FIP-1' }),
      to: AT(last?.[1] ?? 0),
      observedMs: windows.reduce((sum, [from, to]) => sum + (to - from) * MINUTE, 0),
      laneKey: 'repo:/dev/a',
      blocks: windows.map(([from, to]) => ({ from: AT(from), to: AT(to), context: {}, evidence: [] })),
    };
  };

  it('keeps the windows each row held apart, so a screen can draw the turns they took', () => {
    const { proposals } = propose({
      groups: [
        session([
          [0, 30],
          [60, 90],
        ]),
        session([[30, 60]]),
      ],
    });
    const turns = proposals.map((row) => row.stretches?.map((stretch) => stretch.from.getTime()));

    expect(turns).toEqual([[AT(0).getTime(), AT(60).getTime()], [AT(30).getTime()]]);
  });

  it('rounds the minutes of the pair up once, so the pair never books more than the clock it covers', () => {
    const { proposals } = propose({
      groups: [
        session([
          [0, 20],
          [30, 41],
        ]),
        session([
          [20, 30],
          [41, 60],
        ]),
      ],
    });

    expect(proposals.map((row) => row.durationMs / MINUTE)).toEqual([30, 30]);
  });
});

describe('propose, on a row nobody attended', () => {
  const SECOND = 1_000;
  const AT_SECOND = (minute: number, second: number) => new Date(AT(minute).getTime() + second * SECOND);
  const ALONE: WorkGroup = {
    issueKey: 'ABC-100',
    from: AT_SECOND(34, 28),
    to: AT_SECOND(49, 56),
    observedMs: 15 * MINUTE + 28 * SECOND,
    confidence: 'certain',
    evidence: [],
    attended: false,
    blocks: [
      {
        from: AT_SECOND(34, 28),
        to: AT_SECOND(49, 56),
        context: { repoPath: '/work/app-a', branch: 'feat/ABC-100-thing' },
        evidence: [],
      },
    ],
  };

  it('ends the unattended row with the drawn break and books the rest as attended', () => {
    const { proposals, unnamed } = propose({
      groups: [ALONE],
      breaks: [{ from: AT_SECOND(31, 48), to: AT_SECOND(51, 42) }],
    });

    expect(unnamed).toHaveLength(1);
    expect(unnamed[0]).toMatchObject({
      id: `unnamed:repo:/work/app-a@${AT(30).toISOString()}`,
      unattended: true,
      withheldIssueKey: 'ABC-100',
      from: AT(30),
      to: AT(45),
      durationMs: 15 * MINUTE,
    });
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({ issueKey: 'ABC-100', from: AT(45), to: AT(60), durationMs: 15 * MINUTE });
    expect((unnamed[0]?.observedMs ?? 0) + (proposals[0]?.observedMs ?? 0)).toBe(ALONE.observedMs);
  });

  it('leaves an unattended row alone when its break holds the whole of it', () => {
    const { proposals, unnamed } = propose({
      groups: [ALONE],
      breaks: [{ from: AT(30), to: AT(60) }],
    });

    expect(proposals).toEqual([]);
    expect(unnamed).toHaveLength(1);
    expect(unnamed[0]).toMatchObject({ unattended: true, from: AT(30), to: AT(60) });
  });

  it('leaves an unattended row alone when no break was drawn over it', () => {
    const { proposals, unnamed } = propose({ groups: [ALONE] });

    expect(proposals).toEqual([]);
    expect(unnamed[0]).toMatchObject({ unattended: true, from: AT(30), to: AT(60) });
  });
});

describe('propose, on a row an agent ran through a break', () => {
  const THROUGH: WorkGroup = {
    ...group({ fromMinute: 0, observedMinutes: 180, issueKey: 'ABC-100' }),
    attended: true,
    evidence: [
      { kind: 'commit', at: AT(20), detail: 'a1 feat(app): Seed the bracket', summary: 'feat(app): Seed the bracket' },
      { kind: 'commit', at: AT(170), detail: 'b2 fix(app): Order the seeds', summary: 'fix(app): Order the seeds' },
    ],
  };
  const BREAK = { from: AT(60), to: AT(107) };

  it('books the part before the break and the part after it, and nothing inside it', () => {
    const { proposals } = propose({ groups: [THROUGH], breaks: [BREAK] });

    expect(
      proposals.map(({ id, from, to, durationMs, afterBreak }) => ({ id, from, to, durationMs, afterBreak })),
    ).toEqual([
      { id: `ABC-100@${AT(0).toISOString()}`, from: AT(0), to: AT(60), durationMs: 60 * MINUTE, afterBreak: undefined },
      { id: `ABC-100@${AT(105).toISOString()}`, from: AT(105), to: AT(180), durationMs: 75 * MINUTE, afterBreak: true },
    ]);
    expect(proposals.map((row) => row.description)).toEqual([
      'feat(app): Seed the bracket',
      'fix(app): Order the seeds',
    ]);
    expect(proposals.reduce((sum, row) => sum + row.observedMs, 0)).toBe(135 * MINUTE);
  });

  it('keeps the part inside the break as a row nobody attended, which books nothing', () => {
    const { proposals, unnamed, unattributed } = propose({ groups: [THROUGH], breaks: [BREAK] });

    expect(
      unnamed.map(({ from, to, observedMs, unattended, withheldIssueKey }) => ({
        from,
        to,
        observedMs,
        unattended,
        withheldIssueKey,
      })),
    ).toEqual([{ from: AT(60), to: AT(105), observedMs: 45 * MINUTE, unattended: true, withheldIssueKey: 'ABC-100' }]);
    expect(unattributed.map((entry) => entry.attended)).toEqual([false]);
    expect(proposals.some((row) => row.from < AT(105) && row.to > AT(60))).toBe(false);
  });

  it('starts a row at the drawn break end and keeps the id its own start gives it', () => {
    const late: WorkGroup = { ...group({ fromMinute: 100, observedMinutes: 50, issueKey: 'ABC-200' }), attended: true };
    const { proposals } = propose({ groups: [THROUGH, late], breaks: [{ from: AT(60), to: AT(98) }] });
    const row = proposals.find((proposal) => proposal.issueKey === 'ABC-200');

    expect(row && { id: row.id, from: row.from, afterBreak: row.afterBreak }).toEqual({
      id: `ABC-200@${AT(90).toISOString()}`,
      from: AT(105),
      afterBreak: true,
    });
    expect(proposals.some((proposal) => proposal.from < AT(105) && proposal.to > AT(60))).toBe(false);
  });

  it('cuts nothing out of a stretch no break may cover', () => {
    const { proposals, unnamed } = propose({ groups: [THROUGH], breaks: [BREAK], presence: [BREAK] });

    expect(proposals.map(({ from, to }) => [from, to])).toEqual([[AT(0), AT(180)]]);
    expect(unnamed).toEqual([]);
  });
});
