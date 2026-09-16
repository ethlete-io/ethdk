import { GitFlowConfig, parseBranch, stripRefPrefix } from '@ethlete/agent-rules/git-flow';
import { AttributionRule, issueKeyOf } from '../model/attribution';
import { ActivityBlock, ActivityContext, streamKey, streamKeyLabel, streamKeyRepoPath } from '../model/block';
import { TimetrackProjectLink, projectKeyFor } from '../model/project-link';
import { WorklogProposal } from '../model/proposal';
import { WorkGroup } from './merge';

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

/** One checkout's naming, before Jira has been asked what it hangs under. */
export type EpicCandidate = {
  repoPath: string;
  branch: string;
  issueKey: string;
};

/**
 * What a day has to ask Jira before the rung can answer, and nothing more.
 *
 * No candidate means no call: the whole question only exists for a checkout that is still unnamed, so
 * a day the other rungs answered in full must not cost a request. See ADR 0029.
 */
export type EpicQuestion = {
  candidates: EpicCandidate[];
  /** Every issue key some checkout already books, which is what elimination takes away. */
  claimed: string[];
};

const NO_QUESTION: EpicQuestion = { candidates: [], claimed: [] };

/** Every branch each checkout was seen on, which is where a row's branch comes from — a row keeps none. */
const branchesByRepo = (blocks: readonly ActivityBlock[]) => {
  const found = new Map<string, Set<string>>();

  for (const block of blocks) {
    const { repoPath, branch } = block.context;

    if (!repoPath || !branch) continue;

    const branches = found.get(repoPath) ?? new Set<string>();

    branches.add(branch);
    found.set(repoPath, branches);
  }

  return found;
};

/**
 * What the day's first pass leaves for the epic rung, narrowed before anything is fetched: the slugs
 * nothing named, and the checkouts that share one and do have a name.
 *
 * A checkout's own answer comes from the user's rules first, because a rule carries the branch it was
 * written for. A row carries only its lane, so its branch is read back from the day's blocks.
 */
export const epicQuestionOf = (options: {
  blocks: readonly ActivityBlock[];
  unattributed: readonly WorkGroup[];
  proposals: readonly WorklogProposal[];
  rules: readonly AttributionRule[];
  config: GitFlowConfig;
}): EpicQuestion => {
  const { config } = options;
  const slugs = new Set<string>();

  for (const group of options.unattributed) {
    for (const block of group.blocks) {
      const { repoPath, branch } = block.context;

      if (!repoPath || !branch) continue;

      const slug = branchSlugOf({ branch, config });

      if (slug) slugs.add(slug);
    }
  }

  if (!slugs.size) return NO_QUESTION;

  const branches = branchesByRepo(options.blocks);

  const fromRules = options.rules.flatMap((rule): EpicCandidate[] => {
    const issueKey = issueKeyOf(rule);

    if (!rule.repoPath || !rule.branch || !issueKey) return [];

    const slug = branchSlugOf({ branch: rule.branch, config });

    return slug && slugs.has(slug) ? [{ repoPath: rule.repoPath, branch: rule.branch, issueKey }] : [];
  });

  const fromDay = options.proposals.flatMap((proposal): EpicCandidate[] => {
    const repoPath = proposal.laneKey ? streamKeyRepoPath(proposal.laneKey) : undefined;

    if (!repoPath || !proposal.issueKey) return [];

    return [...(branches.get(repoPath) ?? [])].flatMap((branch) => {
      const slug = branchSlugOf({ branch, config });

      return slug && slugs.has(slug) ? [{ repoPath, branch, issueKey: proposal.issueKey }] : [];
    });
  });

  const candidates = [...fromRules, ...fromDay];

  if (!candidates.length) return NO_QUESTION;

  const claimed = [
    ...new Set([
      ...options.proposals.flatMap((proposal) => proposal.issueKey || []),
      ...options.rules.flatMap((rule) => issueKeyOf(rule) ?? []),
    ]),
  ];

  return { candidates, claimed };
};
