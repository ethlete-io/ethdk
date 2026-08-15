import { stripRefPrefix } from '@ethlete/agent-rules/git-flow';
import { ActivityContext, blockDurationMs, contextKey } from '../model/block';
import { WorkGroup } from './merge';

/** How narrowly a rule is aimed, which is also how much a match is worth. */
export type AttributionScope = 'branch' | 'repo' | 'app';

/**
 * What time in a context is logged against.
 *
 * `donate` is the answer for a project that has no tracker of its own — a shared library, a tooling
 * repository. Its time is real work, and it is done *for* whatever else was open that day, so it joins
 * the neighbouring work instead of becoming a row nobody can file. See `donateBlocks`.
 */
export type AttributionTarget = { kind: 'issue'; issueKey: string } | { kind: 'donate' };

/**
 * A standing statement about what work in one context belongs to — the answer for a repository whose
 * branch names carry no issue key at all.
 *
 * A rule is only ever created by the user, either by naming a stretch of unattributed work or by
 * writing one in settings, so it is a decision rather than an inference. What it is not is a guess
 * the app may make on its own: nothing here learns without being told.
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
  createdAt: Date;
};

/** The issue a rule names, or nothing when it donates its time instead. */
export const issueKeyOf = (rule: AttributionRule) => (rule.target.kind === 'issue' ? rule.target.issueKey : undefined);

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

const suggestionFor = (context: ActivityContext): UnnamedContext['suggestion'] =>
  context.repoPath ? { repoPath: context.repoPath, branch: context.branch } : { appId: context.appId };

/**
 * Folds the day's unattributed groups into the contexts behind them, widest first. A group carrying
 * no context at all — a meeting, a timer run — is left out: there is nothing to write a rule about,
 * and those are named on the rows themselves.
 */
export const unnamedContexts = (options: { unattributed: readonly WorkGroup[] }): UnnamedContext[] => {
  const found = new Map<string, UnnamedContext>();

  for (const group of options.unattributed) {
    for (const block of group.blocks) {
      const { context } = block;

      if (!context.repoPath && !context.appId) continue;

      const id = contextKey(context);
      const existing = found.get(id);
      const observedMs = blockDurationMs(block);

      if (!existing) {
        found.set(id, { id, context, observedMs, from: block.from, to: block.to, suggestion: suggestionFor(context) });
        continue;
      }

      existing.observedMs += observedMs;
      if (block.from < existing.from) existing.from = block.from;
      if (block.to > existing.to) existing.to = block.to;
    }
  }

  return [...found.values()].sort((a, b) => b.observedMs - a.observedMs);
};

/** Reads as a context the user can recognise, in a list or an evidence chain: `ea-frontend @ next`. */
export const describeAttributionRule = (rule: Pick<AttributionRule, 'repoPath' | 'branch' | 'appId'>) => {
  if (rule.appId) return rule.appId;

  const repo = rule.repoPath?.split('/').filter(Boolean).pop() ?? rule.repoPath ?? '';

  return rule.branch ? `${repo} @ ${rule.branch}` : repo;
};
