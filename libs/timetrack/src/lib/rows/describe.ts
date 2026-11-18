import { DEFAULT_GIT_FLOW_CONFIG, GitFlowConfig, parseBranch } from '@ethlete/agent-rules/git-flow';
import { isAcknowledgement, isQuotableNote } from '../model/acknowledgement';
import { ActivityBlock, streamKey } from '../model/block';
import { EvidenceKind } from '../model/evidence';
import { laneKeyOf } from './lane';
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
const SUMMARY_PRIORITY: EvidenceKind[] = [
  'timer',
  'commit',
  'agent-session',
  'work-file',
  'merge-request',
  'calendar',
  'call',
];

const MEETING_KINDS: EvidenceKind[] = ['calendar', 'call'];

const quotable = (summary: string, kind: EvidenceKind) =>
  MEETING_KINDS.includes(kind) ? !isAcknowledgement(summary) : isQuotableNote(summary);

const truncate = (text: string, maxLength: number) =>
  text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trimEnd()}…`;

const ownCheckoutsOf = (group: WorkGroup, config: GitFlowConfig) => {
  const named = group.issueKey
    ? group.blocks.filter(
        (block) =>
          !!block.context.repoPath &&
          !!block.context.branch &&
          parseBranch({ branch: block.context.branch, config }).issueKey === group.issueKey,
      )
    : [];

  if (named.length) return new Set(named.map((block) => streamKey(block.context)));

  const lane = group.laneKey ?? laneKeyOf(group.blocks);

  return lane ? new Set([lane]) : undefined;
};

const foreignCommitsOf = (group: WorkGroup, config: GitFlowConfig) => {
  const own = ownCheckoutsOf(group, config);

  if (!own) return new Set<string>();

  const commitsIn = (blocks: readonly ActivityBlock[]) =>
    blocks.flatMap((block) => block.evidence.filter((entry) => entry.kind === 'commit').map((entry) => entry.detail));
  const isOwn = (block: ActivityBlock) => !block.context.repoPath || own.has(streamKey(block.context));
  const ownCommits = new Set(commitsIn(group.blocks.filter(isOwn)));

  return new Set(commitsIn(group.blocks.filter((block) => !isOwn(block))).filter((detail) => !ownCommits.has(detail)));
};

const summariesOf = (options: { group: WorkGroup; kind: EvidenceKind; foreign: ReadonlySet<string> }) => {
  const { group, kind } = options;
  const found: string[] = [];
  const foreign = kind === 'commit' ? options.foreign : new Set<string>();

  for (const entry of group.evidence) {
    const summary = entry.kind === kind && !foreign.has(entry.detail) ? entry.summary?.trim() : undefined;

    if (summary && quotable(summary, kind) && !found.includes(summary)) found.push(summary);
  }

  return found;
};

/**
 * The branch that describes the row, which is the one naming its issue where a swap left two behind.
 * The first block's branch is where a checkout started, and that is what it left rather than did.
 */
const branchOf = (group: WorkGroup, config: GitFlowConfig) => {
  const branches = group.blocks.flatMap((block) => (block.context.branch ? [block.context.branch] : []));

  if (!group.issueKey) return branches[0];

  return branches.find((branch) => parseBranch({ branch, config }).issueKey === group.issueKey) ?? branches[0];
};

const fromBranch = (group: WorkGroup, config: GitFlowConfig) => {
  const branch = branchOf(group, config);

  return branch ? parseBranch({ branch, config }).subject?.replace(/-/g, ' ') : undefined;
};

const STRUCTURAL_SEGMENTS = new Set([
  'src',
  'lib',
  'libs',
  'app',
  'apps',
  'packages',
  'projects',
  'components',
  'pages',
  'partials',
  'views',
  'shared',
  'utils',
]);

const isStructural = (segment: string) => STRUCTURAL_SEGMENTS.has(segment) || segment.startsWith('src-');

const isSourceRoot = (segment: string) => segment === 'src' || segment.startsWith('src-');

const readable = (segment: string) => segment.replace(/[-_.]+/g, ' ').trim();

const lastNamed = (segments: readonly string[]) => [...segments].reverse().find((segment) => !isStructural(segment));

const commonPrefix = (paths: readonly (readonly string[])[]) => {
  const [first = [], ...rest] = paths;
  let length = first.length;

  for (const path of rest) {
    let shared = 0;

    while (shared < length && shared < path.length && path[shared] === first[shared]) shared++;

    length = shared;
  }

  return first.slice(0, length);
};

/**
 * Names work from the directories it was done in, such as `hub: game codes` for `libs/domain/hub/src/lib/opportunities/game-codes/…`:
 * the package most of them lie in, and the deepest directory all of that package's share.
 */
export const directoryLabel = (directories: readonly string[]): string | undefined => {
  const packages = new Map<string, { name?: string; inner: string[][] }>();

  for (const directory of directories) {
    const segments = directory.split('/').filter(Boolean);
    const sourceAt = segments.findIndex(isSourceRoot);
    const root = sourceAt === -1 ? segments : segments.slice(0, sourceAt);
    const key = root.join('/');
    const entry = packages.get(key) ?? { name: lastNamed(root), inner: [] };

    entry.inner.push(sourceAt === -1 ? [] : segments.slice(sourceAt));
    packages.set(key, entry);
  }

  const [chosen] = [...packages.entries()].sort(
    ([leftKey, left], [rightKey, right]) => right.inner.length - left.inner.length || leftKey.localeCompare(rightKey),
  );

  if (!chosen) return undefined;

  const { name, inner } = chosen[1];
  const area = lastNamed(commonPrefix(inner));
  const parts = [...new Set([name, area].filter((part): part is string => !!part).map(readable))];

  return parts.length ? parts.join(': ') : undefined;
};

/**
 * Writes the worklog text a reviewer would otherwise have to type forty times a month. Commit
 * subjects win because they are the only source the user already wrote about this exact work; the
 * branch subject is the floor, and it still beats the issue key alone. A prompt that only agrees is
 * never quoted, and neither is a branch whose name carries no subject, such as `next`. Work nothing else
 * names is named after the directories it was read or edited in.
 */
export const describeWork = (options: {
  group: WorkGroup;
  config?: GitFlowConfig;
  options?: Partial<DescribeOptions>;
}) => {
  const { maxSummaries, maxLength } = { ...DEFAULT_DESCRIBE_OPTIONS, ...options.options };
  const { group } = options;
  const config = options.config ?? DEFAULT_GIT_FLOW_CONFIG;
  const foreign = foreignCommitsOf(group, config);

  for (const kind of SUMMARY_PRIORITY) {
    const summaries = summariesOf({ group, kind, foreign });

    if (summaries.length === 0) continue;

    const quoted = summaries.slice(0, maxSummaries).join('; ');
    const rest = summaries.length - maxSummaries;

    return truncate(rest > 0 ? `${quoted} (+${rest} more)` : quoted, maxLength);
  }

  const branch = fromBranch(group, config);

  if (branch) return truncate(branch, maxLength);

  if (group.issueKey) return `work on ${group.issueKey}`;

  const directories = group.evidence.flatMap((entry) =>
    entry.kind === 'editor' && entry.directory ? [entry.directory] : [],
  );
  const label = directories.length ? directoryLabel(directories) : undefined;

  return label ? truncate(label, maxLength) : 'unattributed activity';
};
