import {
  BranchParseResult,
  DEFAULT_GIT_FLOW_CONFIG,
  GitFlowConfig,
  parseBranch,
  resolveThroughBase,
  stripRefPrefix,
} from '@ethlete/agent-rules/git-flow';
import { ActivityBlock } from '../model/block';
import { Confidence, Evidence } from '../model/evidence';
import { RecurringPattern, patternAt } from './recurrence';

export type AttributedBlock = {
  block: ActivityBlock;
  /** The issue the time should be logged against. Absent means nothing could attribute it. */
  issueKey?: string;
  storyKey?: string;
  taskKey?: string;
  confidence: Confidence;
  /** The block's own evidence plus whatever attribution added, in the order it was found. */
  evidence: Evidence[];
};

/**
 * An issue a provider saw the user in outside this machine — a merge request they pushed to, an
 * issue they opened. Pre-fetched by the provider: the core never makes a call of its own.
 */
export type IssueActivity = {
  kind: 'merge-request' | 'issue-view';
  issueKey: string;
  at: Date;
  /** The merge request's source branch, when the activity came from one. */
  branch?: string;
  /** Shown verbatim in review — "merge request !412 on `feat/FIP-2177-club-pack`". */
  detail: string;
  /** The wording this lends to a description, such as a merge request title. */
  summary?: string;
};

export type AttributeOptions = {
  config?: GitFlowConfig;
  /**
   * The branch a keyless branch is based on — the merge-base locally, or the MR target. Returning
   * nothing is normal and simply leaves the block keyless.
   */
  resolveBase?: (branch: string) => string | undefined;
  /** Merge request and issue-view activity for the day, from the Jira and GitLab providers. */
  activity?: IssueActivity[];
  /** Standing commitments read out of Tempo history by `detectRecurringPatterns`. */
  patterns?: RecurringPattern[];
};

const keyFromTitle = (title: string, config: GitFlowConfig) => {
  const match = new RegExp(config.keyPattern).exec(title);
  if (!match) return undefined;

  const key = match[0];
  const prefix = key.slice(0, key.indexOf('-'));

  return config.keyPrefixes.length > 0 && !config.keyPrefixes.includes(prefix) ? undefined : key;
};

const resolveBranch = (options: {
  branch: string;
  config: GitFlowConfig;
  resolveBase: AttributeOptions['resolveBase'];
}): BranchParseResult => {
  const { branch, config, resolveBase } = options;
  const parsed = parseBranch({ branch, config });

  if (parsed.storyKey || !resolveBase) return parsed;

  const baseName = resolveBase(branch);

  return baseName ? resolveThroughBase({ branch: parsed, base: parseBranch({ branch: baseName, config }) }) : parsed;
};

/**
 * A merge request opened for exactly this branch names the issue as reliably as the branch would
 * have; an issue merely opened while the block ran is a coincidence away from being wrong, so it
 * lands a tier lower.
 */
const activityFor = (options: { block: ActivityBlock; activity: IssueActivity[] }) => {
  const { block, activity } = options;
  const branch = block.context.branch ? stripRefPrefix(block.context.branch) : undefined;
  const onBranch = branch
    ? activity.find((entry) => entry.branch && stripRefPrefix(entry.branch) === branch)
    : undefined;

  if (onBranch) return { entry: onBranch, confidence: 'likely' as const };

  const during = activity.find(
    (entry) => entry.at.getTime() >= block.from.getTime() && entry.at.getTime() <= block.to.getTime(),
  );

  return during ? { entry: during, confidence: 'weak' as const } : undefined;
};

/**
 * Scores one block against the attribution ladder — branch grammar, then merge request and
 * issue-view activity, then a recurring Tempo pattern, then a key in a window title. Deterministic
 * by design: a conforming branch name already states both keys, so nothing here guesses. A block
 * that reaches the end without an `issueKey` is what the reasoning provider is for — it is a
 * first-class outcome, not a failure.
 */
export const attribute = (options: { block: ActivityBlock } & AttributeOptions): AttributedBlock => {
  const config = options.config ?? DEFAULT_GIT_FLOW_CONFIG;
  const { block } = options;
  const evidence = [...block.evidence];

  if (block.context.branch) {
    const parsed = resolveBranch({ branch: block.context.branch, config, resolveBase: options.resolveBase });

    if (parsed.inheritedFrom) {
      evidence.push({
        kind: 'inherited-branch',
        at: block.from,
        detail: `no key on \`${parsed.branch}\`; inherited ${parsed.storyKey} from \`${parsed.inheritedFrom}\``,
      });
    }

    if (parsed.issueKey) {
      return {
        block,
        issueKey: parsed.issueKey,
        storyKey: parsed.storyKey,
        taskKey: parsed.taskKey,
        confidence: parsed.ok ? 'certain' : 'likely',
        evidence,
      };
    }
  }

  const activity = options.activity?.length ? activityFor({ block, activity: options.activity }) : undefined;

  if (activity) {
    const { entry } = activity;

    evidence.push({ kind: entry.kind, at: entry.at, detail: entry.detail, summary: entry.summary });

    return { block, issueKey: entry.issueKey, confidence: activity.confidence, evidence };
  }

  const pattern = options.patterns?.length ? patternAt({ patterns: options.patterns, at: block.from }) : undefined;

  if (pattern) {
    evidence.push({
      kind: 'tempo-history',
      at: block.from,
      detail: `${pattern.issueKey} logged at this time on ${pattern.occurrences} earlier weeks`,
    });

    return { block, issueKey: pattern.issueKey, confidence: 'weak', evidence };
  }

  const titleKey = block.evidence
    .filter((entry) => entry.kind === 'window-title')
    .map((entry) => keyFromTitle(entry.detail, config))
    .find((key) => !!key);

  return titleKey
    ? { block, issueKey: titleKey, confidence: 'weak', evidence }
    : { block, confidence: 'weak', evidence };
};
