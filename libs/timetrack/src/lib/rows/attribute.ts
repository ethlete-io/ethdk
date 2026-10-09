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
import { TimetrackProjectLink, describeProjectLink, matchProjectLink } from '../model/project-link';
import { RecurringPattern, patternAt } from '../model/recurrence';
import {
  AttributionRule,
  AttributionRuleMatch,
  AttributionScope,
  InferredAttribution,
  describeAttributionRule,
  matchAttributionRule,
  matchInferredAttribution,
} from '../model/attribution';
import { StandIn, findStandIn } from '../model/stand-in';
import { projectKeyOf } from '../ticket/project';
import { EpicOptions, branchSlugOf, epicSiblingFor } from './epic-sibling';
import { ReviewedMergeRequest, reviewedMergeRequestOver } from './reviewed-merge-request';

export type AttributedBlock = {
  block: ActivityBlock;
  /** The issue the time should be logged against. Absent means nothing could attribute it. */
  issueKey?: string;
  /**
   * The stand-in naming the block while Jira holds no issue for the work. It never appears beside an
   * `issueKey`: a stand-in rule loses to every rung that names a real issue.
   */
  standInId?: string;
  storyKey?: string;
  taskKey?: string;
  confidence: Confidence;
  /**
   * The scope of the rule that named the block, when a rule did. A repository rule names no branch, so
   * a reader that knows which branches a row holds can tell the rule never saw them.
   */
  ruleScope?: AttributionScope;
  /** The issue a later rung took the block from, which the row offers back in one press. */
  disputedIssueKey?: string;
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
  /** The day's merge requests with the directories their branches changed. See `reviewedMergeRequestOver`. */
  reviewed?: readonly ReviewedMergeRequest[];
  /** Standing commitments read out of Tempo history by `detectRecurringPatterns`. */
  patterns?: RecurringPattern[];
  /** The user's own context-to-issue rules. */
  rules?: AttributionRule[];
  /** The stand-ins a rule may point at; a rule naming one missing here names nothing. */
  standIns?: readonly StandIn[];
  /** The user's path-to-project links. A private one answers before every rung. */
  links?: readonly TimetrackProjectLink[];
  /** What the reasoning provider proposed for contexts nothing deterministic could name; the last rung. */
  inferred?: readonly InferredAttribution[];
  /** What the checkouts sharing this branch slug already book, from the day's first pass. */
  epics?: EpicOptions;
};

/**
 * The first issue key in free text — a window title, a calendar event's name — or nothing. Only the
 * configured project prefixes count, so an empty project list finds nothing.
 */
export const issueKeyInText = (options: { text: string; config: GitFlowConfig }) => {
  const { text, config } = options;

  if (config.keyPrefixes.length === 0) return undefined;

  for (const [key] of text.matchAll(new RegExp(config.keyPattern, 'g'))) {
    if (config.keyPrefixes.includes(key.slice(0, key.indexOf('-')))) return key;
  }

  return undefined;
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
 * have.
 */
const activityOnBranch = (options: { block: ActivityBlock; activity: readonly IssueActivity[] }) => {
  const { block, activity } = options;
  const branch = block.context.branch ? stripRefPrefix(block.context.branch) : undefined;

  return branch ? activity.find((entry) => entry.branch && stripRefPrefix(entry.branch) === branch) : undefined;
};

/** An issue merely opened while the block ran is a coincidence away from being wrong. */
const activityDuring = (options: {
  block: ActivityBlock;
  activity: readonly IssueActivity[];
  inProject: (issueKey: string) => boolean;
}) => {
  const { block, activity, inProject } = options;

  return activity.find(
    (entry) =>
      entry.at.getTime() >= block.from.getTime() &&
      entry.at.getTime() <= block.to.getTime() &&
      inProject(entry.issueKey),
  );
};

const standInSlugOf = (options: { standIn: StandIn; config: GitFlowConfig }) => {
  const { standIn, config } = options;
  const fromBranch = standIn.openedForBranch ? branchSlugOf({ branch: standIn.openedForBranch, config }) : undefined;

  return fromBranch ?? standIn.openedForWorkPath?.split('/').filter(Boolean).pop()?.toLowerCase();
};

/**
 * The one open stand-in of this block's project that another checkout opened for the same branch slug.
 * Two of them, or a block with no project link, answer nothing: which one is the open question.
 */
const standInSiblingFor = (options: {
  block: ActivityBlock;
  projectKey: string | undefined;
  standIns: readonly StandIn[];
  config: GitFlowConfig;
}) => {
  const { block, projectKey, standIns, config } = options;
  const { branch } = block.context;

  if (!branch || !projectKey) return undefined;

  const slug = branchSlugOf({ branch, config });

  if (!slug) return undefined;

  const matches = standIns.filter(
    (standIn) =>
      standIn.state === 'open' &&
      standIn.projectKey?.toUpperCase() === projectKey.toUpperCase() &&
      standInSlugOf({ standIn, config }) === slug,
  );

  return matches.length === 1 ? matches[0] : undefined;
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
    ruleScope: match.scope,
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
 * The same rung for a rule naming a stand-in. The block is named and still books nothing: `standInId`
 * sits where `issueKey` would, and every reader that asks whether a row can be written asks for the
 * key. See ADR 0021.
 */
const standInAttribution = (options: {
  block: ActivityBlock;
  match: AttributionRuleMatch;
  standIn: StandIn;
  evidence: Evidence[];
}): AttributedBlock => {
  const { block, match, standIn } = options;

  return {
    block,
    standInId: standIn.id,
    confidence: 'likely',
    evidence: [
      ...options.evidence,
      {
        kind: 'attribution-rule',
        at: block.from,
        detail: `you called \`${describeAttributionRule(match.rule)}\` ${standIn.name}, and Jira holds no ticket for it yet`,
      },
    ],
  };
};

/**
 * Scores one block against the attribution ladder: a private link first, then a branch rule, branch
 * grammar, the other rules, activity, sibling checkouts and stand-ins, and the coincidences last. A block no rung names comes
 * back without an `issueKey`.
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
  const rule =
    match && match.rule.target.kind === 'issue' ? { ...match, issueKey: match.rule.target.issueKey } : undefined;
  const standIn =
    match && match.rule.target.kind === 'stand-in'
      ? findStandIn({ id: match.rule.target.standInId, standIns: options.standIns ?? [] })
      : undefined;
  // Read before the stand-in rungs, though it answers after them: a sibling checkout naming the real
  // issue has to beat a stand-in.
  const epic = options.epics
    ? epicSiblingFor({ context: block.context, epics: options.epics, links: options.links ?? [], config })
    : undefined;

  if (rule?.scope === 'branch')
    return ruleAttribution({ block, match: rule, issueKey: rule.issueKey, evidence, confidence: 'likely' });

  const branchStandIn = standIn && !epic && match?.scope === 'branch' ? standIn : undefined;

  if (block.context.branch) {
    const parsed = resolveBranch({ branch: block.context.branch, config, resolveBase: options.resolveBase });

    if (parsed.inheritedFrom) {
      evidence.push({
        kind: 'inherited-branch',
        at: block.from,
        detail: `no key on \`${parsed.branch}\`; inherited ${parsed.storyKey} from \`${parsed.inheritedFrom}\``,
      });
    }

    // A conforming branch ends a stand-in on its own (ADR 0021); a deprecated spelling does not.
    if (parsed.issueKey && !(branchStandIn && parsed.deprecated)) {
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

  if (branchStandIn && match) return standInAttribution({ block, match, standIn: branchStandIn, evidence });

  const onBranch = options.activity?.length ? activityOnBranch({ block, activity: options.activity }) : undefined;

  if (onBranch) {
    evidence.push({ kind: onBranch.kind, at: onBranch.at, detail: onBranch.detail, summary: onBranch.summary });

    return { block, issueKey: onBranch.issueKey, confidence: 'likely', evidence };
  }

  if (rule) return ruleAttribution({ block, match: rule, issueKey: rule.issueKey, evidence, confidence: 'likely' });

  if (standIn && !epic && match) return standInAttribution({ block, match, standIn, evidence });

  // Before the coincidence rungs, which would otherwise name an issue for time `donateBlocks` has to
  // see unnamed.
  if (match?.rule.target.kind === 'donate') return { block, confidence: 'weak', evidence };

  if (epic) {
    evidence.push({ kind: 'sibling-checkout', at: block.from, detail: epic.detail });

    return { block, issueKey: epic.issueKey, storyKey: epic.parentKey, confidence: 'likely', evidence };
  }

  const projectKey = link?.target.kind === 'project' ? link.target.projectKey : undefined;
  const sibling = match
    ? undefined
    : standInSiblingFor({ block, projectKey, standIns: options.standIns ?? [], config });

  if (sibling) {
    const checkout = sibling.openedFor?.split('/').filter(Boolean).pop() ?? sibling.openedFor ?? '';

    evidence.push({
      kind: 'sibling-checkout',
      at: block.from,
      detail: `\`${checkout}\` holds stand-in ${sibling.name} for the same branch name`,
    });

    return { block, standInId: sibling.id, confidence: 'likely', evidence };
  }

  const inProject = (issueKey: string) => !projectKey || projectKeyOf(issueKey) === projectKey.toUpperCase();
  const reviewed = options.reviewed?.length
    ? reviewedMergeRequestOver({ block, reviewed: options.reviewed, config })
    : undefined;

  if (reviewed) {
    const { mergeRequest, nearest } = reviewed;

    evidence.push({
      kind: 'merge-request',
      at: nearest.at,
      detail: `you ${nearest.action} ${mergeRequest.reference} in ${mergeRequest.projectPath}, whose branch \`${mergeRequest.branch}\` changed the directories worked in here`,
      ...(mergeRequest.title ? { summary: mergeRequest.title } : {}),
    });

    if (mergeRequest.issueKey && inProject(mergeRequest.issueKey))
      return { block, issueKey: mergeRequest.issueKey, confidence: 'weak', evidence };
  }

  const during = options.activity?.length
    ? activityDuring({ block, activity: options.activity, inProject })
    : undefined;

  if (during) {
    evidence.push({ kind: during.kind, at: during.at, detail: during.detail, summary: during.summary });

    return { block, issueKey: during.issueKey, confidence: 'weak', evidence };
  }

  const patterns = options.patterns?.filter((entry) => inProject(entry.issueKey));
  const pattern = patterns?.length ? patternAt({ patterns, at: block.from }) : undefined;

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
    .find((key) => !!key && inProject(key));

  if (titleKey) return { block, issueKey: titleKey, confidence: 'weak', evidence };

  const inference = options.inferred?.length
    ? matchInferredAttribution({ context: block.context, inferred: options.inferred })
    : undefined;

  if (inference && inProject(inference.issueKey)) {
    evidence.push({
      kind: 'model',
      at: block.from,
      detail: `suggested ${inference.issueKey} — ${inference.reason}`,
    });

    return { block, issueKey: inference.issueKey, confidence: 'weak', evidence };
  }

  return { block, confidence: 'weak', evidence };
};
