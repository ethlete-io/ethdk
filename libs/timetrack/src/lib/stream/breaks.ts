import { CollectedEvent, PresenceEvent } from '../model/event';
import {
  TimeWindow,
  clipWindows,
  mergeWindows,
  subtractWindows,
  windowsMs,
  windowsOverlap,
} from '../model/time-window';

/**
 * The longest gap in presence that is not a break yet. It is `maxFillGapMs` on purpose: a gap short
 * enough for `fillGaps` to give to the work around it must not also be drawn as time away from it.
 */
export const DEFAULT_MIN_BREAK_MS = 15 * 60_000;

/**
 * The longest gap that is still a break. Past it the machine was simply on and nobody was there —
 * the night, a weekend, a day off — and calling that a break puts hours nobody took on the readout.
 */
export const DEFAULT_MAX_BREAK_MS = 3 * 60 * 60_000;

/**
 * How much of a break the prompt that ends it buys back.
 *
 * A prompt is a person who read what the agent wrote and typed an answer, and that attention is real
 * work whether they gave it at the desk or from a phone. It is the whole of the allowance rather than
 * a share of it: nothing observed says how long they read for, and the day's own grain is a quarter
 * hour.
 */
export const DEFAULT_PROMPT_ATTENTION_MS = 15 * 60_000;

/**
 * The most of one break the prompts inside it may buy back.
 *
 * The allowance is a guess at the attention around an instant. When the guesses cover a whole
 * absence the guess is wrong: the idle notifier observed nobody there, and two prompts half an hour
 * apart do not make the half hour between them work.
 */
export const DEFAULT_MAX_ATTENTION_SHARE = 0.5;

/** A stretch of a day nobody was at the machine. */
export type BreakWindow = TimeWindow & {
  /** Whether the screen was locked in it. A lock is a person saying they are leaving, so it needs no length. */
  locked: boolean;
};

const isPresence = (event: CollectedEvent): event is PresenceEvent => event.source === 'idle';

const overlaps = (window: TimeWindow, windows: readonly TimeWindow[]) =>
  windows.some((other) => other.from.getTime() < window.to.getTime() && other.to.getTime() > window.from.getTime());

/**
 * The breaks a day held: the gaps between one stretch of presence and the next.
 *
 * A break is the user away from the machine, whatever the machine did in it. An agent that ran
 * through one does not make it work the user was at: it is `unattendedMs` as well, because the two
 * numbers answer different questions — who was there, and what ran.
 *
 * Only the gaps between two stretches of presence are read, so the hours before the first sample and
 * after the last are not a break — a day the collector was off for is a day with nothing to say. A
 * paused stretch is left out for the same reason: the user stopped collection, so nobody knows what
 * happened in it.
 *
 * A gap also has to sit inside the day's work, and it has to be shorter than `maxBreakMs`. A machine
 * left on overnight samples presence hours before the first block and hours after the last, and one
 * gap of that size is the night rather than a break somebody took.
 *
 * The prompts the user sent then buy their attention back: each one shortens the break it ends by
 * `promptAttentionMs`, down to `minBreakMs` and never past it. A person who waits on an agent and
 * answers it is working; a person who answers it twice in forty minutes was away for the rest, and
 * that rest is what this reports.
 */
export const breakWindows = (options: {
  /** The stretches the user was at the machine, from `presenceWindows`. */
  presence: readonly TimeWindow[];
  /** The day's own events, read only for its `lock` transitions. */
  events?: readonly CollectedEvent[];
  /** The stretches the user had stopped collection for, from `pauseWindows`. */
  pauses?: readonly TimeWindow[];
  /** The day's activity blocks. A gap outside the span they cover is not a break. */
  work?: readonly TimeWindow[];
  minBreakMs?: number;
  /** The longest gap that is still a break. A longer one is time away from the day, lock or no lock. */
  maxBreakMs?: number;
  /** When the user prompted an agent. Each prompt buys back the attention it took to write. */
  prompts?: readonly Date[];
  /** How much of a break one prompt buys back. Defaults to `DEFAULT_PROMPT_ATTENTION_MS`. */
  promptAttentionMs?: number;
  /** The most of one break its prompts may buy back. Defaults to `DEFAULT_MAX_ATTENTION_SHARE`. */
  maxAttentionShare?: number;
}): BreakWindow[] => {
  const ordered = options.presence.slice().sort((a, b) => a.from.getTime() - b.from.getTime());
  const events = (options.events ?? []).filter(isPresence).filter((event) => event.kind === 'lock');
  const pauses = options.pauses ?? [];
  const minBreakMs = options.minBreakMs ?? DEFAULT_MIN_BREAK_MS;
  const attentionMs = options.promptAttentionMs ?? DEFAULT_PROMPT_ATTENTION_MS;
  const maxAttentionShare = options.maxAttentionShare ?? DEFAULT_MAX_ATTENTION_SHARE;
  const maxBreakMs = options.maxBreakMs ?? DEFAULT_MAX_BREAK_MS;
  const work = options.work ?? [];
  const workFrom = work.length ? Math.min(...work.map((window) => window.from.getTime())) : undefined;
  const workTo = work.length ? Math.max(...work.map((window) => window.to.getTime())) : undefined;
  const breaks: BreakWindow[] = [];

  ordered.forEach((earlier, index) => {
    const later = ordered[index + 1];

    if (!later) return;

    const window = { from: earlier.to, to: later.from };

    if (window.to.getTime() <= window.from.getTime()) return;
    if (overlaps(window, pauses)) return;

    if (workFrom !== undefined && workTo !== undefined) {
      if (window.from.getTime() < workFrom || window.to.getTime() > workTo) return;
    }

    if (window.to.getTime() - window.from.getTime() > maxBreakMs) return;

    const locked = events.some(
      (event) => event.at.getTime() >= window.from.getTime() && event.at.getTime() < window.to.getTime(),
    );

    if (!locked && window.to.getTime() - window.from.getTime() < minBreakMs) return;

    breaks.push({ ...window, locked });
  });

  return attended({ breaks, prompts: options.prompts ?? [], attentionMs, minBreakMs, maxAttentionShare });
};

/**
 * The breaks with each prompt's attention taken out of them.
 *
 * The allowance runs backwards from the prompt, because that is the side the reading and the typing
 * are on: the answer arrived, the person read it, and the prompt is when they finished. Allowances
 * that overlap are merged first, so two prompts a moment apart buy back one allowance rather than
 * two, and no break gives up more than `maxAttentionShare` of itself however many prompts fall in it.
 *
 * The allowance never takes a break below `minBreakMs`. It is a guess at attention around an instant,
 * and a guess must not delete an absence the notifier observed: a break that was long enough to
 * report before the prompts is long enough to report after them.
 *
 * What the prompts buy back shortens the break from its end rather than punching holes in it. A
 * perforated break leaves slivers that `minBreakMs` then drops one by one, so two prompts half an
 * hour apart used to delete the whole half hour between them; the person was still away for it.
 *
 * A locked break keeps no allowance at all — a lock is the user saying they left, and nothing they
 * typed afterwards changes where they were before it.
 */
const attended = (options: {
  breaks: readonly BreakWindow[];
  prompts: readonly Date[];
  attentionMs: number;
  minBreakMs: number;
  maxAttentionShare: number;
}): BreakWindow[] => {
  if (!options.attentionMs || !options.prompts.length) return [...options.breaks];

  const attention = mergeWindows(
    options.prompts.map((at) => ({ from: new Date(at.getTime() - options.attentionMs), to: at })),
  );

  return options.breaks.map((window) => {
    if (window.locked) return window;

    const spanMs = window.to.getTime() - window.from.getTime();
    const bought = Math.min(
      windowsMs(clipWindows({ windows: attention, within: [window] })),
      spanMs * options.maxAttentionShare,
      Math.max(0, spanMs - options.minBreakMs),
    );

    return { ...window, to: new Date(window.to.getTime() - bought) };
  });
};

/** How long a day's breaks held. They never overlap, so this is a plain sum. */
export const breakMs = (breaks: readonly TimeWindow[]) =>
  breaks.reduce((sum, window) => sum + Math.max(0, window.to.getTime() - window.from.getTime()), 0);

/**
 * The breaks as the rows leave them: every stretch between two rows that a measured break falls in.
 *
 * A measured break runs from the last sample of presence to the next, so it lands on the minute the
 * user got up, while every row around it is on a quarter hour. Drawing both puts a break of 1h 21m
 * between two bands that stand 1h 30m apart, and no reviewer can act on that number. The rows are
 * what the day books, so the rows are what a break is long: the measured window says *that* somebody
 * was away, and the gap between the rows says for how long.
 *
 * A measured break that no gap holds is dropped - the rounding gave that time to the work around it.
 * With no rows at all there is nothing to read a gap from, so the measured breaks are returned as
 * they are.
 */
export const breaksBetweenRows = (options: {
  breaks: readonly BreakWindow[];
  rows: readonly TimeWindow[];
}): BreakWindow[] => {
  const covered = mergeWindows(options.rows);
  const first = covered[0];
  const last = covered[covered.length - 1];

  if (!first || !last) return [...options.breaks];

  const gaps = subtractWindows({ windows: [{ from: first.from, to: last.to }], without: covered });

  return gaps.flatMap((gap) => {
    const held = options.breaks.filter((window) => windowsOverlap(gap, window));

    if (!held.length) return [];

    return [{ ...gap, locked: held.some((window) => window.locked) }];
  });
};
