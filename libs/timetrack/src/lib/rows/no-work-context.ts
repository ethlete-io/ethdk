import { ActivityBlock, ActivityContext, blockDurationMs, contextKey } from '../model/block';

/** How long a transient window may hold the focus and still be read as chrome over the work. */
export const DEFAULT_MAX_TRANSIENT_MS = 5 * 60_000;

/**
 * How long any window that names no checkout may hold the focus and still be read as part of the work
 * around it rather than a line of work of its own.
 *
 * Two minutes, because it has to sit well under the shortest browsing anybody would book. A day of
 * real work flicks to a browser, a chat client and a terminal hundreds of times for a few seconds
 * each, and every one of those is a band of its own on the timeline without this.
 */
export const DEFAULT_MAX_GLANCE_MS = 2 * 60_000;

export type NoWorkContextOptions = {
  /**
   * Applications whose window names no work at all, `app_id` as the platform reports it. Their blocks
   * never become a row, so a media player gets no lane on the timeline and proposes no time.
   */
  apps?: readonly string[];
  /**
   * Applications whose own time is work, `app_id` as the platform reports it. Only these earn a lane
   * of their own when no checkout names the block. Every other application-only stretch folds into
   * the work around it, or is dropped.
   */
  workApps?: readonly string[];
  /**
   * Applications that open over the work rather than beside it — a file picker, a portal dialog. A
   * short one takes the context of the block it interrupted; anything else about it is dropped.
   */
  transientApps?: readonly string[];
  /** How long a `transientApps` window may hold the focus and still take the interrupted context. */
  maxTransientMs?: number;
  /**
   * How long a window that names no checkout may hold the focus and still be read as part of the work
   * it interrupted. Unlike `transientApps` this needs no list: it is the length that decides.
   */
  maxGlanceMs?: number;
};

const lower = (ids: readonly string[]) => new Set(ids.map((id) => id.toLowerCase()));

/**
 * The context the window interrupted: the block that ends where it starts, when the block that starts
 * where it ends is the same context again. Both sides are needed, because a dialog at the edge of a
 * stretch opened over nothing and there is no context to give it.
 */
const interrupted = (options: { block: ActivityBlock; blocks: readonly ActivityBlock[] }) => {
  const { block, blocks } = options;
  const before = blocks.find((other) => other !== block && other.to.getTime() === block.from.getTime());
  const after = blocks.find((other) => other !== block && other.from.getTime() === block.to.getTime());

  if (!before || !after) return undefined;

  return contextKey(before.context) === contextKey(after.context) ? before.context : undefined;
};

/**
 * Takes the blocks nothing can name work in out of a day, before any row is built from them.
 *
 * A block that names a checkout is kept whatever window held the focus: the checkout was named by
 * other evidence, and that evidence is work. The rules below apply to the rest.
 *
 * - An application on `apps` names no work at all. Its blocks are dropped, so a media player gets no
 *   lane on the timeline and proposes no time.
 * - An application on `workApps` holds work of its own. Its blocks are kept, so it earns a lane.
 * - Every other application-only block is read as time around the work rather than a line of work of
 *   its own. A short one takes the context it interrupted. The limit is `maxGlanceMs`, or
 *   `maxTransientMs` for an application on `transientApps`, which opens over the work rather than
 *   beside it. Anything longer, and anything that interrupted no single context, is dropped.
 *
 * The day's streams, its folded line and its `unnamedFocus` strip all read the unfiltered blocks, so
 * the minutes still reconcile with the Today screen and the strip still reports why each one named no
 * checkout. This only decides which blocks a row may be proposed from.
 */
export const dropNoWorkContext = (
  options: { blocks: readonly ActivityBlock[] } & NoWorkContextOptions,
): ActivityBlock[] => {
  const apps = lower(options.apps ?? []);
  const workApps = lower(options.workApps ?? []);
  const transientApps = lower(options.transientApps ?? []);
  const maxTransientMs = options.maxTransientMs ?? DEFAULT_MAX_TRANSIENT_MS;
  const maxGlanceMs = options.maxGlanceMs ?? DEFAULT_MAX_GLANCE_MS;
  const ordered = options.blocks.slice().sort((a, b) => a.from.getTime() - b.from.getTime());
  const kept: ActivityBlock[] = [];
  const namesWork = (context: ActivityContext) => {
    const appId = context.appId?.toLowerCase();

    return !!context.repoPath || (!!appId && workApps.has(appId));
  };

  for (const block of ordered) {
    const appId = block.context.appId?.toLowerCase();

    if (block.context.repoPath) {
      kept.push(block);
      continue;
    }

    if (appId && apps.has(appId)) continue;

    if (appId && workApps.has(appId)) {
      kept.push(block);
      continue;
    }

    const transient = !!appId && transientApps.has(appId);

    if (blockDurationMs(block) > (transient ? maxTransientMs : maxGlanceMs)) continue;

    const host = interrupted({ block, blocks: ordered });

    if (host && namesWork(host)) kept.push({ ...block, context: host });
  }

  return kept;
};
