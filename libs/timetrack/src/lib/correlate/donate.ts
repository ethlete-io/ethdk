import { ActivityBlock, blockDurationMs } from '../model/block';
import { AttributedBlock } from './attribute';
import { AttributionRule, describeAttributionRule, matchAttributionRule } from './rules';

export type DonateOptions = {
  /**
   * How far a donor block looks for the work it was done for. Beyond this the two are separate
   * sittings and joining them would be an invention, so the block stays unattributed and the review
   * asks about it.
   */
  maxDonationGapMs: number;
  /**
   * How long a donor block may be and still be folded into the work beside it. A longer stretch is a
   * piece of work in its own right rather than a favour done for something else, so it stays
   * unattributed and the review offers to name it or to file a ticket for it.
   */
  maxDonationBlockMs: number;
};

export const DEFAULT_DONATE_OPTIONS: DonateOptions = {
  maxDonationGapMs: 4 * 60 * 60_000,
  maxDonationBlockMs: 2 * 60 * 60_000,
};

const gapBetween = (a: ActivityBlock, b: ActivityBlock) =>
  Math.max(0, Math.max(a.from.getTime(), b.from.getTime()) - Math.min(a.to.getTime(), b.to.getTime()));

/**
 * The attributed block a donor's time joins: the nearest in the day, ties going to the later one.
 *
 * Later wins a tie because a shared library is changed for something, and the thing it was changed for
 * is usually what comes next — the fix lands, then the project that needed it adopts it. Nearest in
 * either direction rather than only forward, because the same afternoon often runs the other way: the
 * consumer's work is what turned up the gap in the library.
 */
const beneficiaryOf = (options: { donor: AttributedBlock; candidates: AttributedBlock[]; maxGapMs: number }) => {
  const { donor, candidates, maxGapMs } = options;
  let best: { entry: AttributedBlock; gap: number } | undefined;

  for (const entry of candidates) {
    const gap = gapBetween(donor.block, entry.block);

    if (gap > maxGapMs) continue;
    if (best && (gap > best.gap || (gap === best.gap && entry.block.from <= best.entry.block.from))) continue;

    best = { entry, gap };
  }

  return best?.entry;
};

/**
 * Hands the time in a donating context to the work it was done for.
 *
 * A repository nobody files tickets against still costs hours, and those hours belong to the projects
 * that profited from them — logging them nowhere loses a real chunk of the day, and logging them on a
 * ticket of their own is not possible when the project has none. The result is always `weak`: which
 * work profited is an inference, and it must not sync until a reviewer has looked at it.
 *
 * A donor with nothing to join stays unattributed rather than being forced somewhere, so a day that was
 * *only* library work reads as unaccounted time instead of quietly landing on an unrelated ticket. A
 * donor longer than `maxDonationBlockMs` stays unattributed for the other reason: an afternoon in the
 * library is its own piece of work, and folding it into whatever ran beside it would hide it.
 */
export const donateBlocks = (options: {
  blocks: AttributedBlock[];
  rules?: readonly AttributionRule[];
  options?: Partial<DonateOptions>;
}): AttributedBlock[] => {
  const rules = options.rules ?? [];

  if (rules.length === 0) return options.blocks;

  const { maxDonationGapMs, maxDonationBlockMs } = { ...DEFAULT_DONATE_OPTIONS, ...options.options };
  const donorRule = (block: ActivityBlock) => {
    const match = matchAttributionRule({ context: block.context, rules });

    return match?.rule.target.kind === 'donate' ? match.rule : undefined;
  };
  const candidates = options.blocks.filter((entry) => !!entry.issueKey);

  return options.blocks.map((entry) => {
    const rule = entry.issueKey ? undefined : donorRule(entry.block);

    if (!rule) return entry;
    if (blockDurationMs(entry.block) > maxDonationBlockMs) return entry;

    const beneficiary = beneficiaryOf({ donor: entry, candidates, maxGapMs: maxDonationGapMs });

    if (!beneficiary) return entry;

    return {
      ...entry,
      issueKey: beneficiary.issueKey,
      storyKey: beneficiary.storyKey,
      taskKey: beneficiary.taskKey,
      confidence: 'weak',
      evidence: [
        ...entry.evidence,
        {
          kind: 'attribution-rule',
          at: entry.block.from,
          detail: `\`${describeAttributionRule(rule)}\` files no issues; logged with the work on ${beneficiary.issueKey} beside it`,
        },
      ],
    };
  });
};
