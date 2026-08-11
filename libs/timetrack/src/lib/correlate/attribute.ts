import {
  BranchParseResult,
  DEFAULT_GIT_FLOW_CONFIG,
  GitFlowConfig,
  parseBranch,
  resolveThroughBase,
} from '@ethlete/agent-rules/git-flow';
import { ActivityBlock } from '../model/block';
import { Confidence, Evidence } from '../model/evidence';

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

export type AttributeOptions = {
  config?: GitFlowConfig;
  /**
   * The branch a keyless branch is based on — the merge-base locally, or the MR target. Returning
   * nothing is normal and simply leaves the block keyless.
   */
  resolveBase?: (branch: string) => string | undefined;
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
 * Scores one block against the branch grammar. Deterministic by design: a conforming branch name
 * already states both keys, so nothing here guesses. A block that reaches the end without an
 * `issueKey` is what the reasoning provider is for — it is a first-class outcome, not a failure.
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

  const titleKey = block.evidence
    .filter((entry) => entry.kind === 'window-title')
    .map((entry) => keyFromTitle(entry.detail, config))
    .find((key) => !!key);

  return titleKey
    ? { block, issueKey: titleKey, confidence: 'weak', evidence }
    : { block, confidence: 'weak', evidence };
};
