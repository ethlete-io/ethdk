import { describe, expect, it } from 'vitest';
import { CollectedEvent, PresenceEvent } from '../model/event';
import { AttributedBlock } from './attribute';
import { fillGaps } from './fill';

const REPO = '/Users/tom/dev/ea-frontend';

const attributed = (from: string, to: string, issueKey?: string): AttributedBlock => ({
  block: {
    from: new Date(from),
    to: new Date(to),
    context: { repoPath: REPO, branch: 'next' },
    evidence: [],
  },
  issueKey,
  confidence: issueKey ? 'certain' : 'weak',
  evidence: [],
});

const presence = (kind: PresenceEvent['kind'], at: string): CollectedEvent => ({
  at: new Date(at),
  source: 'idle',
  kind,
});

const IDLE_AT_TEN = [presence('idle-start', '2026-08-13T10:00:00Z'), presence('idle-end', '2026-08-13T10:12:00Z')];

const DAY = [
  attributed('2026-08-13T09:00:00Z', '2026-08-13T10:00:00Z', 'FIP-2904'),
  attributed('2026-08-13T10:12:00Z', '2026-08-13T11:00:00Z', 'FIP-2904'),
];

describe('fillGaps', () => {
  it('joins a short idle gap to the work before it', () => {
    const { blocks, filledMs } = fillGaps({ blocks: DAY, events: IDLE_AT_TEN });

    expect(filledMs).toBe(12 * 60_000);
    expect(blocks).toHaveLength(3);
    expect(blocks[1]?.issueKey).toBe('FIP-2904');
    expect(blocks[1]?.block.from).toEqual(new Date('2026-08-13T10:00:00Z'));
    expect(blocks[1]?.block.to).toEqual(new Date('2026-08-13T10:12:00Z'));
  });

  it('marks a filled gap weak, so a row made mostly of it never syncs unreviewed', () => {
    const { blocks } = fillGaps({ blocks: DAY, events: IDLE_AT_TEN });

    expect(blocks[1]?.confidence).toBe('weak');
    expect(blocks[1]?.evidence).toEqual([
      {
        kind: 'gap-fill',
        at: new Date('2026-08-13T10:00:00Z'),
        detail: '12m idle at the machine, joined to the FIP-2904 work before it',
      },
    ]);
  });

  it('gives a gap between two issues to the earlier one', () => {
    const { blocks } = fillGaps({
      blocks: [DAY[0]!, attributed('2026-08-13T10:12:00Z', '2026-08-13T11:00:00Z', 'FIP-3000')],
      events: IDLE_AT_TEN,
    });

    expect(blocks[1]?.issueKey).toBe('FIP-2904');
  });

  it('leaves a gap longer than the threshold alone, so lunch stays visible', () => {
    const { blocks, filledMs } = fillGaps({
      blocks: [DAY[0]!, attributed('2026-08-13T10:45:00Z', '2026-08-13T11:00:00Z', 'FIP-2904')],
      events: IDLE_AT_TEN,
    });

    expect(filledMs).toBe(0);
    expect(blocks).toHaveLength(2);
  });

  it('never fills a gap the user locked the screen for', () => {
    const { filledMs } = fillGaps({
      blocks: DAY,
      events: [...IDLE_AT_TEN, presence('lock', '2026-08-13T10:05:00Z')],
    });

    expect(filledMs).toBe(0);
  });

  it('fills nothing when no idle event dated the gap', () => {
    const { blocks, filledMs } = fillGaps({
      blocks: DAY,
      events: [presence('idle-start', '2026-08-13T08:00:00Z')],
    });

    expect(filledMs).toBe(0);
    expect(blocks).toHaveLength(2);
  });

  it('fills nothing at all when the day collected no presence events', () => {
    expect(fillGaps({ blocks: DAY }).filledMs).toBe(0);
  });

  it('leaves time a timer run or a meeting already claims alone', () => {
    const { filledMs } = fillGaps({
      blocks: DAY,
      events: IDLE_AT_TEN,
      claimed: [{ from: new Date('2026-08-13T10:05:00Z'), to: new Date('2026-08-13T10:30:00Z') }],
    });

    expect(filledMs).toBe(0);
  });

  it('leaves a gap beside work nothing could attribute alone', () => {
    const { filledMs } = fillGaps({
      blocks: [DAY[0]!, attributed('2026-08-13T10:12:00Z', '2026-08-13T11:00:00Z')],
      events: IDLE_AT_TEN,
    });

    expect(filledMs).toBe(0);
  });

  it('fills nothing when the threshold is zero', () => {
    expect(fillGaps({ blocks: DAY, events: IDLE_AT_TEN, options: { maxFillGapMs: 0 } }).filledMs).toBe(0);
  });

  it('has no edge to fill before the first block or after the last', () => {
    const { blocks, filledMs } = fillGaps({ blocks: [DAY[0]!], events: IDLE_AT_TEN });

    expect(filledMs).toBe(0);
    expect(blocks).toHaveLength(1);
  });
});
