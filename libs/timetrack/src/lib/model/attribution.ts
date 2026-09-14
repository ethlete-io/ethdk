import { stripRefPrefix } from '@ethlete/agent-rules/git-flow';
import { ActivityContext, contextKey } from './block';

/** How narrowly a rule is aimed, which is also how much a match is worth. */
export type AttributionScope = 'branch' | 'repo' | 'app';

/**
 * What a naming points at, wherever one is given: an attribution rule, a remembered call.
 *
 * `stand-in` names work Jira does not hold yet. It books nothing, and one rewrite of every rule that
 * carries it turns the whole set into `issue`. See `StandIn` and ADR 0021.
 */
export type NamedTarget = { kind: 'issue'; issueKey: string } | { kind: 'stand-in'; standInId: string };

/**
 * What time in a context is logged against.
 *
 * `donate` is the answer for a project that has no tracker of its own — a shared library, a tooling
 * repository. Its time is real work, and it is done *for* whatever else was open that day, so it joins
 * the neighbouring work instead of becoming a row nobody can file. See `donateBlocks`. It is a rule's
 * answer alone: a call is a fixed stretch of the day and has no neighbouring work to join.
 */
export type AttributionTarget = NamedTarget | { kind: 'donate' };

/**
 * Who wrote a naming down. An agent may prepare one, and the review shows it differently, so a day
 * never hides which of its answers the user gave and which one it was handed. See ADR 0012.
 */
export type NamingAuthor = 'user' | 'agent';

/**
 * A standing statement about what work in one context belongs to — the answer for a repository whose
 * branch names carry no issue key at all.
 *
 * A rule is written by naming a stretch of unattributed work or by writing one in settings, so it is
 * a decision rather than an inference. What it is not is a guess the app may make on its own: nothing
 * here learns without being told, and `author` says whose decision it was.
 */
export type AttributionRule = {
  id: string;
  /** The repository the rule applies to, as the absolute path the collectors report. */
  repoPath?: string;
  /** Restricts the rule to one branch of `repoPath`. Without it the whole repository matches. */
  branch?: string;
  /** Matches work that has no repository at all, such as a browser or a chat client. */
  appId?: string;
  target: AttributionTarget;
  author: NamingAuthor;
  createdAt: Date;
};

/** The issue a rule names, or nothing when it names a stand-in or donates its time instead. */
export const issueKeyOf = (rule: AttributionRule) => (rule.target.kind === 'issue' ? rule.target.issueKey : undefined);

/** The stand-in a rule names, or nothing when it names an issue or donates its time instead. */
export const standInIdOf = (rule: AttributionRule) =>
  rule.target.kind === 'stand-in' ? rule.target.standInId : undefined;

export type AttributionRuleMatch = {
  rule: AttributionRule;
  scope: AttributionScope;
};

const scopeOf = (rule: AttributionRule): AttributionScope | undefined => {
  if (rule.repoPath && rule.branch) return 'branch';
  if (rule.repoPath) return 'repo';

  return rule.appId ? 'app' : undefined;
};

/** Most specific first, so a branch rule beats the repository rule it sits inside. */
const SCOPE_RANK: Record<AttributionScope, number> = { branch: 0, repo: 1, app: 2 };

const matches = (options: { rule: AttributionRule; context: ActivityContext; scope: AttributionScope }) => {
  const { rule, context, scope } = options;

  if (scope === 'app') return !!context.appId && context.appId === rule.appId;
  if (context.repoPath !== rule.repoPath) return false;
  if (scope === 'repo') return true;

  /** A checkout reports `next` and a merge request `refs/heads/next`; both name the same branch. */
  return !!context.branch && !!rule.branch && stripRefPrefix(context.branch) === stripRefPrefix(rule.branch);
};

/**
 * The narrowest rule that covers a context, or nothing. A rule naming both a repository and a branch
 * is a statement about one piece of work; one naming a repository alone is a statement about a whole
 * project, and the two are worth different amounts — see `attribute`, which reads them at different
 * rungs of the ladder rather than treating a match as a match.
 */
export const matchAttributionRule = (options: {
  context: ActivityContext;
  rules: readonly AttributionRule[];
}): AttributionRuleMatch | undefined => {
  const found: AttributionRuleMatch[] = [];

  for (const rule of options.rules) {
    const scope = scopeOf(rule);

    if (scope && matches({ rule, context: options.context, scope })) found.push({ rule, scope });
  }

  return found.sort(
    (a, b) => SCOPE_RANK[a.scope] - SCOPE_RANK[b.scope] || b.rule.createdAt.getTime() - a.rule.createdAt.getTime(),
  )[0];
};

/**
 * One context the day could not name an issue for, with how much time is waiting on it.
 *
 * This is what a review offers the user to name, rather than the individual blocks: in a repository
 * without the branch grammar a day fragments into a dozen unattributed blocks that are all the same
 * work, and answering the same question a dozen times is how a reviewer stops reviewing.
 */
export type UnnamedContext = {
  /** Stable across re-runs of a day — `contextKey`, so a pending edit survives a re-correlation. */
  id: string;
  context: ActivityContext;
  observedMs: number;
  from: Date;
  to: Date;
  /** The rule naming this context would create, ready to be given a target. */
  suggestion: Pick<AttributionRule, 'repoPath' | 'branch' | 'appId'>;
};

/** The rule that would name this context, ready to be given a target. */
export const suggestionFor = (context: ActivityContext): UnnamedContext['suggestion'] =>
  context.repoPath ? { repoPath: context.repoPath, branch: context.branch } : { appId: context.appId };

/**
 * What the reasoning provider proposes one unnamed context belongs to.
 *
 * It is not an `AttributionRule` and must never be stored as one: a rule is a standing statement the
 * user made, and this is a guess about one context on one day. It matches by `contextId` alone rather
 * than by scope, so an answer can only ever reach the exact context the provider was shown.
 */
export type InferredAttribution = {
  /** The `UnnamedContext.id` — a `contextKey` — this answers. */
  contextId: string;
  issueKey: string;
  /** One sentence in the user's own terms, shown verbatim in the evidence chain and on the card. */
  reason: string;
};

/** The answer for exactly this context, or nothing. */
export const matchInferredAttribution = (options: {
  context: ActivityContext;
  inferred: readonly InferredAttribution[];
}) => {
  const id = contextKey(options.context);

  return options.inferred.find((entry) => entry.contextId === id);
};

/** Reads as a context the user can recognise, in a list or an evidence chain: `ea-frontend @ next`. */
export const describeAttributionRule = (rule: Pick<AttributionRule, 'repoPath' | 'branch' | 'appId'>) => {
  if (rule.appId) return rule.appId;

  const repo = rule.repoPath?.split('/').filter(Boolean).pop() ?? rule.repoPath ?? '';

  return rule.branch ? `${repo} @ ${rule.branch}` : repo;
};
