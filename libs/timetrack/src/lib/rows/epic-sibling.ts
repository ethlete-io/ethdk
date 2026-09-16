import { GitFlowConfig, parseBranch, stripRefPrefix } from '@ethlete/agent-rules/git-flow';
import { ActivityContext, streamKey, streamKeyLabel } from '../model/block';
import { TimetrackProjectLink, projectKeyFor } from '../model/project-link';

/**
 * What one checkout books, the parent of that issue, and the parent's other open children —
 * pre-fetched by the caller, because the core makes no call of its own. See ADR 0029.
 */
export type EpicSibling = {
  /** The checkout the naming came from, as the collectors report it. */
  repoPath: string;
  /** The branch it was named on. */
  branch: string;
  issueKey: string;
  parentKey: string;
  /** The parent's issue type, such as `Epic`. Shown in the evidence so the ticket draft can read the level. */
  parentType: string;
  /** The parent's open children, capped at `epicChildLimit`. */
  siblingKeys: readonly string[];
  /** The cap cut the child list short, so elimination over it would be a guess. */
  truncated: boolean;
};

/** Everything the epic rung reads. Both lists are built by the caller, from the day's first pass. */
export type EpicOptions = {
  siblings: readonly EpicSibling[];
  /** Every issue key some checkout already books, so elimination can drop the children spoken for. */
  claimed: readonly string[];
};

/**
 * The part of a branch name two checkouts can share — `20260819_bracket-challenge` for both
 * `spec/20260819_bracket-challenge` and `feature/20260819_bracket-challenge`.
 *
 * A protected branch and a single-segment name both yield nothing: `master` and `wip` name no work
 * two repositories have in common, and joining them would name a band from a coincidence.
 */
export const branchSlugOf = (options: { branch: string; config: GitFlowConfig }) => {
  const branch = stripRefPrefix(options.branch);
  const parsed = parseBranch({ branch, config: options.config });

  if (parsed.kind === 'protected') return undefined;
  if (parsed.subject) return parsed.subject.toLowerCase();

  const segments = branch.split('/').filter(Boolean);

  return segments.length > 1 ? segments[segments.length - 1]?.toLowerCase() : undefined;
};

export type EpicSiblingMatch = {
  issueKey: string;
  parentKey: string;
  parentType: string;
  detail: string;
};

/**
 * The issue a checkout inherits from a sibling checkout that shares its branch slug: the sibling's
 * parent is read, and the one open child of that parent nobody else books names this block.
 *
 * It answers nothing unless every step is unambiguous. Several parents, several free children, a
 * child list the cap cut short, or no project link on either side all leave the block for the rungs
 * below — a wrong ticket costs more than an unnamed band. See ADR 0029.
 */
export const epicSiblingFor = (options: {
  context: ActivityContext;
  epics: EpicOptions;
  links: readonly TimetrackProjectLink[];
  config: GitFlowConfig;
}): EpicSiblingMatch | undefined => {
  const { context, epics, links, config } = options;
  const { repoPath, branch } = context;

  if (!repoPath || !branch || !epics.siblings.length) return undefined;

  const slug = branchSlugOf({ branch, config });
  const projectKey = projectKeyFor({ context, links });

  if (!slug || !projectKey) return undefined;

  const matches = epics.siblings.filter(
    (sibling) =>
      sibling.repoPath !== repoPath &&
      branchSlugOf({ branch: sibling.branch, config }) === slug &&
      projectKeyFor({ context: { repoPath: sibling.repoPath }, links }) === projectKey,
  );

  if (!matches.length) return undefined;

  const parents = new Set(matches.map((sibling) => sibling.parentKey));

  if (parents.size !== 1) return undefined;

  const sibling = matches[0];

  if (!sibling || sibling.truncated) return undefined;

  const claimed = new Set(epics.claimed);
  const free = sibling.siblingKeys.filter((key) => !claimed.has(key));
  const issueKey = free.length === 1 ? free[0] : undefined;

  if (!issueKey) return undefined;

  const label = streamKeyLabel(streamKey({ repoPath: sibling.repoPath }));

  return {
    issueKey,
    parentKey: sibling.parentKey,
    parentType: sibling.parentType,
    detail: `\`${label}\` books ${sibling.issueKey} on the same branch name; ${issueKey} is the only other open child of ${sibling.parentKey} (${sibling.parentType})`,
  };
};
