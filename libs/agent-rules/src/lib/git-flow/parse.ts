import { buildBranchName } from './build';
import { GitFlowBranchKind, GitFlowConfig, GitFlowDeprecatedShape, GitFlowRule } from './config';

export type GitFlowFinding = {
  rule: GitFlowRule;
  message: string;
  /** The conforming spelling, when it can be derived without asking Jira for an issue key. */
  suggestion?: string;
};

export type BranchParseResult = {
  branch: string;
  /** True only for a fully conforming name — an alias or a lowercase key still parses, but is not `ok`. */
  ok: boolean;
  kind: GitFlowBranchKind;
  /** The normalized type segment (`feature/` resolves to `feat`). */
  type?: string;
  storyKey?: string;
  taskKey?: string;
  /** The most specific issue the branch names — what time should be logged against. */
  issueKey?: string;
  subject?: string;
  /** The branch this one nests under, for a sub-feature or a release fix. */
  parent?: string;
  /** The branch matched a `deprecatedShapes` entry, so it should be excluded from adoption reports. */
  deprecated: boolean;
  expectedBase?: string;
  expectedMrTargets: string[];
  /** Set by `resolveThroughBase` when the story key came from the base branch rather than this name. */
  inheritedFrom?: string;
  suggestedName?: string;
  findings: GitFlowFinding[];
};

export const stripRefPrefix = (ref: string) =>
  ref
    .trim()
    .replace(/^refs\/heads\//, '')
    .replace(/^refs\/remotes\/[^/]+\//, '');

type SegmentParts = { key?: string; subject?: string; findings: GitFlowFinding[] };

/**
 * The key is only recognised anchored at the start of a segment. A trailing number is therefore
 * never mistaken for one — `ratings-reveal-secondary-page-27` yields no key rather than a wrong
 * one, and a confidently wrong attribution is worse than none.
 */
const parseSegment = (options: { segment: string; config: GitFlowConfig; role: string }): SegmentParts => {
  const { segment, config, role } = options;
  const match = new RegExp(`^(${config.keyPattern})(?:-(.*))?$`, 'i').exec(segment);
  const rawKey = match?.[1];
  const known =
    config.keyPrefixes.length === 0 ||
    config.keyPrefixes.some((prefix) => rawKey?.toUpperCase().startsWith(prefix.toUpperCase()));

  if (!rawKey || !known) {
    return {
      subject: segment || undefined,
      findings: [{ rule: 'missing-key', message: `"${segment}" carries no ${role} issue key.` }],
    };
  }

  const key = rawKey.toUpperCase();
  const subject = match?.[2] || undefined;
  const findings: GitFlowFinding[] = [];

  if (rawKey !== key) {
    findings.push({ rule: 'key-case', message: `Issue key "${rawKey}" should be uppercase "${key}".` });
  }

  if (!subject) {
    findings.push({ rule: 'missing-subject', message: `"${segment}" names ${key} but has no subject.` });
  }

  return { key, subject, findings };
};

const matchDeprecatedShape = (options: { branch: string; config: GitFlowConfig }) => {
  const { branch, config } = options;

  for (const shape of config.deprecatedShapes) {
    const match = new RegExp(shape.match).exec(branch);

    if (match) return { shape, groups: match.groups ?? {} };
  }

  return undefined;
};

const renameSuggestion = (options: { shape: GitFlowDeprecatedShape; groups: Record<string, string | undefined> }) => {
  const { shape, groups } = options;
  const key = groups['key'];

  return shape.renameTo
    .replace(/<subject>/g, groups['subject'] ?? '')
    .replace(/<KEY>/g, key ? key.toUpperCase() : '<KEY>');
};

const targetsForKind = (options: {
  kind: GitFlowBranchKind;
  config: GitFlowConfig;
  parent?: string;
  branch?: string;
}): { expectedBase?: string; expectedMrTargets: string[] } => {
  const { kind, config, parent, branch } = options;
  const { development, production } = config.baseBranches;

  switch (kind) {
    case 'main-feature':
      return { expectedBase: development, expectedMrTargets: [development] };
    case 'sub-feature':
    case 'release-fix':
      return { expectedBase: parent, expectedMrTargets: parent ? [parent] : [] };
    case 'release':
      return { expectedBase: development, expectedMrTargets: [development, production] };
    case 'hotfix':
      return { expectedBase: production, expectedMrTargets: [production] };
    case 'protected':
      return { expectedMrTargets: branch === development ? [production] : [development] };
    default:
      return { expectedMrTargets: [] };
  }
};

/**
 * Classifies a branch name against the grammar. Never throws: an unrecognised name comes back as
 * `kind: 'unknown'` with findings, so the validator and timetrack's correlation engine can read
 * the same result for different purposes.
 */
export const parseBranch = (options: { branch: string; config: GitFlowConfig }): BranchParseResult => {
  const { config } = options;
  const branch = stripRefPrefix(options.branch);
  const segments = branch.split('/');
  const unknown = (message: string): BranchParseResult => ({
    branch,
    ok: false,
    kind: 'unknown',
    deprecated: false,
    expectedMrTargets: [],
    findings: [{ rule: 'unknown-type', message }],
  });

  if (!branch || segments.some((segment) => !segment)) return unknown(`"${options.branch}" is not a branch name.`);

  if (branch === config.baseBranches.development || branch === config.baseBranches.production) {
    return {
      branch,
      ok: true,
      kind: 'protected',
      deprecated: false,
      findings: [],
      ...targetsForKind({ kind: 'protected', config, branch }),
    };
  }

  const deprecated = matchDeprecatedShape({ branch, config });

  if (deprecated) {
    const suggestion = renameSuggestion(deprecated);

    return {
      branch,
      ok: false,
      kind: deprecated.shape.kind,
      subject: deprecated.groups['subject'],
      deprecated: true,
      suggestedName: suggestion,
      findings: [
        {
          rule: 'deprecated-prefix',
          message: `"${branch}" uses a deprecated spelling; rename it to ${suggestion}.`,
          suggestion,
        },
      ],
      ...targetsForKind({ kind: deprecated.shape.kind, config }),
    };
  }

  const [prefix, ...rest] = segments;

  if (prefix === config.subPrefix) return dropRedundantSuggestion(parseNested({ branch, segments: rest, config }));
  if (prefix === config.releasePrefix) return dropRedundantSuggestion(parseRelease({ branch, segments: rest, config }));
  if (prefix === config.hotfixPrefix) return dropRedundantSuggestion(parseHotfix({ branch, segments: rest, config }));

  return dropRedundantSuggestion(parseFeature({ branch, prefix: prefix ?? '', segments: rest, config }));
};

const unrecognised = (options: { branch: string; message: string }): BranchParseResult => ({
  branch: options.branch,
  ok: false,
  kind: 'unknown',
  deprecated: false,
  expectedMrTargets: [],
  findings: [{ rule: 'unknown-type', message: options.message }],
});

/**
 * `sub/<parent path>/<KEY>-<subject>` — the nested shape. The parent's full name is inside the
 * child's, so the merge request target needs no lookup; only two levels are allowed, so a parent
 * that is itself nested is not a shape.
 */
const parseNested = (options: { branch: string; segments: string[]; config: GitFlowConfig }): BranchParseResult => {
  const { branch, segments, config } = options;
  const leaf = segments[segments.length - 1];
  const parent = segments.slice(0, -1).join('/');

  if (!leaf || !parent) {
    return unrecognised({ branch, message: `"${branch}" names no parent branch to nest under.` });
  }

  const parentParse = parseBranch({ branch: parent, config });
  const kind = nestedKindFor(parentParse);

  if (!kind) {
    return unrecognised({
      branch,
      message: `"${parent}" is not a branch anything can nest under — only a main feature or a release branch is.`,
    });
  }

  const parts = parseSegment({ segment: leaf, config, role: kind === 'release-fix' ? 'bug' : 'task' });
  const findings = [...parentParse.findings, ...parts.findings];

  return {
    branch,
    ok: findings.length === 0,
    type: parentParse.type,
    kind,
    storyKey: parentParse.storyKey,
    taskKey: parts.key,
    issueKey: parts.key ?? parentParse.storyKey,
    subject: parts.subject,
    parent,
    deprecated: false,
    findings,
    suggestedName: parts.key
      ? buildBranchName({
          spec: { kind, parent: parentParse.suggestedName ?? parent, key: parts.key, subject: parts.subject ?? '' },
          config,
        })
      : undefined,
    ...targetsForKind({ kind, config, parent }),
  };
};

const nestedKindFor = (parent: BranchParseResult) => {
  if (parent.kind === 'release') return 'release-fix' as const;

  return parent.kind === 'main-feature' && !parent.deprecated ? ('sub-feature' as const) : undefined;
};

/**
 * The spelling the convention was originally written with, `<parent>/<KEY>-<subject>`. It parses so
 * that `explain` and `repair` can say something useful about it, but it can never exist next to the
 * parent it names — see `subPrefix`.
 */
const nestedTooDeep = (options: {
  branch: string;
  kind: 'sub-feature' | 'release-fix';
  parent: string;
  leaf: SegmentParts;
  config: GitFlowConfig;
  storyKey?: string;
  type?: string;
}): BranchParseResult => {
  const { branch, kind, parent, leaf, config, storyKey, type } = options;
  const suggestion = leaf.key
    ? buildBranchName({ spec: { kind, parent, key: leaf.key, subject: leaf.subject ?? '' }, config })
    : `${config.subPrefix}/${branch}`;

  return {
    branch,
    ok: false,
    kind,
    type,
    storyKey,
    taskKey: leaf.key,
    issueKey: leaf.key ?? storyKey,
    subject: leaf.subject,
    parent,
    deprecated: true,
    suggestedName: suggestion,
    findings: [
      {
        rule: 'deprecated-prefix',
        message: `"${branch}" cannot exist while ${parent} does — git rejects a ref that is both a branch and a directory of branches. Use ${suggestion}.`,
        suggestion,
      },
    ],
    ...targetsForKind({ kind, config, parent }),
  };
};

const dropRedundantSuggestion = (result: BranchParseResult): BranchParseResult =>
  result.suggestedName === result.branch ? { ...result, suggestedName: undefined } : result;

const parseRelease = (options: { branch: string; segments: string[]; config: GitFlowConfig }): BranchParseResult => {
  const { branch, segments, config } = options;
  const [date, leaf, ...extra] = segments;

  if (!date || extra.length > 0) {
    return unrecognised({ branch, message: `"${branch}" is not a release or release-fix branch.` });
  }

  const findings: GitFlowFinding[] = [];

  if (!new RegExp(`^${config.releasePattern}$`).test(date)) {
    findings.push({ rule: 'release-date', message: `"${date}" is not a release date (expected YYYY.MM.DD).` });
  }

  const parent = `${config.releasePrefix}/${date}`;

  if (leaf === undefined) {
    return {
      branch,
      ok: findings.length === 0,
      kind: 'release',
      deprecated: false,
      findings,
      ...targetsForKind({ kind: 'release', config }),
    };
  }

  return nestedTooDeep({
    branch,
    kind: 'release-fix',
    parent,
    leaf: parseSegment({ segment: leaf, config, role: 'bug' }),
    config,
  });
};

const parseHotfix = (options: { branch: string; segments: string[]; config: GitFlowConfig }): BranchParseResult => {
  const { branch, segments, config } = options;
  const [leaf, ...extra] = segments;

  if (!leaf || extra.length > 0) {
    return {
      branch,
      ok: false,
      kind: 'unknown',
      deprecated: false,
      expectedMrTargets: [],
      findings: [{ rule: 'unknown-type', message: `"${branch}" is not a hotfix branch.` }],
    };
  }

  const parts = parseSegment({ segment: leaf, config, role: 'bug' });

  return {
    branch,
    ok: parts.findings.length === 0,
    kind: 'hotfix',
    taskKey: parts.key,
    issueKey: parts.key,
    subject: parts.subject,
    deprecated: false,
    findings: parts.findings,
    suggestedName: parts.key
      ? buildBranchName({ spec: { kind: 'hotfix', key: parts.key, subject: parts.subject ?? '' }, config })
      : undefined,
    ...targetsForKind({ kind: 'hotfix', config }),
  };
};

const parseFeature = (options: {
  branch: string;
  prefix: string;
  segments: string[];
  config: GitFlowConfig;
}): BranchParseResult => {
  const { branch, prefix, segments, config } = options;
  const alias = config.typeAliases[prefix];
  const type = config.types.includes(prefix) ? prefix : alias;
  const [story, task, ...extra] = segments;

  if (!type || !story || extra.length > 0) {
    return unrecognised({
      branch,
      message: `"${branch}" matches no branch shape; expected <type>/<KEY>-<subject> with type one of ${config.types.join(', ')}.`,
    });
  }

  const findings: GitFlowFinding[] = [];

  if (alias && prefix !== type) {
    findings.push({ rule: 'type-alias', message: `"${prefix}/" is an alias; use "${type}/".` });
  }

  const storyParts = parseSegment({ segment: story, config, role: 'story' });

  if (task === undefined) {
    findings.push(...storyParts.findings);

    return {
      branch,
      ok: findings.length === 0,
      kind: 'main-feature',
      type,
      storyKey: storyParts.key,
      issueKey: storyParts.key,
      subject: storyParts.subject,
      deprecated: false,
      findings,
      suggestedName: storyParts.key
        ? buildBranchName({
            spec: { kind: 'main-feature', type, key: storyParts.key, subject: storyParts.subject ?? '' },
            config,
          })
        : undefined,
      ...targetsForKind({ kind: 'main-feature', config }),
    };
  }

  return nestedTooDeep({
    branch,
    kind: 'sub-feature',
    parent: `${prefix}/${story}`,
    leaf: parseSegment({ segment: task, config, role: 'task' }),
    config,
    storyKey: storyParts.key,
    type,
  });
};

/**
 * Attributes a keyless branch through the branch it is based on. Reviewed branches land in an
 * integration branch, so a flat name like `feat/logout-confirmation` usually has a parent that
 * does carry the story key. Deterministic — no model involved.
 */
export const resolveThroughBase = (options: {
  branch: BranchParseResult;
  base: BranchParseResult;
}): BranchParseResult => {
  const { branch, base } = options;
  const inherited = base.storyKey ?? base.taskKey;

  if (branch.storyKey || !inherited) return branch;

  return {
    ...branch,
    storyKey: inherited,
    issueKey: branch.taskKey ?? inherited,
    inheritedFrom: base.branch,
  };
};
