import { describe, expect, it } from 'vitest';
import { DEFAULT_RETENTION_POLICY, planRetention } from './retention';

const DAY_MS = 24 * 60 * 60_000;
const now = new Date(2026, 7, 11, 12, 0);
const daysAgo = (days: number) => new Date(now.getTime() - days * DAY_MS);

describe('planRetention', () => {
  it('releases the default 30-day window when compaction has caught up', () => {
    const plan = planRetention({ now, compactedThrough: daysAgo(1) });

    expect(DEFAULT_RETENTION_POLICY.rawEventDays).toBe(30);
    expect(plan.deleteEventsBefore).toEqual(daysAgo(30));
    expect(plan.windowStartsAt).toEqual(daysAgo(30));
    expect(plan.heldBackByCompaction).toBe(false);
  });

  it('honours a configured window', () => {
    const plan = planRetention({ now, compactedThrough: daysAgo(1), policy: { rawEventDays: 7 } });

    expect(plan.deleteEventsBefore).toEqual(daysAgo(7));
  });

  it('clamps the cutoff to what has been compacted', () => {
    const plan = planRetention({ now, compactedThrough: daysAgo(45) });

    expect(plan.deleteEventsBefore).toEqual(daysAgo(45));
    expect(plan.windowStartsAt).toEqual(daysAgo(30));
    expect(plan.heldBackByCompaction).toBe(true);
  });

  it('deletes nothing when nothing has been compacted', () => {
    const plan = planRetention({ now, compactedThrough: null });

    expect(plan.deleteEventsBefore).toBeNull();
    expect(plan.heldBackByCompaction).toBe(true);
  });

  it('treats compaction exactly at the window edge as caught up', () => {
    const plan = planRetention({ now, compactedThrough: daysAgo(30) });

    expect(plan.deleteEventsBefore).toEqual(daysAgo(30));
    expect(plan.heldBackByCompaction).toBe(false);
  });

  it('never releases past the window just because compaction ran ahead', () => {
    const plan = planRetention({ now, compactedThrough: now });

    expect(plan.deleteEventsBefore).toEqual(daysAgo(30));
    expect(plan.heldBackByCompaction).toBe(false);
  });

  it('releases nothing on a zero-day window before compaction happens', () => {
    const plan = planRetention({ now, compactedThrough: null, policy: { rawEventDays: 0 } });

    expect(plan.deleteEventsBefore).toBeNull();
  });
});
