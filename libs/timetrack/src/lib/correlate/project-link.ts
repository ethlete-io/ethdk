import { ActivityBlock, ActivityContext, blockDurationMs } from '../model/block';

/**
 * What work under a path belongs to.
 *
 * `private` is the answer for a side project on the same machine: the same editor, the same window
 * title, and none of it billable. It is not an attribution outcome but the absence of one — private
 * time proposes nothing and is owed to nobody.
 */
export type ProjectLinkTarget = { kind: 'project'; projectKey: string } | { kind: 'private' };

/**
 * A standing statement about a path — one repository, or a directory root covering everything beneath
 * it.
 *
 * A link and an `AttributionRule` answer two different questions, which is why they are two lists. A
 * rule says which issue a context's time is logged against; a link says whether the time is work at
 * all, and which project it would be filed in. One repository wants both: it is linked to `FIP`, and
 * it may still carry a branch rule naming one issue.
 */
export type TimetrackProjectLink = {
  id: string;
  /** An absolute path, as the collectors report it. A directory root covers the repositories in it. */
  path: string;
  target: ProjectLinkTarget;
  createdAt: Date;
};

const normalize = (path: string) => path.trim().replace(/\/+$/, '');

/** `path` is the link itself or sits under it. The separator is what keeps `dev-old` out of `dev`. */
const covers = (link: string, path: string) => path === link || path.startsWith(`${link}/`);

/**
 * The link covering a context, longest path first — so a link on one repository beats the root it sits
 * in. That order is the whole point of allowing a root: a user marks `~/dev` private once, and still
 * links the two client checkouts inside it.
 *
 * A context with no repository never matches. A browser and a chat client are named by the app rules,
 * and a path is the only thing a link knows how to read.
 */
export const matchProjectLink = (options: {
  context: ActivityContext;
  links: readonly TimetrackProjectLink[];
}): TimetrackProjectLink | undefined => {
  const path = normalize(options.context.repoPath ?? '');

  if (!path) return undefined;

  return options.links
    .filter((link) => {
      const linkPath = normalize(link.path);

      return !!linkPath && covers(linkPath, path);
    })
    .sort(
      (a, b) => normalize(b.path).length - normalize(a.path).length || b.createdAt.getTime() - a.createdAt.getTime(),
    )[0];
};

/** The Jira project a context files its tickets in, or nothing when no link names one. */
export const projectKeyFor = (options: { context: ActivityContext; links: readonly TimetrackProjectLink[] }) => {
  const target = matchProjectLink(options)?.target;

  return target?.kind === 'project' ? target.projectKey : undefined;
};

/** Reads as something the user can recognise in a list or an evidence chain: `side-project`. */
export const describeProjectLink = (link: Pick<TimetrackProjectLink, 'path'>) =>
  normalize(link.path).split('/').filter(Boolean).pop() ?? link.path;

/** One private path, with how much of the day it covered. What the day view labels rather than bills. */
export type PrivateTime = {
  link: TimetrackProjectLink;
  observedMs: number;
  from: Date;
  to: Date;
};

/**
 * Folds private blocks into the links that made them private, largest first. The day still reports
 * them: a user who cannot see that the app watched has no way to tell a working link from a broken
 * one, which is the same promise the pause button makes.
 */
export const privateTime = (options: {
  blocks: readonly { block: ActivityBlock; link: TimetrackProjectLink }[];
}): PrivateTime[] => {
  const found = new Map<string, PrivateTime>();

  for (const { block, link } of options.blocks) {
    const existing = found.get(link.id);
    const observedMs = blockDurationMs(block);

    if (!existing) {
      found.set(link.id, { link, observedMs, from: block.from, to: block.to });
      continue;
    }

    existing.observedMs += observedMs;
    if (block.from < existing.from) existing.from = block.from;
    if (block.to > existing.to) existing.to = block.to;
  }

  return [...found.values()].sort((a, b) => b.observedMs - a.observedMs);
};
