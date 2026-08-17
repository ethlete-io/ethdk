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
import { TimetrackProjectLink, describeProjectLink, matchProjectLink } from './project-link';
import { RecurringPattern, patternAt } from './recurrence';
import {
  AttributionRule,
  AttributionRuleMatch,
  InferredAttribution,
  describeAttributionRule,
  matchAttributionRule,
  matchInferredAttribution,
} from './rules';

export type AttributedBlock = {
  block: ActivityBlock;
  /** The issue the time should be logged against. Absent means nothing could attribute it. */
  issueKey?: string;
  storyKey?: string;
  taskKey?: string;
  confidence: Confidence;
  /** The block's own evidence plus whatever attribution added, in the order it was found. */
  evidence: Evidence[];
  /**
   * The link that says this context is not work. A block carrying one is never proposed, never
   * donated and never offered to be named — it is reported so the day can show it, and no further.
   */
  privateLink?: TimetrackProjectLink;
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
  /**
   * The user's own context-to-issue rules. This is the ladder a repository that does not follow the
   * branch grammar rests on: nothing else in it can name an issue for `refactor/hub-query-v3`.
   */
  rules?: AttributionRule[];
  /**
   * The user's path-to-project links. A private one is read before every rung below, because it is
   * the user saying the time is not work — and no evidence can outrank that, least of all a branch
   * name a side project happens to share with a client's.
   */
  links?: readonly TimetrackProjectLink[];
  /**
   * What the reasoning provider proposed for contexts nothing deterministic could name. Read at the
   * last rung and never above one, so a model answer can only fill a hole — it cannot overrule the
   * branch grammar, a rule the user wrote, or a merge request that was actually observed.
   */
  inferred?: readonly InferredAttribution[];
};

/**
 * The first issue key in free text — a window title, a calendar event's name — or nothing.
 *
 * A key whose prefix the grammar does not know is not a key: `SCRUM-2` in a page title is somebody
 * else's tracker, and attributing time to it is worse than leaving the block unattributed. Free text
 * is therefore read against the configured projects and nothing else, and an empty list yields
 * nothing at all — the pattern alone reads a cloud console's `ABC-1234` as an issue that has never
 * existed, and a row against a key nobody recognises is the one mistake this rung can make.
 *
 * A branch name is not free text and is not read here. `parseBranch` states both keys itself, which is
 * why it stays trusted on a machine whose project list is still empty.
 */
export const issueKeyInText = (options: { text: string; config: GitFlowConfig }) => {
  const { text, config } = options;

  if (config.keyPrefixes.length === 0) return undefined;

  const match = new RegExp(config.keyPattern).exec(text);

  if (!match) return undefined;

  const key = match[0];

  return config.keyPrefixes.includes(key.slice(0, key.indexOf('-'))) ? key : undefined;
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

const ruleAttribution = (options: {
  block: ActivityBlock;
  match: AttributionRuleMatch;
  issueKey: string;
  evidence: Evidence[];
  confidence: Confidence;
}): AttributedBlock => {
  const { block, match, issueKey, confidence } = options;

  return {
    block,
    issueKey,
    confidence,
    evidence: [
      ...options.evidence,
      {
        kind: 'attribution-rule',
        at: block.from,
        detail: `you assigned \`${describeAttributionRule(match.rule)}\` to ${issueKey}`,
      },
    ],
  };
};

/**
 * Scores one block against the attribution ladder. A private link is read first and answers on its
 * own: it is the user saying the time is not work, and a rung that could overrule it would make the
 * statement worthless. Everything else follows in order — branch grammar, a branch-scoped rule of the
 * user's own, merge request and issue-view activity, a project-wide rule, a recurring Tempo pattern,
 * then a key in a window title, and last of all what the reasoning provider proposed for this exact
 * context. Deterministic down to that final rung: a conforming branch name already states both keys,
 * so nothing above it guesses. A block that reaches the end without an `issueKey` is a first-class
 * outcome, not a failure — it is what the provider is offered, and what it leaves behind when it has
 * no answer either.
 *
 * The two rule rungs sit apart on purpose. A rule naming one branch is as good a statement about that
 * work as the branch name would have been, so it outranks activity; a rule naming a whole repository
 * says only which project the time belongs to, which a merge request opened for this very branch
 * beats. Collapsing them into one rung would make either the narrow rule too weak or the broad one
 * too strong.
 */
export const attribute = (options: { block: ActivityBlock } & AttributeOptions): AttributedBlock => {
  const config = options.config ?? DEFAULT_GIT_FLOW_CONFIG;
  const { block } = options;
  const evidence = [...block.evidence];
  const link = options.links?.length ? matchProjectLink({ context: block.context, links: options.links }) : undefined;

  if (link?.target.kind === 'private') {
    return {
      block,
      confidence: 'certain',
      privateLink: link,
      evidence: [
        ...evidence,
        { kind: 'project-link', at: block.from, detail: `you marked \`${describeProjectLink(link)}\` private` },
      ],
    };
  }

  const match = options.rules?.length
    ? matchAttributionRule({ context: block.context, rules: options.rules })
    : undefined;
  /**
   * A donating rule is not read here at all — which work it joins is a question about the whole day,
   * so `donateBlocks` answers it once everything else has been attributed.
   */
  const rule =
    match && match.rule.target.kind === 'issue' ? { ...match, issueKey: match.rule.target.issueKey } : undefined;

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

  if (rule?.scope === 'branch')
    return ruleAttribution({ block, match: rule, issueKey: rule.issueKey, evidence, confidence: 'likely' });

  const activity = options.activity?.length ? activityFor({ block, activity: options.activity }) : undefined;

  if (activity) {
    const { entry } = activity;

    evidence.push({ kind: entry.kind, at: entry.at, detail: entry.detail, summary: entry.summary });

    return { block, issueKey: entry.issueKey, confidence: activity.confidence, evidence };
  }

  if (rule) return ruleAttribution({ block, match: rule, issueKey: rule.issueKey, evidence, confidence: 'weak' });

  /**
   * A donating context leaves the ladder here, so that `donateBlocks` still sees it. The rungs below
   * read a coincidence — a standing Tempo pattern, a key in whatever tab was open — and either would
   * name an issue for work the user has already said belongs beside the day's own work instead. A key
   * on a browser tab about another tracker is exactly how that goes wrong.
   */
  if (match?.rule.target.kind === 'donate') return { block, confidence: 'weak', evidence };

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
    .map((entry) => issueKeyInText({ text: entry.detail, config }))
    .find((key) => !!key);

  if (titleKey) return { block, issueKey: titleKey, confidence: 'weak', evidence };

  const inference = options.inferred?.length
    ? matchInferredAttribution({ context: block.context, inferred: options.inferred })
    : undefined;

  if (inference) {
    evidence.push({
      kind: 'model',
      at: block.from,
      detail: `suggested ${inference.issueKey} — ${inference.reason}`,
    });

    return { block, issueKey: inference.issueKey, confidence: 'weak', evidence };
  }

  return { block, confidence: 'weak', evidence };
};
