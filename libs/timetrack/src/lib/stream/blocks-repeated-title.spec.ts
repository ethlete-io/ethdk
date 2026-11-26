import { describe, expect, it } from 'vitest';
import { Evidence } from '../model/evidence';
import { ContextObservation, ContextSpan, blocksFromSpans } from './blocks';

const at = (minute: number) => new Date(2026, 10, 19, 10, minute, 0);
const context = { repoPath: '/dev/frontend', branch: 'next', session: 's1' };

describe('blocksFromSpans with a session title sampled every minute', () => {
  it('keeps the title at each instant it was observed, so a later quarter of the block can still name the work', () => {
    const spans: ContextSpan[] = [{ from: at(0), to: at(45), context }];
    const observations: ContextObservation[] = Array.from({ length: 45 }, (_, minute) => ({
      at: at(minute),
      context,
      evidence: {
        kind: 'agent-session',
        at: at(minute),
        detail: 'Ethlete handoff resume',
        summary: 'Ethlete handoff resume',
      } as Evidence,
    }));

    const [block] = blocksFromSpans({ spans, observations });
    const lastQuarter = block?.evidence.filter((entry) => entry.at >= at(30)) ?? [];

    expect(lastQuarter.length).toBeGreaterThan(0);
  });
});
