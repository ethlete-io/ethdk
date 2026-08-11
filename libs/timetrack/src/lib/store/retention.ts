const DAY_MS = 24 * 60 * 60_000;

export type RetentionPolicy = {
  /** How long raw events are kept before they are compacted to blocks and deleted. */
  rawEventDays: number;
};

export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  rawEventDays: 30,
};

export type RetentionPlan = {
  /**
   * Raw events strictly older than this may be deleted. `null` means none may be: nothing has been
   * compacted yet, so nothing is safe to drop.
   */
  deleteEventsBefore: Date | null;
  /** The instant the policy alone would release, ignoring how far compaction has got. */
  windowStartsAt: Date;
  /**
   * Compaction has not reached `windowStartsAt`, so the plan releases less than the policy allows.
   * Show it as retention falling behind; the lag itself is `windowStartsAt - compactedThrough`.
   */
  heldBackByCompaction: boolean;
};

/**
 * What retention may delete right now. `compactedThrough` is the instant up to which raw events have
 * been turned into attributed blocks, or `null` when none have been.
 *
 * The cutoff is clamped to `compactedThrough`, and that clamp is the whole point: deleting raw events
 * the compactor has not reached destroys the only record of those days, because the blocks that would
 * have outlived them do not exist yet. Falling behind on compaction then costs disk, never data.
 */
export const planRetention = (options: {
  now: Date;
  compactedThrough: Date | null;
  policy?: Partial<RetentionPolicy>;
}): RetentionPlan => {
  const { rawEventDays } = { ...DEFAULT_RETENTION_POLICY, ...options.policy };
  const windowStartsAt = new Date(options.now.getTime() - rawEventDays * DAY_MS);
  const compactedThrough = options.compactedThrough;
  const behind = !compactedThrough || compactedThrough.getTime() < windowStartsAt.getTime();

  return {
    deleteEventsBefore: compactedThrough
      ? new Date(Math.min(compactedThrough.getTime(), windowStartsAt.getTime()))
      : null,
    windowStartsAt,
    heldBackByCompaction: behind,
  };
};
