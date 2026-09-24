import { ActivityContext } from './block';

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
 * Whether `path` is `root` itself or sits under it, by the same rule a link covers a checkout — a
 * trailing slash and a directory boundary both read the way they do in the settings list.
 */
export const pathIsUnder = (root: string, path: string) => {
  const from = normalize(root);

  return !!from && covers(from, normalize(path));
};

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

/**
 * The links, plus one per linked worktree that files it the way its main checkout is filed.
 *
 * `worktrees` maps a linked worktree's path to its main checkout's path, as `git worktree list` names
 * them. A link the user put on the worktree itself is left to answer for it.
 */
export const withWorktreeLinks = (options: {
  links: readonly TimetrackProjectLink[];
  worktrees: Readonly<Record<string, string>>;
}): readonly TimetrackProjectLink[] => {
  const derived = Object.entries(options.worktrees).flatMap(([worktree, main]) => {
    const path = normalize(worktree);

    if (!path || options.links.some((link) => normalize(link.path) === path)) return [];

    const link = matchProjectLink({ context: { repoPath: main }, links: options.links });

    return link ? [{ ...link, path }] : [];
  });

  return derived.length ? [...options.links, ...derived] : options.links;
};

/** The Jira project a context files its tickets in, or nothing when no link names one. */
export const projectKeyFor = (options: { context: ActivityContext; links: readonly TimetrackProjectLink[] }) => {
  const target = matchProjectLink(options)?.target;

  return target?.kind === 'project' ? target.projectKey : undefined;
};

/** Reads as something the user can recognise in a list or an evidence chain: `side-project`. */
export const describeProjectLink = (link: Pick<TimetrackProjectLink, 'path'>) =>
  normalize(link.path).split('/').filter(Boolean).pop() ?? link.path;
