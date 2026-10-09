import { GitFlowConfig, parseBranch, stripRefPrefix } from '@ethlete/agent-rules/git-flow';
import { ActivityBlock } from '../model/block';

/** A merge request of the day, with the directories its branch changed in one checkout of its project. */
export type ReviewedMergeRequest = {
  repoPath: string;
  /** Such as `!1095`. */
  reference: string;
  projectPath: string;
  branch: string;
  title?: string;
  issueKey?: string;
  directories: readonly string[];
  /** What the user did on it and when, in the forge's words, such as `commented on`. */
  activity: readonly { at: Date; action: string }[];
};

const MIN_SHARED_SEGMENTS = 3;

const segmentsOf = (path: string) => path.split('/').filter(Boolean);

const related = (left: string, right: string) => {
  const [shorter, longer] = [segmentsOf(left), segmentsOf(right)].sort((a, b) => a.length - b.length) as [
    string[],
    string[],
  ];

  if (shorter.length === longer.length) return shorter.every((segment, index) => segment === longer[index]);

  return shorter.length >= MIN_SHARED_SEGMENTS && shorter.every((segment, index) => segment === longer[index]);
};

const distanceMs = (at: Date, block: ActivityBlock) =>
  Math.max(0, block.from.getTime() - at.getTime(), at.getTime() - block.to.getTime());

/**
 * The merge request of the block's checkout whose branch changed the most of the directories the block
 * read or edited, where the block's own branch names neither an issue nor a subject — work on a base
 * branch such as `main`, which says nothing about what it was for. A tie goes to the merge request
 * active nearest the block.
 */
export const reviewedMergeRequestOver = (options: {
  block: ActivityBlock;
  reviewed: readonly ReviewedMergeRequest[];
  config: GitFlowConfig;
}) => {
  const { block, config } = options;
  const { repoPath, branch } = block.context;

  if (!repoPath || !branch) return undefined;

  const parsed = parseBranch({ branch: stripRefPrefix(branch), config });

  if (parsed.issueKey || parsed.subject) return undefined;

  const directories = block.evidence.flatMap((entry) =>
    entry.kind === 'editor' && entry.directory ? [entry.directory] : [],
  );

  if (!directories.length) return undefined;

  const [best] = options.reviewed
    .filter((mergeRequest) => mergeRequest.repoPath === repoPath && mergeRequest.activity.length)
    .map((mergeRequest) => {
      const nearest = [...mergeRequest.activity].sort(
        (a, b) => distanceMs(a.at, block) - distanceMs(b.at, block) || a.at.getTime() - b.at.getTime(),
      )[0];

      return {
        mergeRequest,
        nearest,
        overlap: directories.filter((directory) =>
          mergeRequest.directories.some((changed) => related(directory, changed)),
        ).length,
      };
    })
    .filter((candidate) => candidate.overlap > 0 && !!candidate.nearest)
    .sort(
      (a, b) =>
        b.overlap - a.overlap ||
        distanceMs(a.nearest?.at ?? block.from, block) - distanceMs(b.nearest?.at ?? block.from, block) ||
        a.mergeRequest.reference.localeCompare(b.mergeRequest.reference),
    );

  return best?.nearest ? { mergeRequest: best.mergeRequest, nearest: best.nearest } : undefined;
};
