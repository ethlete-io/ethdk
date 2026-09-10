import { ActivityBlock, blockDurationMs, contextKey } from '../model/block';

/** How long a transient window may hold the focus and still be read as chrome over the work. */
export const DEFAULT_MAX_TRANSIENT_MS = 5 * 60_000;

export type NoWorkContextOptions = {
  /**
   * Applications whose window names no work at all, `app_id` as the platform reports it. Their blocks
   * never become a row, so a media player gets no lane on the timeline and proposes no time.
   */
  apps?: readonly string[];
  /**
   * Applications that open over the work rather than beside it — a file picker, a portal dialog. A
   * short one takes the context of the block it interrupted; anything else about it is dropped.
   */
  transientApps?: readonly string[];
  /** How long a `transientApps` window may hold the focus and still take the interrupted context. */
  maxTransientMs?: number;
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
 * Takes the blocks no application on these lists can name work in out of a day, before any row is
 * built from them.
 *
 * A block that names a checkout is kept whatever window held the focus: the checkout was named by
 * other evidence, and that evidence is work. Only a block that names nothing but the application is
 * dropped, which is the block that would otherwise become a lane of its own on the timeline.
 *
 * The day's streams, its folded line and its `unnamedFocus` strip all read the unfiltered blocks, so
 * the minutes still reconcile with the Today screen and the strip still reports why each one named no
 * checkout. This only decides which blocks a row may be proposed from.
 */
export const dropNoWorkContext = (
  options: { blocks: readonly ActivityBlock[] } & NoWorkContextOptions,
): ActivityBlock[] => {
  const apps = lower(options.apps ?? []);
  const transientApps = lower(options.transientApps ?? []);

  if (!apps.size && !transientApps.size) return [...options.blocks];

  const maxTransientMs = options.maxTransientMs ?? DEFAULT_MAX_TRANSIENT_MS;
  const ordered = options.blocks.slice().sort((a, b) => a.from.getTime() - b.from.getTime());
  const kept: ActivityBlock[] = [];

  for (const block of ordered) {
    const appId = block.context.appId?.toLowerCase();

    if (!appId || block.context.repoPath) {
      kept.push(block);
      continue;
    }

    if (apps.has(appId)) continue;

    if (!transientApps.has(appId)) {
      kept.push(block);
      continue;
    }

    if (blockDurationMs(block) > maxTransientMs) continue;

    const host = interrupted({ block, blocks: ordered });

    if (host) kept.push({ ...block, context: host });
  }

  return kept;
};
