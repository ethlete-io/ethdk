import { CollectedEvent } from './event';

const DATE_FIELDS = ['at', 'authoredAt', 'until'] as const;

/** Turns events read back from `timetrack day --out` JSON, where every Date is an ISO string, into events again. */
export const reviveCollectedEvents = (parsed: readonly unknown[]): CollectedEvent[] =>
  parsed.map((entry) => {
    const event: Record<string, unknown> = { ...(entry as Record<string, unknown>) };

    for (const field of DATE_FIELDS) {
      if (typeof event[field] === 'string') event[field] = new Date(event[field]);
    }

    return event as CollectedEvent;
  });
