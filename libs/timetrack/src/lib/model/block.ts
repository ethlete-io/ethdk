import { Evidence } from './evidence';

/** What a stretch of time was spent in. Every field is optional — plenty of blocks are just an app. */
export type ActivityContext = {
  appId?: string;
  repoPath?: string;
  branch?: string;
  /**
   * The directory the checkout's commits say this stretch worked in, where the branch cannot say which
   * piece of work it was. See `workPathOf` and `streamDay`.
   */
  workPath?: string;
};

/** Contiguous same-context time, after idle gaps have split it and sub-minute flapping is merged. */
export type ActivityBlock = {
  from: Date;
  to: Date;
  context: ActivityContext;
  evidence: Evidence[];
};

export const blockDurationMs = (block: ActivityBlock) => block.to.getTime() - block.from.getTime();

/**
 * Identity of a context, for deciding whether two adjacent samples continue the same block. A
 * repo and branch outrank the app: switching from the editor to the terminal inside the same
 * checkout is the same work, while the same editor on a different branch is not.
 *
 * A work path is left out of the key when there is none, so a checkout whose branch answers keeps the
 * key it always had — and every rule stored against one keeps matching.
 */
export const contextKey = (context: ActivityContext) => {
  if (!context.repoPath) return `app:${context.appId ?? ''}`;

  const key = `repo:${context.repoPath}@${context.branch ?? ''}`;

  return context.workPath ? `${key}#${context.workPath}` : key;
};

/**
 * The context a set of blocks stands for: the one that held the most of their time.
 *
 * Reading the first block's instead names a band after a context somebody passed through on the way
 * in - four minutes on a base branch spoke for a band whose other fifty-five were the branch the work
 * was actually on. A tie goes to the earlier block, so the answer never depends on the order the
 * blocks of two equally long contexts were built in.
 */
export const dominantContext = (blocks: readonly ActivityBlock[]): ActivityContext | undefined => {
  const held = new Map<string, { context: ActivityContext; ms: number }>();

  for (const block of blocks) {
    const key = contextKey(block.context);
    const found = held.get(key);

    if (found) found.ms += blockDurationMs(block);
    else held.set(key, { context: block.context, ms: blockDurationMs(block) });
  }

  let best: { context: ActivityContext; ms: number } | undefined;

  for (const entry of held.values()) if (!best || entry.ms > best.ms) best = entry;

  return best?.context;
};

/**
 * Identity of a stream: the checkout, or the application when there is no checkout.
 *
 * The branch is deliberately not part of it, so a day that switched branch three times is one
 * stream. `contextKey` is the other identity here and it does carry the branch: it decides block
 * continuation, not which line of work a block belongs to.
 */
export const streamKey = (context: ActivityContext) =>
  context.repoPath ? `repo:${context.repoPath}` : `app:${context.appId ?? ''}`;

/** The checkout a `streamKey` names, or nothing when it names an application instead. */
export const streamKeyRepoPath = (key: string) => (key.startsWith('repo:') ? key.slice('repo:'.length) : undefined);

/**
 * What a `streamKey` reads as on screen: the checkout's directory name, or the application's id.
 *
 * It lives beside `streamKey` because the two share the key's format, and a screen that parsed the
 * key itself would break the next time the format changes.
 */
export const streamKeyLabel = (key: string) => {
  if (key.startsWith('repo:')) {
    const path = key.slice('repo:'.length);

    return path.split('/').filter(Boolean).pop() ?? path;
  }

  return key.startsWith('app:') ? key.slice('app:'.length) : key;
};
