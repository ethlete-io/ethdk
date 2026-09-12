import { TimeWindow } from '../model/time-window';
import { streamKey } from '../model/block';
import { projectKeyOf } from '../ticket/project';
import { AttributedBlock } from './attribute';
import { clipBlocks } from './overlap';

export type CutOptions = {
  /**
   * The Jira projects whose work runs behind the day rather than being it — the checkout a person is
   * in all day while the work they are booking happens elsewhere. Keys, as `favoriteProjects` holds
   * them.
   */
  backgroundProjects?: readonly string[];
  /**
   * Focused milliseconds per `streamKey`, from the day's own focus spans. It ranks two background
   * bands against each other, and nothing else reads it.
   */
  focusMsByStream?: Readonly<Record<string, number>>;
};

const windowOf = (entry: AttributedBlock): TimeWindow => ({ from: entry.block.from, to: entry.block.to });

/**
 * Takes the stretches a foreground band covers away from a background band.
 *
 * A person can be in one checkout all day while the work they are booking happens in another, and a
 * band that claims every minute of that presence overlaps every other band on the day. The user says
 * which projects those are; no rule can read it off a day, because the same repository is background
 * on one day and the whole of the work on the next.
 *
 * Only a background band ever loses time. Two foreground bands that overlap are a day that ran two
 * things at once, which is what `concurrency` is for and not a defect to resolve. Two background bands
 * are ranked against each other by the focus their streams held, then by which started first, so the
 * cut always resolves and never asks the reviewer to.
 */
export const cutBackground = (options: { blocks: readonly AttributedBlock[] } & CutOptions): AttributedBlock[] => {
  const background = new Set((options.backgroundProjects ?? []).map((key) => key.trim().toUpperCase()).filter(Boolean));

  if (!background.size) return [...options.blocks];

  const focusMs = options.focusMsByStream ?? {};
  const isBackground = (entry: AttributedBlock) => {
    const project = entry.issueKey ? projectKeyOf(entry.issueKey) : undefined;

    return !!project && background.has(project);
  };

  const foreground = options.blocks.filter((entry) => !isBackground(entry));
  const ranked = options.blocks
    .filter(isBackground)
    .map((entry) => ({ entry, focus: focusMs[streamKey(entry.block.context)] ?? 0 }))
    .sort((a, b) => b.focus - a.focus || a.entry.block.from.getTime() - b.entry.block.from.getTime());

  const covered = foreground.map(windowOf);
  const kept: AttributedBlock[] = [];

  for (const { entry } of ranked) {
    const pieces = clipBlocks({ blocks: [entry.block], windows: covered }).map((block) => ({
      ...entry,
      block,
      evidence: entry.evidence.filter(
        (observed) => observed.at.getTime() >= block.from.getTime() && observed.at.getTime() <= block.to.getTime(),
      ),
    }));

    kept.push(...pieces);
    covered.push(...pieces.map(windowOf));
  }

  return [...foreground, ...kept].sort((a, b) => a.block.from.getTime() - b.block.from.getTime());
};
