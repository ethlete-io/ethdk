import { describe, expect, it } from 'vitest';
import { ActivityBlock, streamKey } from '../model/block';
import { Evidence } from '../model/evidence';
import { AttributedBlock } from './attribute';
import { CollectedEvent } from '../model/event';
import { cutBackground, cutUnwatched, meetLaneRows } from './cut';

const SDK = '/home/you/dev/shared-sdk';
const APP = '/home/you/dev/abc-frontend';
const SPECS = '/home/you/dev/abc-specs';

const DAY = '2026-09-11';

const at = (clock: string) => new Date(`${DAY}T${clock}:00.000Z`);

const block = (repoPath: string, from: string, to: string, evidence: Evidence[] = []): ActivityBlock => ({
  from: at(from),
  to: at(to),
  context: { repoPath, branch: 'next' },
  evidence,
});

const attributed = (options: {
  repoPath: string;
  from: string;
  to: string;
  issueKey?: string;
  evidence?: Evidence[];
}): AttributedBlock => ({
  block: block(options.repoPath, options.from, options.to, options.evidence),
  issueKey: options.issueKey,
  confidence: options.issueKey ? 'likely' : 'weak',
  evidence: options.evidence ?? [],
});

const spans = (blocks: readonly AttributedBlock[]) =>
  blocks.map((entry) => ({
    issueKey: entry.issueKey,
    from: entry.block.from.toISOString().slice(11, 16),
    to: entry.block.to.toISOString().slice(11, 16),
  }));

const behinds = (behind: readonly { issueKey: string; laneKey: string; from: Date; to: Date }[]) =>
  behind.map((stretch) => ({
    issueKey: stretch.issueKey,
    laneKey: stretch.laneKey,
    from: stretch.from.toISOString().slice(11, 16),
    to: stretch.to.toISOString().slice(11, 16),
  }));

describe('cutBackground', () => {
  it('reports the stretch it took, so the lane it left a hole in can say where the time went', () => {
    const cut = cutBackground({
      blocks: [
        attributed({ repoPath: SDK, from: '09:15', to: '12:00', issueKey: 'ET-772' }),
        attributed({ repoPath: APP, from: '11:00', to: '11:30', issueKey: 'FIFAGG-12624' }),
      ],
      backgroundProjects: ['ET'],
    });

    expect(behinds(cut.behind)).toEqual([
      { issueKey: 'ET-772', laneKey: streamKey({ repoPath: SDK, branch: 'next' }), from: '11:00', to: '11:30' },
    ]);
  });

  it('reports one stretch for an afternoon the builder cut the presence into several blocks', () => {
    const cut = cutBackground({
      blocks: [
        attributed({ repoPath: SDK, from: '13:00', to: '14:00', issueKey: 'ET-772' }),
        attributed({ repoPath: SDK, from: '14:00', to: '15:00', issueKey: 'ET-772' }),
        attributed({ repoPath: APP, from: '13:30', to: '15:00', issueKey: 'FIFAGG-12624' }),
      ],
      backgroundProjects: ['ET'],
    });

    expect(behinds(cut.behind)).toEqual([
      { issueKey: 'ET-772', laneKey: streamKey({ repoPath: SDK, branch: 'next' }), from: '13:30', to: '15:00' },
    ]);
  });

  it('puts both ends of a reported stretch on the nearest increment, as every other clock time sits', () => {
    const cut = cutBackground({
      blocks: [
        attributed({ repoPath: SDK, from: '13:00', to: '16:02', issueKey: 'ET-772' }),
        attributed({ repoPath: APP, from: '13:41', to: '16:02', issueKey: 'FIFAGG-12624' }),
      ],
      backgroundProjects: ['ET'],
    });

    expect(behinds(cut.behind)).toEqual([
      { issueKey: 'ET-772', laneKey: streamKey({ repoPath: SDK, branch: 'next' }), from: '13:45', to: '16:00' },
    ]);
  });

  it('drops a stretch too short to reach an increment at all', () => {
    const cut = cutBackground({
      blocks: [
        attributed({ repoPath: SDK, from: '09:00', to: '12:00', issueKey: 'ET-772' }),
        attributed({ repoPath: APP, from: '10:00', to: '10:04', issueKey: 'FIFAGG-12624' }),
      ],
      backgroundProjects: ['ET'],
    });

    expect(cut.behind).toEqual([]);
  });

  it('lets a call a rule counts as work take the minutes a background band ran under it', () => {
    const cut = cutBackground({
      blocks: [attributed({ repoPath: SDK, from: '09:45', to: '12:15', issueKey: 'ET-772' })],
      backgroundProjects: ['ET'],
      claimed: [{ from: at('09:30'), to: at('10:30') }],
    });

    expect(spans(cut.blocks)).toEqual([{ issueKey: 'ET-772', from: '10:30', to: '12:15' }]);
    expect(behinds(cut.behind)).toEqual([
      { issueKey: 'ET-772', laneKey: streamKey({ repoPath: SDK, branch: 'next' }), from: '09:45', to: '10:30' },
    ]);
  });

  it('reports nothing when no foreground band took anything', () => {
    const cut = cutBackground({
      blocks: [attributed({ repoPath: SDK, from: '09:15', to: '12:00', issueKey: 'ET-772' })],
      backgroundProjects: ['ET'],
    });

    expect(cut.behind).toEqual([]);
  });

  it('takes the stretch a foreground band covers away from a background band', () => {
    const cut = cutBackground({
      blocks: [
        attributed({ repoPath: SDK, from: '09:15', to: '12:00', issueKey: 'ET-772' }),
        attributed({ repoPath: APP, from: '11:00', to: '11:30', issueKey: 'FIFAGG-12624' }),
      ],
      backgroundProjects: ['ET'],
    });

    expect(spans(cut.blocks)).toEqual([
      { issueKey: 'ET-772', from: '09:15', to: '11:00' },
      { issueKey: 'FIFAGG-12624', from: '11:00', to: '11:30' },
      { issueKey: 'ET-772', from: '11:30', to: '12:00' },
    ]);
  });

  it('reads the whole reference day down to three rows that do not overlap', () => {
    const cut = cutBackground({
      blocks: [
        attributed({ repoPath: SDK, from: '09:15', to: '12:00', issueKey: 'ET-772' }),
        attributed({ repoPath: APP, from: '11:00', to: '11:30', issueKey: 'FIFAGG-12624' }),
        attributed({ repoPath: SPECS, from: '11:30', to: '12:15' }),
      ],
      backgroundProjects: ['ET'],
    });

    expect(spans(cut.blocks)).toEqual([
      { issueKey: 'ET-772', from: '09:15', to: '11:00' },
      { issueKey: 'FIFAGG-12624', from: '11:00', to: '11:30' },
      { issueKey: undefined, from: '11:30', to: '12:15' },
    ]);
  });

  it('leaves two foreground bands overlapping, because a day that ran both is not a defect', () => {
    const blocks = [
      attributed({ repoPath: APP, from: '09:00', to: '11:00', issueKey: 'FIFAGG-1' }),
      attributed({ repoPath: SPECS, from: '10:00', to: '12:00', issueKey: 'FIP-1' }),
    ];

    expect(spans(cutBackground({ blocks, backgroundProjects: ['ET'] }).blocks)).toEqual(spans(blocks));
  });

  it('changes nothing at all when no project was named as background', () => {
    const blocks = [
      attributed({ repoPath: SDK, from: '09:15', to: '12:00', issueKey: 'ET-772' }),
      attributed({ repoPath: APP, from: '11:00', to: '11:30', issueKey: 'FIFAGG-12624' }),
    ];

    expect(spans(cutBackground({ blocks }).blocks)).toEqual(spans(blocks));
  });

  it('leaves a band it cannot name alone, because no project key says it is background', () => {
    const blocks = [
      attributed({ repoPath: SDK, from: '09:15', to: '12:00' }),
      attributed({ repoPath: APP, from: '11:00', to: '11:30', issueKey: 'FIFAGG-12624' }),
    ];

    expect(spans(cutBackground({ blocks, backgroundProjects: ['ET'] }).blocks)).toEqual(spans(blocks));
  });

  it('ranks two background bands by the focus their streams held', () => {
    const cut = cutBackground({
      blocks: [
        attributed({ repoPath: SDK, from: '09:00', to: '11:00', issueKey: 'ET-1' }),
        attributed({ repoPath: SPECS, from: '10:00', to: '12:00', issueKey: 'ET-2' }),
      ],
      backgroundProjects: ['ET'],
      focusMsByStream: { [streamKey({ repoPath: SPECS })]: 90 * 60_000, [streamKey({ repoPath: SDK })]: 30 * 60_000 },
    });

    expect(spans(cut.blocks)).toEqual([
      { issueKey: 'ET-1', from: '09:00', to: '10:00' },
      { issueKey: 'ET-2', from: '10:00', to: '12:00' },
    ]);
  });

  it('gives equal focus to the band that started first', () => {
    const cut = cutBackground({
      blocks: [
        attributed({ repoPath: SPECS, from: '10:00', to: '12:00', issueKey: 'ET-2' }),
        attributed({ repoPath: SDK, from: '09:00', to: '11:00', issueKey: 'ET-1' }),
      ],
      backgroundProjects: ['ET'],
    });

    expect(spans(cut.blocks)).toEqual([
      { issueKey: 'ET-1', from: '09:00', to: '11:00' },
      { issueKey: 'ET-2', from: '11:00', to: '12:00' },
    ]);
  });

  it('reads a project key in any case, as the settings may hold it', () => {
    const cut = cutBackground({
      blocks: [
        attributed({ repoPath: SDK, from: '09:15', to: '12:00', issueKey: 'et-772' }),
        attributed({ repoPath: APP, from: '11:00', to: '11:30', issueKey: 'FIFAGG-12624' }),
      ],
      backgroundProjects: [' et '],
    });

    expect(spans(cut.blocks)).toEqual([
      { issueKey: 'et-772', from: '09:15', to: '11:00' },
      { issueKey: 'FIFAGG-12624', from: '11:00', to: '11:30' },
      { issueKey: 'et-772', from: '11:30', to: '12:00' },
    ]);
  });

  it('keeps each piece only the evidence observed inside it', () => {
    const early: Evidence = { kind: 'commit', at: at('09:30'), detail: 'early', summary: 'early' };
    const late: Evidence = { kind: 'commit', at: at('11:45'), detail: 'late', summary: 'late' };

    const cut = cutBackground({
      blocks: [
        attributed({ repoPath: SDK, from: '09:15', to: '12:00', issueKey: 'ET-772', evidence: [early, late] }),
        attributed({ repoPath: APP, from: '11:00', to: '11:30', issueKey: 'FIFAGG-12624' }),
      ],
      backgroundProjects: ['ET'],
    });

    expect(cut.blocks.map((entry) => entry.evidence.map((observed) => observed.detail))).toEqual([
      ['early'],
      [],
      ['late'],
    ]);
  });

  it('holds back the increment the day is still in, so the checkout beside it can still claim it', () => {
    const cut = cutBackground({
      blocks: [attributed({ repoPath: SDK, from: '09:15', to: '10:36', issueKey: 'ET-772' })],
      backgroundProjects: ['ET'],
      through: at('10:36'),
    });

    expect(spans(cut.blocks)).toEqual([{ issueKey: 'ET-772', from: '09:15', to: '10:30' }]);
    expect(behinds(cut.behind)).toEqual([]);
  });

  it('drops a band that started inside the increment the day is still in', () => {
    const cut = cutBackground({
      blocks: [attributed({ repoPath: SDK, from: '10:34', to: '10:36', issueKey: 'ET-772' })],
      backgroundProjects: ['ET'],
      through: at('10:36'),
    });

    expect(spans(cut.blocks)).toEqual([]);
  });

  it('keeps the whole of a day that is over, which is read through its own end', () => {
    const cut = cutBackground({
      blocks: [attributed({ repoPath: SDK, from: '09:15', to: '12:00', issueKey: 'ET-772' })],
      backgroundProjects: ['ET'],
      through: at('23:59'),
    });

    expect(spans(cut.blocks)).toEqual([{ issueKey: 'ET-772', from: '09:15', to: '12:00' }]);
  });

  it('holds nothing back where no instant is handed in', () => {
    const cut = cutBackground({
      blocks: [attributed({ repoPath: SDK, from: '09:15', to: '10:36', issueKey: 'ET-772' })],
      backgroundProjects: ['ET'],
    });

    expect(spans(cut.blocks)).toEqual([{ issueKey: 'ET-772', from: '09:15', to: '10:36' }]);
  });
});

describe('meetLaneRows', () => {
  const LANE = streamKey({ repoPath: SDK, branch: 'next' });
  const stretch = { from: at('13:30'), to: at('16:15'), issueKey: 'ET-772', laneKey: LANE };

  it('pulls the stretch onto the row that follows it in its own lane', () => {
    const [met] = meetLaneRows({
      behind: [stretch],
      rows: [{ laneKey: LANE, from: at('16:30'), to: at('17:00') }],
    });

    expect(met?.to).toEqual(at('16:30'));
  });

  it('pulls the stretch onto the row that precedes it the same way', () => {
    const [met] = meetLaneRows({
      behind: [{ ...stretch, from: at('13:20') }],
      rows: [{ laneKey: LANE, from: at('13:00'), to: at('13:30') }],
    });

    expect(met?.from).toEqual(at('13:30'));
  });

  it('leaves a gap wider than an increment alone, because the lane really held nothing there', () => {
    const [met] = meetLaneRows({
      behind: [stretch],
      rows: [{ laneKey: LANE, from: at('18:00'), to: at('19:00') }],
    });

    expect(met?.to).toEqual(at('16:15'));
  });

  it('ignores a row of another lane, which took the minutes rather than losing them', () => {
    const [met] = meetLaneRows({
      behind: [stretch],
      rows: [{ laneKey: streamKey({ repoPath: APP, branch: 'next' }), from: at('16:20'), to: at('17:00') }],
    });

    expect(met?.to).toEqual(at('16:15'));
  });
});

describe('cutUnwatched', () => {
  const ran = (options: { session: string; from: string; to: string; repoPath?: string }): AttributedBlock => ({
    block: {
      from: at(options.from),
      to: at(options.to),
      context: { repoPath: options.repoPath ?? APP, branch: 'next', session: options.session },
      evidence: [],
    },
    confidence: 'weak',
    evidence: [],
  });

  const typed = (options: { session: string; clock: string }): CollectedEvent => ({
    at: at(options.clock),
    source: 'agent-prompt',
    kind: 'agent-prompt',
    provider: 'claude-code',
    sessionId: options.session,
    promptId: `${options.session}-${options.clock}`,
    cwd: APP,
  });

  const held = (blocks: readonly AttributedBlock[]) =>
    blocks.map((entry) => ({
      session: entry.block.context.session,
      from: entry.block.from.toISOString().slice(11, 16),
      to: entry.block.to.toISOString().slice(11, 16),
    }));

  it('books an overlap once, to the session the user prompted last', () => {
    const kept = cutUnwatched({
      blocks: [ran({ session: 'a', from: '10:15', to: '11:30' }), ran({ session: 'b', from: '11:15', to: '11:45' })],
      events: [typed({ session: 'a', clock: '10:15' }), typed({ session: 'b', clock: '11:15' })],
    }).blocks;

    expect(held(kept)).toEqual([
      { session: 'a', from: '10:15', to: '11:15' },
      { session: 'b', from: '11:15', to: '11:45' },
    ]);
  });

  it('gives the overlap back when the user prompts the first session again', () => {
    const kept = cutUnwatched({
      blocks: [ran({ session: 'a', from: '10:15', to: '11:45' }), ran({ session: 'b', from: '11:00', to: '11:45' })],
      events: [
        typed({ session: 'a', clock: '10:15' }),
        typed({ session: 'b', clock: '11:00' }),
        typed({ session: 'a', clock: '11:30' }),
      ],
    }).blocks;

    expect(held(kept)).toEqual([
      { session: 'a', from: '10:15', to: '11:00' },
      { session: 'b', from: '11:00', to: '11:30' },
      { session: 'a', from: '11:30', to: '11:45' },
    ]);
  });

  it('leaves a session running alone its minutes, whatever the last prompt named', () => {
    const kept = cutUnwatched({
      blocks: [ran({ session: 'a', from: '10:15', to: '12:00' }), ran({ session: 'b', from: '11:00', to: '11:10' })],
      events: [typed({ session: 'a', clock: '10:15' }), typed({ session: 'b', clock: '11:00' })],
    }).blocks;

    expect(held(kept)).toEqual([
      { session: 'a', from: '10:15', to: '11:00' },
      { session: 'b', from: '11:00', to: '11:10' },
      { session: 'a', from: '11:10', to: '12:00' },
    ]);
  });

  it('gives an overlap the user prompted neither session in to the older one', () => {
    const kept = cutUnwatched({
      blocks: [ran({ session: 'a', from: '10:15', to: '11:30' }), ran({ session: 'b', from: '11:15', to: '11:45' })],
      events: [],
    }).blocks;

    expect(held(kept)).toEqual([
      { session: 'a', from: '10:15', to: '11:30' },
      { session: 'b', from: '11:30', to: '11:45' },
    ]);
  });

  it('cuts nothing between two checkouts, which is a day that ran two things at once', () => {
    const blocks = [
      ran({ session: 'a', from: '10:15', to: '11:30' }),
      ran({ session: 'b', from: '11:00', to: '11:45', repoPath: SDK }),
    ];

    expect(held(cutUnwatched({ blocks, events: [typed({ session: 'b', clock: '11:00' })] }).blocks)).toEqual(
      held(blocks),
    );
  });

  it('leaves a checkout that ran no agent untouched', () => {
    const blocks = [attributed({ repoPath: APP, from: '10:15', to: '11:30' })];

    expect(cutUnwatched({ blocks, events: [] }).blocks).toEqual(blocks);
  });

  describe('across a checkout and its linked worktrees', () => {
    const WORKTREE = `${APP}-altcha`;
    const worktrees = { [WORKTREE]: APP };
    const focused = (options: { from: string; to: string }): AttributedBlock =>
      attributed({ repoPath: APP, ...options });
    const inWorktree = (options: { session: string; from: string; to: string }): AttributedBlock => ({
      ...ran({ ...options, repoPath: WORKTREE }),
      issueKey: 'ABC-7',
    });

    it('books an instant once, to the checkout the focused window was on', () => {
      const result = cutUnwatched({
        blocks: [focused({ from: '14:15', to: '18:00' }), inWorktree({ session: 'w', from: '15:00', to: '16:00' })],
        events: [typed({ session: 'w', clock: '15:30' })],
        worktrees,
        focusByStream: { [streamKey({ repoPath: APP })]: [{ from: at('14:15'), to: at('18:00') }] },
      });

      expect(result.blocks.map((entry) => entry.block.context.repoPath)).toEqual([APP]);
      expect(result.behind).toEqual([
        { from: at('15:00'), to: at('16:00'), issueKey: 'ABC-7', laneKey: streamKey({ repoPath: WORKTREE }) },
      ]);
    });

    it('keeps what the worktree ran outside the time of its main checkout', () => {
      const result = cutUnwatched({
        blocks: [focused({ from: '14:15', to: '15:30' }), inWorktree({ session: 'w', from: '15:00', to: '16:00' })],
        events: [],
        worktrees,
        focusByStream: { [streamKey({ repoPath: APP })]: [{ from: at('14:15'), to: at('15:30') }] },
      });

      expect(held(result.blocks)).toEqual([
        { session: undefined, from: '14:15', to: '15:30' },
        { session: 'w', from: '15:30', to: '16:00' },
      ]);
    });

    it('gives an instant nobody focused to the session the user prompted last', () => {
      const result = cutUnwatched({
        blocks: [
          ran({ session: 'a', from: '10:00', to: '11:00' }),
          inWorktree({ session: 'w', from: '10:00', to: '11:00' }),
        ],
        events: [typed({ session: 'a', clock: '10:00' }), typed({ session: 'w', clock: '10:30' })],
        worktrees,
      });

      expect(held(result.blocks)).toEqual([
        { session: 'a', from: '10:00', to: '10:30' },
        { session: 'w', from: '10:30', to: '11:00' },
      ]);
    });

    it('still cuts nothing between two repositories that are not worktrees of each other', () => {
      const blocks = [
        focused({ from: '14:15', to: '18:00' }),
        { ...ran({ session: 's', from: '15:00', to: '16:00', repoPath: SDK }), issueKey: 'ABC-7' },
      ];
      const result = cutUnwatched({
        blocks,
        events: [],
        worktrees,
        focusByStream: { [streamKey({ repoPath: APP })]: [{ from: at('14:15'), to: at('18:00') }] },
      });

      expect(result.blocks).toEqual(blocks);
      expect(result.behind).toEqual([]);
    });
  });
});
