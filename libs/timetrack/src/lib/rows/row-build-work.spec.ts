import { describe, expect, it } from 'vitest';
import { ActivityBlock, ActivityContext } from '../model/block';
import { CollectedEvent } from '../model/event';
import { AttributedBlock } from './attribute';
import { cutSessionAcrossCheckouts } from './cut';
import { mergeBlocks } from './merge';

const AT = (seconds: number) => new Date(new Date(2026, 10, 19, 8, 0, 0).getTime() + seconds * 1000);

const counted = () => {
  const reads = { count: 0 };
  const read = <T>(value: T) => {
    reads.count++;

    return value;
  };
  const watch = (entry: AttributedBlock): AttributedBlock => {
    const { context } = entry.block;
    const block = Object.defineProperty({ ...entry.block }, 'context', {
      enumerable: true,
      get: (): ActivityContext => read(context),
    });

    return Object.defineProperty({ ...entry }, 'block', { enumerable: true, get: (): ActivityBlock => read(block) });
  };

  return { reads, watch };
};

/**
 * A long day of two parallel agent sessions on one ticket, one of them also working in a second
 * checkout: a block every half minute for eight hours.
 */
const busySessions = (watch: (entry: AttributedBlock) => AttributedBlock) => {
  const blocks: AttributedBlock[] = [];
  const events: CollectedEvent[] = [];

  for (let index = 0; index < 960; index++) {
    const session = index % 2 ? 'one' : 'two';
    const repoPath = index % 3 === 0 ? '/home/me/dev/other' : '/home/me/dev/app';
    const from = AT(index * 30);
    const block: ActivityBlock = {
      from,
      to: AT(index * 30 + (index % 5 === 0 ? 20 : 90)),
      context: { appId: 'code', repoPath, branch: 'feat/x', session, piece: session },
      evidence: [{ kind: 'branch', at: from, detail: 'branch `feat/x`' }],
    };

    blocks.push(watch({ block, issueKey: 'APP-1', confidence: 'certain', evidence: block.evidence }));
    events.push({
      kind: 'agent-usage',
      source: 'agent-usage',
      at: from,
      provider: 'claude-code',
      sessionId: session,
      turnId: `turn-${index}`,
      cwd: repoPath,
      workedIn: repoPath,
      model: 'model',
      usage: { input: 1, output: 1, cacheWrite: 0, cacheRead: 0, thinking: 0 },
    });
  }

  return { blocks, events };
};

describe('row building work on a busy day', () => {
  it('reads each block a bounded number of times when one session spans two checkouts', () => {
    const { reads, watch } = counted();
    const { blocks, events } = busySessions(watch);

    reads.count = 0;
    cutSessionAcrossCheckouts({ blocks, events });

    expect(reads.count).toBeLessThan(blocks.length * 40);
  });

  it('reads each block a bounded number of times while merging long bands', () => {
    const { reads, watch } = counted();
    const { blocks } = busySessions(watch);

    reads.count = 0;
    const rows = mergeBlocks({ blocks });

    expect(rows.length).toBeGreaterThan(0);
    expect(reads.count).toBeLessThan(blocks.length * 40);
  });
});
