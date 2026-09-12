import { describe, expect, it } from 'vitest';
import { ActivityBlock, streamKey } from '../model/block';
import { Evidence } from '../model/evidence';
import { AttributedBlock } from './attribute';
import { cutBackground } from './cut';

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

describe('cutBackground', () => {
  it('takes the stretch a foreground band covers away from a background band', () => {
    const cut = cutBackground({
      blocks: [
        attributed({ repoPath: SDK, from: '09:15', to: '12:00', issueKey: 'ET-772' }),
        attributed({ repoPath: APP, from: '11:00', to: '11:30', issueKey: 'FIFAGG-12624' }),
      ],
      backgroundProjects: ['ET'],
    });

    expect(spans(cut)).toEqual([
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

    expect(spans(cut)).toEqual([
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

    expect(spans(cutBackground({ blocks, backgroundProjects: ['ET'] }))).toEqual(spans(blocks));
  });

  it('changes nothing at all when no project was named as background', () => {
    const blocks = [
      attributed({ repoPath: SDK, from: '09:15', to: '12:00', issueKey: 'ET-772' }),
      attributed({ repoPath: APP, from: '11:00', to: '11:30', issueKey: 'FIFAGG-12624' }),
    ];

    expect(spans(cutBackground({ blocks }))).toEqual(spans(blocks));
  });

  it('leaves a band it cannot name alone, because no project key says it is background', () => {
    const blocks = [
      attributed({ repoPath: SDK, from: '09:15', to: '12:00' }),
      attributed({ repoPath: APP, from: '11:00', to: '11:30', issueKey: 'FIFAGG-12624' }),
    ];

    expect(spans(cutBackground({ blocks, backgroundProjects: ['ET'] }))).toEqual(spans(blocks));
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

    expect(spans(cut)).toEqual([
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

    expect(spans(cut)).toEqual([
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

    expect(spans(cut)).toEqual([
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

    expect(cut.map((entry) => entry.evidence.map((observed) => observed.detail))).toEqual([['early'], [], ['late']]);
  });
});
