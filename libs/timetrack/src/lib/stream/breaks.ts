import { CollectedEvent, PresenceEvent } from '../model/event';
import { PresenceStatement, statementWindows } from '../model/statement';
import { DEFAULT_ROUND_OPTIONS, RoundOptions } from '../rows/round';
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
 * This is the whole absence, before any prompt buys its attention back. The day's work is clipped to
 * it as well as to presence, so an agent that ran through a break still builds the row its time books
 * and the break is drawn over that row. `breakWindows` is what the day reports.
 */
export const breakGaps = (options: {
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
  /** When the user prompted an agent at the desk, or from nowhere `promptOriginAt` could tell. */
  prompts?: readonly Date[];
  /** When the user prompted an agent from another device, read `remote` by `promptOriginAt`. */
  remotePrompts?: readonly Date[];
  /** How much of a break one prompt buys back. Defaults to `DEFAULT_PROMPT_ATTENTION_MS`. */
  promptAttentionMs?: number;
  /** The most of one break its prompts may buy back. Defaults to `DEFAULT_MAX_ATTENTION_SHARE`. */
  maxAttentionShare?: number;
}): BreakWindow[] => {
  const ordered = options.presence.slice().sort((a, b) => a.from.getTime() - b.from.getTime());
  const events = (options.events ?? []).filter(isPresence).filter((event) => event.kind === 'lock');
  const pauses = options.pauses ?? [];
  const minBreakMs = options.minBreakMs ?? DEFAULT_MIN_BREAK_MS;
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

  return breaks;
};

/**
 * The stretches of each break the user worked from another device: from the first remote prompt's
 * allowance to the last remote prompt, inside the break. See ADR 0033.
 */
export const remoteWorkWindows = (options: {
  breaks: readonly TimeWindow[];
  remotePrompts: readonly Date[];
  promptAttentionMs?: number;
}): TimeWindow[] => {
  const attentionMs = options.promptAttentionMs ?? DEFAULT_PROMPT_ATTENTION_MS;

  return options.breaks.flatMap((window) => {
    const from = window.from.getTime();
    const to = window.to.getTime();
    const inside = options.remotePrompts.map((at) => at.getTime()).filter((at) => at >= from && at <= to);

    if (!inside.length) return [];

    return [{ from: new Date(Math.max(from, Math.min(...inside) - attentionMs)), to: new Date(Math.max(...inside)) }];
  });
};

/**
 * The breaks a day reports: the gaps of `breakGaps`, with what the user worked from another device
 * cut out, and each part left shortened by what its desk prompts bought.
 *
 * A remote stretch is cut out whole, lock or no lock, and may split a break in two; a part shorter
 * than `minBreakMs` is dropped. Each desk prompt then shortens the part it ends by
 * `promptAttentionMs`, down to `minBreakMs` and never past it.
 */
export const breakWindows = (options: Parameters<typeof breakGaps>[0]): BreakWindow[] => {
  const minBreakMs = options.minBreakMs ?? DEFAULT_MIN_BREAK_MS;
  const gaps = breakGaps(options);
  const remote = remoteWorkWindows({
    breaks: gaps,
    remotePrompts: options.remotePrompts ?? [],
    promptAttentionMs: options.promptAttentionMs,
  });
  const left = gaps.flatMap((window) =>
    remote.some((stretch) => windowsOverlap(stretch, window))
      ? subtractWindows({ windows: [window], without: remote })
          .filter((part) => part.to.getTime() - part.from.getTime() >= minBreakMs)
          .map((part) => ({ ...part, locked: window.locked }))
      : [window],
  );

  return attended({
    breaks: left,
    prompts: options.prompts ?? [],
    attentionMs: options.promptAttentionMs ?? DEFAULT_PROMPT_ATTENTION_MS,
    minBreakMs,
    maxAttentionShare: options.maxAttentionShare ?? DEFAULT_MAX_ATTENTION_SHARE,
  });
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

const nearest = (ms: number, incrementMs: number) => Math.round(ms / incrementMs) * incrementMs;

/**
 * A break the rows cover, put on the grid the rows sit on.
 *
 * Both ends round to the nearest boundary rather than outwards. A break is an absence the day reports
 * back to the person who took it, and rounding it outwards claims more of one than the notifier saw.
 * A break whose ends round to the same boundary keeps one increment, so no break the day measured
 * reads as nothing.
 */
const snapped = (window: BreakWindow, incrementMs: number): BreakWindow => {
  const from = nearest(window.from.getTime(), incrementMs);

  return {
    ...window,
    from: new Date(from),
    to: new Date(Math.max(nearest(window.to.getTime(), incrementMs), from + incrementMs)),
  };
};

/**
 * A break with the stretches a call held taken out of it, on the increment the rows sit on.
 *
 * The clip runs after the snap because the snap is what creates the overlap: a break measured to
 * 12:52 and a call measured to 12:52 are drawn to 13:00 and 12:45, and only then do they cross. What
 * a clip leaves rounds **inward**, away from the call, so a refusal never hands a minute back. A
 * remainder shorter than one increment is nothing the reviewer can act on, so it is dropped.
 */
const clippedToPresence = (options: {
  breaks: readonly BreakWindow[];
  presence: readonly TimeWindow[];
  incrementMs: number;
}): BreakWindow[] => {
  if (!options.presence.length) return [...options.breaks];

  const { incrementMs } = options;

  return options.breaks.flatMap((window) =>
    subtractWindows({ windows: [window], without: options.presence }).flatMap((part) => {
      const from = Math.ceil(part.from.getTime() / incrementMs) * incrementMs;
      const to = Math.floor(part.to.getTime() / incrementMs) * incrementMs;

      if (to - from < incrementMs) return [];

      return [{ from: new Date(from), to: new Date(to), locked: window.locked }];
    }),
  );
};

/** Breaks with every overlap joined, keeping the lock of whichever part carried one. */
const mergedBreaks = (breaks: readonly BreakWindow[]): BreakWindow[] =>
  mergeWindows(breaks).map((window) => ({
    ...window,
    locked: breaks.some((entry) => entry.locked && windowsOverlap(entry, window)),
  }));

/**
 * The breaks as the user's own statements leave them: an `away` statement draws one, a `present`
 * statement clips one out.
 *
 * The `away` windows go in after the call guard has run and the `present` windows clip after both, so
 * a statement outranks every rule the day derived. A user who says they were away during a meeting
 * gets the break drawn, and the app does not argue.
 *
 * A statement is written on the grid already, and the clip drops whatever is left under one
 * increment, so this never leaves a sliver no reviewer can act on.
 */
const stated = (options: {
  breaks: readonly BreakWindow[];
  statements: readonly PresenceStatement[];
  incrementMs: number;
}): BreakWindow[] => {
  if (!options.statements.length) return [...options.breaks];

  const away = statementWindows(options.statements, 'away');
  const drawn = away.length
    ? mergedBreaks([...options.breaks, ...away.map((window) => ({ ...window, locked: false }))])
    : options.breaks;

  return clippedToPresence({
    breaks: drawn,
    presence: statementWindows(options.statements, 'present'),
    incrementMs: options.incrementMs,
  });
};

/**
 * The day's breaks as the rows leave them, on the increment the rows are snapped to.
 *
 * A measured break runs from the last sample of presence to the next, so it lands on the minute the
 * user got up, while every row around it is on a quarter hour. Drawing both puts a break of 1h 21m
 * between two bands that stand 1h 30m apart, and no reviewer can act on that number. Where the rows
 * leave a gap, the gap is what the break is long: the measured window says *that* somebody was away,
 * and the gap says for how long.
 *
 * A break an agent ran through leaves no gap, because the agent's own blocks build a row across it.
 * That break is still drawn, snapped to the increment itself. The row keeps booking the time and
 * carries its own unattended marking; the break says nobody was there to do it.
 *
 * A measured break outside the rows is dropped, however early the machine was left. With no rows at
 * all there is nothing to read a grid or a gap from, so the measured breaks are returned as they are.
 */
export const breaksBetweenRows = (options: {
  breaks: readonly BreakWindow[];
  rows: readonly TimeWindow[];
  /** The increment the rows were snapped to. A break off that grid is drawn beside rows it cannot line up with. */
  round?: Partial<RoundOptions>;
  /**
   * The stretches the day holds as presence whatever the samples say: a call the user attended, and a
   * timer run they started. A break may not cover one — see ADR 0030.
   */
  presence?: readonly TimeWindow[];
  /** What the user said the day's stretches were. A statement outranks everything above it. */
  statements?: readonly PresenceStatement[];
}): BreakWindow[] => {
  const covered = mergeWindows(options.rows);
  const first = covered[0];
  const last = covered[covered.length - 1];

  const { incrementMs } = { ...DEFAULT_ROUND_OPTIONS, ...options.round };

  if (!first || !last) {
    return stated({ breaks: options.breaks, statements: options.statements ?? [], incrementMs }).sort(
      (a, b) => a.from.getTime() - b.from.getTime(),
    );
  }

  const span = { from: first.from, to: last.to };
  const gaps = subtractWindows({ windows: [span], without: covered });
  const inGap = (window: BreakWindow) => gaps.some((gap) => windowsOverlap(gap, window));

  const drawn = [
    ...gaps.flatMap((gap) => {
      const held = options.breaks.filter((window) => windowsOverlap(gap, window));

      return held.length ? [{ ...gap, locked: held.some((window) => window.locked) }] : [];
    }),
    ...options.breaks
      .filter((window) => !inGap(window) && windowsOverlap(span, window))
      .map((window) => snapped(window, incrementMs)),
  ];

  return stated({
    breaks: clippedToPresence({ breaks: drawn, presence: options.presence ?? [], incrementMs }),
    statements: options.statements ?? [],
    incrementMs,
  }).sort((a, b) => a.from.getTime() - b.from.getTime());
};
