import { TimetrackProjectLink, projectKeyFor } from '../correlate/project-link';
import { AttributionRule, issueKeyOf } from '../correlate/rules';
import { ActivityContext } from '../model/block';
import { WorklogProposal } from '../model/proposal';

/** `FIP-2177` names project `FIP`. A key with no project part names nothing. */
export const projectKeyOf = (issueKey: string) =>
  /^([A-Za-z][A-Za-z0-9_]*)-\d+$/.exec(issueKey.trim())?.[1]?.toUpperCase();

const onlyOne = (keys: readonly string[]) => {
  const found = [...new Set(keys.filter(Boolean))];

  return found.length === 1 ? found[0] : undefined;
};

const fromRules = (options: { context: ActivityContext; rules: readonly AttributionRule[] }) => {
  const { repoPath } = options.context;

  if (!repoPath) return undefined;

  return onlyOne(
    options.rules
      .filter((rule) => rule.repoPath === repoPath)
      .flatMap((rule) => projectKeyOf(issueKeyOf(rule) ?? '') ?? []),
  );
};

/**
 * The Jira project a new ticket for this context belongs in, or nothing when the day cannot say.
 *
 * Four rungs, strongest first: the project a link names for this path, a rule the user already wrote
 * about this very repository, the single project this machine is configured for, and the day's own
 * work when all of it sits in one project. Nothing here guesses between two projects — filing into
 * the wrong one is worse than an empty field, because a ticket cannot be moved by the person who has
 * to explain it.
 */
export const inferTicketProjectKey = (options: {
  context: ActivityContext;
  rules: readonly AttributionRule[];
  proposals: readonly WorklogProposal[];
  prefixes: readonly string[];
  links?: readonly TimetrackProjectLink[];
}) =>
  projectKeyFor({ context: options.context, links: options.links ?? [] }) ??
  fromRules(options) ??
  onlyOne(options.prefixes.map((prefix) => prefix.toUpperCase())) ??
  onlyOne(options.proposals.flatMap((proposal) => projectKeyOf(proposal.issueKey) ?? []));
