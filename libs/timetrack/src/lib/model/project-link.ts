import { ActivityContext } from './block';
import { normalizeLinkPath } from './link-path';

/**
 * What work under a path belongs to.
 *
 * `private` is the answer for a side project on the same machine: the same editor, the same window
 * title, and none of it billable. It is not an attribution outcome but the absence of one — private
 * time proposes nothing and is owed to nobody.
 */
export type ProjectLinkTarget =
  | {
      kind: 'project';
      projectKey: string;
      /** The epics the work under the path belongs to. Their open children are offered first as the work. */
      epicKeys?: string[];
    }
  | { kind: 'private' };

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

/** `path` is the link itself or sits under it. The separator is what keeps `dev-old` out of `dev`. */
const covers = (link: string, path: string) => path === link || path.startsWith(`${link}/`);

/**
 * Whether `path` is `root` itself or sits under it, by the same rule a link covers a checkout — a
 * trailing slash and a directory boundary both read the way they do in the settings list.
 */
export const pathIsUnder = (root: string, path: string) => {
  const from = normalizeLinkPath(root);

  return !!from && covers(from, normalizeLinkPath(path));
};

const matchesByLinks = new WeakMap<readonly TimetrackProjectLink[], Map<string, TimetrackProjectLink | undefined>>();

const bestLinkFor = (options: { path: string; links: readonly TimetrackProjectLink[] }) => {
  const { path } = options;

  if (!path) return undefined;

  return options.links
    .filter((link) => {
      const linkPath = normalizeLinkPath(link.path);

      return !!linkPath && covers(linkPath, path);
    })
    .sort(
      (a, b) =>
        normalizeLinkPath(b.path).length - normalizeLinkPath(a.path).length ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    )[0];
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
  const repoPath = options.context.repoPath ?? '';
  let matches = matchesByLinks.get(options.links);

  if (!matches) matchesByLinks.set(options.links, (matches = new Map()));
  if (matches.has(repoPath)) return matches.get(repoPath);

  const match = bestLinkFor({ path: normalizeLinkPath(repoPath), links: options.links });

  matches.set(repoPath, match);

  return match;
};

/**
 * The links, with each linked worktree filed the way its main checkout is filed.
 *
 * `worktrees` maps a linked worktree's path to its main checkout's path, as `git worktree list` names
 * them. A link stored on a worktree answers for it only while its main checkout has none.
 */
export const withWorktreeLinks = (options: {
  links: readonly TimetrackProjectLink[];
  worktrees: Readonly<Record<string, string>>;
}): readonly TimetrackProjectLink[] => {
  const worktreePaths = new Set(Object.keys(options.worktrees).map(normalizeLinkPath).filter(Boolean));
  const ownLinks = options.links.filter((link) => !worktreePaths.has(normalizeLinkPath(link.path)));
  const overridden = new Set<string>();

  const derived = Object.entries(options.worktrees).flatMap(([worktree, main]) => {
    const path = normalizeLinkPath(worktree);
    const link = path ? bestLinkFor({ path: normalizeLinkPath(main), links: ownLinks }) : undefined;

    if (!link) return [];

    overridden.add(path);

    return [{ ...link, path }];
  });

  if (!derived.length) return options.links;

  return [...options.links.filter((link) => !overridden.has(normalizeLinkPath(link.path))), ...derived];
};

/** The Jira project a context files its tickets in, or nothing when no link names one. */
export const projectKeyFor = (options: { context: ActivityContext; links: readonly TimetrackProjectLink[] }) => {
  const target = matchProjectLink(options)?.target;

  return target?.kind === 'project' ? target.projectKey : undefined;
};

/** The epics the link covering a context names, or none. */
export const epicKeysFor = (options: { context: ActivityContext; links: readonly TimetrackProjectLink[] }) => {
  const target = matchProjectLink(options)?.target;

  return target?.kind === 'project' ? (target.epicKeys ?? []) : [];
};

/** The issue keys typed into a list, upper-cased, each once. Anything that is not a key is dropped. */
export const issueKeysInText = (text: string) => [
  ...new Set(
    text
      .split(/[\s,;]+/)
      .map((word) => word.trim().toUpperCase())
      .filter((word) => /^[A-Z][A-Z0-9_]*-\d+$/.test(word)),
  ),
];

/** Reads as something the user can recognise in a list or an evidence chain: `side-project`. */
export const describeProjectLink = (link: Pick<TimetrackProjectLink, 'path'>) =>
  normalizeLinkPath(link.path).split('/').filter(Boolean).pop() ?? link.path;
