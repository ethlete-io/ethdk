import { Evidence } from './evidence';

/** What a stretch of time was spent in. Every field is optional — plenty of blocks are just an app. */
export type ActivityContext = {
  appId?: string;
  repoPath?: string;
  branch?: string;
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
 */
export const contextKey = (context: ActivityContext) =>
  context.repoPath ? `repo:${context.repoPath}@${context.branch ?? ''}` : `app:${context.appId ?? ''}`;

/**
 * Identity of a stream: the checkout, or the application when there is no checkout.
 *
 * The branch is deliberately not part of it, so a day that switched branch three times is one
 * stream. `contextKey` is the other identity here and it does carry the branch: it decides block
 * continuation, not which line of work a block belongs to.
 */
export const streamKey = (context: ActivityContext) =>
  context.repoPath ? `repo:${context.repoPath}` : `app:${context.appId ?? ''}`;
