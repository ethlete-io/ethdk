import { ActivityBlock, ActivityContext, contextKey } from '../model/block';
import { Evidence } from '../model/evidence';
import { TimeWindow, clipWindows, mergeWindows } from '../model/time-window';

/** A stretch of time and the context that held it, before its neighbours are joined into a block. */
export type ContextSpan = TimeWindow & { context: ActivityContext };

/** One observation and where it was made, for the block that ends up holding its instant. */
export type ContextObservation = { at: Date; context: ActivityContext; evidence: Evidence };

const addEvidence = (into: Evidence[], evidence: Evidence) => {
  if (into.some((entry) => entry.kind === evidence.kind && entry.detail === evidence.detail)) return;

  into.push(evidence);
};

/** How far an instant sits outside a block. Zero while the block holds it. */
const distanceTo = (block: ActivityBlock, at: Date) =>
  Math.max(0, block.from.getTime() - at.getTime(), at.getTime() - block.to.getTime());

/**
 * The shortest stretch of focus that becomes a block.
 *
 * A window source re-emits focus when a window's title changes, and a background window whose title
 * churns therefore lands a stretch of a second or two in the middle of somebody else's work. Kept as
 * a block, each one is a band of its own on the day screen: a lane holding a quarter of an hour is
 * drawn as twenty slivers, none of which a reader can name.
 *
 * The dropped time stays in the day's stream totals, which are measured from the windows rather than
 * from the blocks. Only the timeline stops drawing it.
 */
export const DEFAULT_MIN_BLOCK_MS = 5_000;

/**
 * The context that stands for a set of spans sharing one key: the one that held the most of their
 * time.
 *
 * A key does not fix every field of the context behind it. One session's spans carry whichever
 * branch the checkout was on at the time, and reading the first of them names a whole session after
 * a branch it passed through for a minute on the way in.
 */
const longestContext = (spans: readonly [ContextSpan, ...ContextSpan[]]) => {
  const held = new Map<string, { context: ActivityContext; ms: number }>();

  for (const span of spans) {
    const key = `${span.context.branch ?? ''}#${span.context.workPath ?? ''}#${span.context.appId ?? ''}`;
    const found = held.get(key);
    const ms = span.to.getTime() - span.from.getTime();

    if (found) found.ms += ms;
    else held.set(key, { context: span.context, ms });
  }

  let best: { context: ActivityContext; ms: number } | undefined;

  for (const entry of held.values()) if (!best || entry.ms > best.ms) best = entry;

  return best?.context ?? spans[0].context;
};

/**
 * Turns the stretches `streamDay` attributed into the contiguous same-context blocks a row is built
 * from, and hangs each observation on the block that holds it.
 *
 * Spans of one context are unioned, so a block never overlaps another block of the same context and
 * the blocks of one checkout sum to the time its stream reports. Spans of different contexts are left
 * to overlap: two contexts running at once is what a concurrent day is, and each books its full time.
 *
 * An observation outside every block of its own context goes to the nearest one rather than being
 * dropped. Its context has that time and no other, so a commit at the edge of a clipped stretch still
 * labels the work it was made in.
 */
export const blocksFromSpans = (options: {
  spans: readonly ContextSpan[];
  observations: readonly ContextObservation[];
  /** Defaults to `DEFAULT_MIN_BLOCK_MS`. */
  minBlockMs?: number;
}): ActivityBlock[] => {
  const minBlockMs = options.minBlockMs ?? DEFAULT_MIN_BLOCK_MS;
  const byContext = new Map<string, { spans: [ContextSpan, ...ContextSpan[]]; windows: TimeWindow[] }>();

  for (const span of options.spans) {
    if (span.to <= span.from) continue;

    const key = contextKey(span.context);
    const held = byContext.get(key);

    if (held) {
      held.spans.push(span);
      held.windows.push({ from: span.from, to: span.to });
    } else byContext.set(key, { spans: [span], windows: [{ from: span.from, to: span.to }] });
  }

  const blocks = new Map<string, ActivityBlock[]>();

  for (const [key, held] of byContext) {
    const context = longestContext(held.spans);

    blocks.set(
      key,
      mergeWindows(held.windows)
        .filter((window) => window.to.getTime() - window.from.getTime() >= minBlockMs)
        .map((window) => ({ ...window, context, evidence: [] })),
    );
  }

  for (const observation of options.observations) {
    const candidates = blocks.get(contextKey(observation.context));
    const target = candidates?.reduce<ActivityBlock | undefined>(
      (closest, block) =>
        !closest || distanceTo(block, observation.at) < distanceTo(closest, observation.at) ? block : closest,
      undefined,
    );

    if (target) addEvidence(target.evidence, observation.evidence);
  }

  return [...blocks.values()]
    .flat()
    .sort((a, b) => a.from.getTime() - b.from.getTime() || contextKey(a.context).localeCompare(contextKey(b.context)))
    .map((block) => ({
      ...block,
      evidence: block.evidence.slice().sort((a, b) => a.at.getTime() - b.at.getTime()),
    }));
};

/** The parts of the spans that fall inside `within`, each part keeping the context of its span. */
export const clipSpans = (options: { spans: readonly ContextSpan[]; within: readonly TimeWindow[] }): ContextSpan[] =>
  options.spans.flatMap((span) =>
    clipWindows({ windows: [span], within: options.within }).map((window) => ({ ...window, context: span.context })),
  );
