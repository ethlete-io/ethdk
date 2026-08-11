import { DEFAULT_GIT_FLOW_CONFIG, GitFlowConfig, parseBranch } from '@ethlete/agent-rules/git-flow';
import { EvidenceKind } from '../model/evidence';
import { WorkGroup } from './merge';

export type DescribeOptions = {
  /** How many summaries a description quotes before it counts the rest. */
  maxSummaries: number;
  maxLength: number;
};

export const DEFAULT_DESCRIBE_OPTIONS: DescribeOptions = {
  maxSummaries: 3,
  maxLength: 200,
};

/** What the row is called, in descending order of how well each source describes actual work. */
const SUMMARY_PRIORITY: EvidenceKind[] = ['commit', 'agent-session', 'calendar'];

const truncate = (text: string, maxLength: number) =>
  text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trimEnd()}…`;

const summariesOf = (group: WorkGroup, kind: EvidenceKind) => {
  const found: string[] = [];

  for (const entry of group.evidence) {
    const summary = entry.kind === kind ? entry.summary?.trim() : undefined;

    if (summary && !found.includes(summary)) found.push(summary);
  }

  return found;
};

const fromBranch = (group: WorkGroup, config: GitFlowConfig) => {
  const branch = group.blocks.find((block) => block.context.branch)?.context.branch;

  if (!branch) return undefined;

  const subject = parseBranch({ branch, config }).subject;

  return subject ? subject.replace(/-/g, ' ') : branch;
};

/**
 * Writes the worklog text a reviewer would otherwise have to type forty times a month. Commit
 * subjects win because they are the only source the user already wrote about this exact work; the
 * branch subject is the floor, and it still beats the issue key alone.
 */
export const describeWork = (options: {
  group: WorkGroup;
  config?: GitFlowConfig;
  options?: Partial<DescribeOptions>;
}) => {
  const { maxSummaries, maxLength } = { ...DEFAULT_DESCRIBE_OPTIONS, ...options.options };
  const { group } = options;

  for (const kind of SUMMARY_PRIORITY) {
    const summaries = summariesOf(group, kind);

    if (summaries.length === 0) continue;

    const quoted = summaries.slice(0, maxSummaries).join('; ');
    const rest = summaries.length - maxSummaries;

    return truncate(rest > 0 ? `${quoted} (+${rest} more)` : quoted, maxLength);
  }

  const branch = fromBranch(group, options.config ?? DEFAULT_GIT_FLOW_CONFIG);

  if (branch) return truncate(branch, maxLength);

  return group.issueKey ? `work on ${group.issueKey}` : 'unattributed activity';
};
