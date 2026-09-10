import { CollectedEvent, PresenceEvent } from '../model/event';
import { TimeWindow } from '../model/time-window';

/**
 * The longest gap in presence that is not a break yet. It is `maxFillGapMs` on purpose: a gap short
 * enough for `fillGaps` to give to the work around it must not also be drawn as time away from it.
 */
export const DEFAULT_MIN_BREAK_MS = 15 * 60_000;

/** A stretch of a day nobody was at the machine and nothing ran. */
export type BreakWindow = TimeWindow & {
  /** Whether the screen was locked in it. A lock is a person saying they are leaving, so it needs no length. */
  locked: boolean;
};

const isPresence = (event: CollectedEvent): event is PresenceEvent => event.source === 'idle';

const overlaps = (window: TimeWindow, windows: readonly TimeWindow[]) =>
  windows.some((other) => other.from.getTime() < window.to.getTime() && other.to.getTime() > window.from.getTime());

/**
 * The breaks a day held: the gaps between one stretch of presence and the next, less the ones the
 * machine worked through and the ones nothing watched.
 *
 * A break is the opposite of unattended time. Unattended is the agent working while nobody is there;
 * a break is nobody there and nothing running, which is why a gap an agent ran through is left out
 * rather than counted twice under two names.
 *
 * Only the gaps between two stretches of presence are read, so the hours before the first sample and
 * after the last are not a break — a day the collector was off for is a day with nothing to say. A
 * paused stretch is left out for the same reason: the user stopped collection, so nobody knows what
 * happened in it.
 */
export const breakWindows = (options: {
  /** The stretches the user was at the machine, from `presenceWindows`. */
  presence: readonly TimeWindow[];
  /** The day's own events, read only for its `lock` transitions. */
  events?: readonly CollectedEvent[];
  /** Agent time outside presence, which is the machine working rather than a break. */
  unattended?: readonly TimeWindow[];
  /** The stretches the user had stopped collection for, from `pauseWindows`. */
  pauses?: readonly TimeWindow[];
  minBreakMs?: number;
}): BreakWindow[] => {
  const ordered = options.presence.slice().sort((a, b) => a.from.getTime() - b.from.getTime());
  const events = (options.events ?? []).filter(isPresence).filter((event) => event.kind === 'lock');
  const unattended = options.unattended ?? [];
  const pauses = options.pauses ?? [];
  const minBreakMs = options.minBreakMs ?? DEFAULT_MIN_BREAK_MS;
  const breaks: BreakWindow[] = [];

  ordered.forEach((earlier, index) => {
    const later = ordered[index + 1];

    if (!later) return;

    const window = { from: earlier.to, to: later.from };

    if (window.to.getTime() <= window.from.getTime()) return;
    if (overlaps(window, unattended) || overlaps(window, pauses)) return;

    const locked = events.some(
      (event) => event.at.getTime() >= window.from.getTime() && event.at.getTime() < window.to.getTime(),
    );

    if (!locked && window.to.getTime() - window.from.getTime() < minBreakMs) return;

    breaks.push({ ...window, locked });
  });

  return breaks;
};

/** How long a day's breaks held. They never overlap, so this is a plain sum. */
export const breakMs = (breaks: readonly TimeWindow[]) =>
  breaks.reduce((sum, window) => sum + Math.max(0, window.to.getTime() - window.from.getTime()), 0);
