import { describe, expect, it } from 'vitest';
import { Evidence } from '../model/evidence';
import { ContextObservation, ContextSpan, blocksFromSpans } from './blocks';

const at = (minute: number, second = 0) => new Date(2026, 8, 10, 10, minute, second);

const span = (options: { from: Date; to: Date; appId?: string; repoPath?: string }): ContextSpan => ({
  from: options.from,
  to: options.to,
  context: { appId: options.appId, repoPath: options.repoPath },
});

const observation = (options: { at: Date; appId?: string; repoPath?: string }): ContextObservation => ({
  at: options.at,
  context: { appId: options.appId, repoPath: options.repoPath },
  evidence: { kind: 'commit', at: options.at, detail: 'a commit', summary: 'a commit' } as Evidence,
});

describe('blocksFromSpans', () => {
  it('drops a stretch too short to be work, so a title change draws no band', () => {
    const spans = [
      span({ from: at(0), to: at(30), repoPath: '/dev/sdk' }),
      span({ from: at(10), to: at(10, 1), appId: 'google-chrome' }),
    ];

    expect(blocksFromSpans({ spans, observations: [] }).map((block) => block.context.appId)).toEqual([undefined]);
  });

  it('keeps a stretch that reaches the minimum', () => {
    const spans = [span({ from: at(10), to: at(10, 5), appId: 'google-chrome' })];

    expect(blocksFromSpans({ spans, observations: [] })).toHaveLength(1);
  });

  it('measures the minimum against the joined run, not against each sample of it', () => {
    const spans = [
      span({ from: at(10, 0), to: at(10, 2), appId: 'google-chrome' }),
      span({ from: at(10, 2), to: at(10, 4), appId: 'google-chrome' }),
      span({ from: at(10, 4), to: at(10, 6), appId: 'google-chrome' }),
    ];
    const [block] = blocksFromSpans({ spans, observations: [] });

    expect(block?.to).toEqual(at(10, 6));
  });

  it('takes the minimum from the caller', () => {
    const spans = [span({ from: at(10), to: at(10, 1), appId: 'google-chrome' })];

    expect(blocksFromSpans({ spans, observations: [], minBlockMs: 0 })).toHaveLength(1);
  });

  it('hangs an observation of a dropped stretch on a surviving block of its own context', () => {
    const spans = [
      span({ from: at(0), to: at(30), repoPath: '/dev/sdk' }),
      span({ from: at(40), to: at(40, 1), repoPath: '/dev/sdk' }),
    ];
    const blocks = blocksFromSpans({ spans, observations: [observation({ at: at(40), repoPath: '/dev/sdk' })] });

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.evidence).toHaveLength(1);
  });
});
