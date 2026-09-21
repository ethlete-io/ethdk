import { AttributionRule, standInIdOf } from '../model/attribution';
import { describeProjectLink } from '../model/project-link';
import { StandIn, StandInRefusal, openStandIn, standInBranches, standInDays } from '../model/stand-in';
import { withReplacedAttributionRule } from './attribution';
import { TimetrackSettings } from './model';

/**
 * Puts a stand-in into the settings, replacing the record with the same id. Nothing else changes: the
 * rules that point at it are written where the context they match is known.
 */
export const withStandIn = (options: { settings: TimetrackSettings; standIn: StandIn }): TimetrackSettings => ({
  ...options.settings,
  standIns: [...options.settings.standIns.filter((entry) => entry.id !== options.standIn.id), options.standIn],
});

/**
 * Opens a stand-in and names a context with it, as one settings value.
 *
 * The two halves are one decision and must not be two writes: a rule stored without its record names
 * nothing, and a record stored without a rule covers no band. `supersededIds` takes back whatever
 * answered the context before, the way accepting a checkout-wide offer does.
 */
export const withNamedStandIn = (options: {
  settings: TimetrackSettings;
  standIn: StandIn;
  rule: AttributionRule;
  supersededIds?: readonly string[];
}): TimetrackSettings =>
  withReplacedAttributionRule({
    settings: withStandIn({ settings: options.settings, standIn: options.standIn }),
    rule: options.rule,
    supersededIds: options.supersededIds,
  });

/**
 * The checkout a record the app opened stands for, read from the record or from a rule that names it.
 *
 * The rule is the fallback, because a checkout that gets another answer has its rule replaced and the
 * record is then the only thing left holding the path.
 */
export const checkoutOf = (options: { settings: TimetrackSettings; standIn: StandIn }) =>
  options.standIn.openedFor ??
  options.settings.attributionRules.find((rule) => standInIdOf(rule) === options.standIn.id)?.repoPath;

/**
 * Takes a stand-in out, and every rule that named it with it.
 *
 * Leaving the rules would point them at a record that is gone, and the bands they cover would read as
 * named by something nobody can open. A delete is the resolve with no issue at the end of it: the
 * bands go back to unnamed on every day the stand-in held.
 *
 * Deleting one the app opened also refuses the branch it stood for. The work under it is still
 * unnamed, so the next auto pass would open another placeholder within seconds and the delete would
 * never stick.
 *
 * A record opened before the grain was the branch carries no branch, and deleting one refuses
 * nothing. It covered a whole checkout, which is what made it wrong, and the pass no longer reopens
 * that record — it opens one per branch, each named from its own work. So the delete is how such a
 * record is corrected, and refusing the checkout would stop the correction.
 */
export const withoutStandIn = (options: { settings: TimetrackSettings; id: string }): TimetrackSettings => {
  const { settings } = options;
  const standIn = settings.standIns.find((entry) => entry.id === options.id);
  const branch = standIn?.author === 'app' && standIn.state === 'open' ? standIn.openedForBranch : undefined;
  const checkout = standIn && branch ? checkoutOf({ settings, standIn }) : undefined;
  const refused: StandInRefusal | undefined = checkout ? { repoPath: checkout, branch } : undefined;

  return {
    ...settings,
    standIns: settings.standIns.filter((entry) => entry.id !== options.id),
    attributionRules: settings.attributionRules.filter((rule) => standInIdOf(rule) !== options.id),
    noStandInCheckouts:
      refused && !sameRefusal(settings.noStandInCheckouts, refused)
        ? [...settings.noStandInCheckouts, refused]
        : settings.noStandInCheckouts,
  };
};

const sameRefusal = (refused: readonly StandInRefusal[], entry: StandInRefusal) =>
  refused.some((held) => held.repoPath === entry.repoPath && held.branch === entry.branch);

/** Lets the app open a placeholder for the work again, which is how a delete is taken back. */
export const withStandInCheckoutAllowed = (options: {
  settings: TimetrackSettings;
  repoPath: string;
  branch?: string;
}): TimetrackSettings => ({
  ...options.settings,
  noStandInCheckouts: options.settings.noStandInCheckouts.filter(
    (entry) => entry.repoPath !== options.repoPath || entry.branch !== options.branch,
  ),
});

/**
 * Drops a placeholder the app opened that nothing names any more.
 *
 * A rule for a checkout is replaced whenever that checkout gets another answer — a second pass, or an
 * issue the user named it with — and the record the old rule pointed at was left open, so the waiting
 * list grew a dead row on every answer. Only a record the app wrote is swept: one the user wrote may
 * be carried by a row rather than by a rule.
 */
export const withoutOrphanedStandIns = (settings: TimetrackSettings): TimetrackSettings => {
  const named = new Set(settings.attributionRules.flatMap((rule) => standInIdOf(rule) ?? []));
  const kept = settings.standIns.filter(
    (standIn) => standIn.author !== 'app' || standIn.state !== 'open' || named.has(standIn.id),
  );

  return kept.length === settings.standIns.length ? settings : { ...settings, standIns: kept };
};

/** One of the pieces of work a record that named several is cut into. */
export type StandInSplitPiece = {
  /** The directory of the checkout this piece stands for. */
  workPath: string;
  /** The days of the record that worked in it. A day that worked in two of them belongs to both. */
  days: readonly string[];
  /** What to call it. Without one the old name carries the directory's last segment after it. */
  name?: string;
};

/** What a split did, or why it did nothing. */
export type StandInSplit = {
  settings: TimetrackSettings;
  /** The records the split opened. Empty when it refused. */
  opened: StandIn[];
  /** Why nothing was split. Absent when it was. */
  refused?: string;
};

const splitPieceName = (options: { standIn: StandIn; piece: StandInSplitPiece }) =>
  options.piece.name?.trim() || `${options.standIn.name}: ${options.piece.workPath.split('/').pop()}`;

/**
 * The pieces with every day no piece claims added to the one `claim` names.
 *
 * A day the record holds that no commit of it falls on cannot be placed by a directory, and it is
 * real work — so the user says which piece it was rather than the split guessing or dropping it.
 */
const claimedPieces = (options: {
  standIn: StandIn;
  pieces: readonly StandInSplitPiece[];
  claim?: string;
}): StandInSplitPiece[] => {
  const { pieces, claim } = options;

  if (!claim) return [...pieces];

  const covered = new Set(pieces.flatMap((piece) => piece.days));
  const left = options.standIn.days.filter((day) => !covered.has(day));

  return pieces.map((piece) =>
    piece.workPath === claim ? { ...piece, days: [...new Set([...piece.days, ...left])].sort() } : piece,
  );
};

const splitProblem = (options: {
  standIn?: StandIn;
  id: string;
  pieces: readonly StandInSplitPiece[];
  claim?: string;
}) => {
  const { standIn, pieces, claim } = options;

  if (!standIn) return `Timetrack holds no stand-in ${options.id}.`;
  if (standIn.state !== 'open') return `${options.id} is resolved, so there is nothing left to split.`;
  if (!standIn.openedFor) return `${options.id} stands for work rather than for a checkout, so it has no directories.`;
  if (pieces.length < 2) return `A split needs two directories or more, and ${pieces.length} was given.`;
  if (new Set(pieces.map((piece) => piece.workPath)).size !== pieces.length)
    return 'Two of the directories given are the same.';
  if (pieces.some((piece) => !piece.workPath.trim() || !piece.days.length))
    return 'Every directory needs a name and at least one day.';
  if (claim && !pieces.some((piece) => piece.workPath === claim))
    return `${claim} is not one of the directories the split writes, so it can claim no day.`;

  const covered = new Set(pieces.flatMap((piece) => piece.days));
  const stranded = standIn.days.filter((day) => !covered.has(day));

  return stranded.length
    ? `No commit claims ${stranded.join(', ')}. Name the directory those days belong to with --claim.`
    : undefined;
};

/**
 * Cuts one placeholder into one per directory it turned out to cover, and moves its days onto them.
 *
 * This repairs a record opened while the grain was the whole checkout, on a checkout whose branch
 * says nothing — the case `autoStandIns` can never reach, because it skips a base branch and would
 * find the wide record already waiting. Every day the old record held has to be claimed by a
 * directory, or the split refuses: a day left behind would go back to unnamed with nothing to reopen
 * it, and the old record is deleted here.
 *
 * The new records keep the old `createdAt`. The debt is as old as the work, and a split is a
 * correction of how it was named rather than a new question.
 *
 * Each rule that named the old record becomes one rule per directory, carrying the branch as well.
 * A rule naming a directory and no branch would never narrow anything: `matchAttributionRule` reads
 * it at repository scope and answers before it compares directories.
 */
export const splitStandIn = (options: {
  settings: TimetrackSettings;
  id: string;
  /** The branch the work was on, which the new records and their rules name. */
  branch: string;
  pieces: readonly StandInSplitPiece[];
  /** The directory that takes every day of the record no piece claims. Without one such a day refuses. */
  claim?: string;
  now: Date;
}): StandInSplit => {
  const { settings, id, branch, now } = options;
  const standIn = settings.standIns.find((entry) => entry.id === id);
  const pieces = standIn ? claimedPieces({ standIn, pieces: options.pieces, claim: options.claim }) : [];
  const refused = splitProblem({ standIn, id, pieces, claim: options.claim });

  if (refused || !standIn?.openedFor) return { settings, opened: [], refused };

  const checkout = standIn.openedFor;
  const opened = pieces.map((piece) => ({
    ...openStandIn({
      name: splitPieceName({ standIn, piece }),
      day: [...piece.days].sort()[0] as string,
      now,
      projectKey: standIn.projectKey,
      author: standIn.author,
      openedFor: checkout,
      openedForBranch: branch,
      openedForWorkPath: piece.workPath,
      key: [describeProjectLink({ path: checkout }), branch, piece.workPath].join('-'),
    }),
    days: [...new Set(piece.days)].sort(),
    createdAt: standIn.createdAt,
  }));
  const rewritten = settings.attributionRules.flatMap((rule) =>
    standInIdOf(rule) === id
      ? opened.map((entry, index) => ({
          ...rule,
          id: `${rule.id}#${pieces[index]?.workPath}`,
          repoPath: rule.repoPath ?? checkout,
          branch,
          workPath: pieces[index]?.workPath,
          target: { kind: 'stand-in', standInId: entry.id } as const,
          createdAt: now,
        }))
      : [rule],
  );

  return {
    settings: {
      ...settings,
      standIns: [...settings.standIns.filter((entry) => entry.id !== id), ...opened],
      attributionRules: rewritten,
    },
    opened,
  };
};

/**
 * The rules one rule becomes once the work it named turns out to be a real issue.
 *
 * A checkout-wide rule is right for a placeholder and wrong for an issue: the placeholder stands for
 * whatever the checkout does that Jira holds no ticket for, and the issue is one piece of work. So the
 * rule is cut down to the branches the placeholder held, and every other branch of that checkout goes
 * back to unnamed — where the next pass opens a placeholder of its own for it.
 *
 * A rule that already names a branch, and one of a stand-in the user wrote, are as narrow as whoever
 * wrote them meant them to be. Those keep their grain and only swap their target. So does one whose
 * placeholder held no branch worth naming: there is nothing narrower to say, and `reconsider` already
 * stops a checkout-wide rule stating a row that spans a swap.
 */
const narrowedRules = (options: {
  rule: AttributionRule;
  branches: readonly string[];
  issueKey: string;
}): AttributionRule[] => {
  const { rule, branches } = options;
  const target = { kind: 'issue', issueKey: options.issueKey } as const;

  if (!branches.length || !rule.repoPath || rule.branch) return [{ ...rule, target }];

  return branches.map((branch) => ({ ...rule, id: `${rule.id}@${branch}`, branch, target }));
};

/**
 * Names the issue the work turned out to be, and rewrites every rule that pointed at the stand-in to
 * point at that issue instead.
 *
 * This is the whole of a resolve. Every band on every day the stand-in held is named by one of these
 * rules, so none of them is visited and no stored day is rewritten. An unknown id changes nothing.
 *
 * A rule the app opened for a whole checkout is narrowed as it is rewritten. See `narrowedRules`.
 */
export const resolveStandIn = (options: {
  settings: TimetrackSettings;
  id: string;
  issueKey: string;
}): TimetrackSettings => {
  const { settings, id } = options;
  const issueKey = options.issueKey.trim().toUpperCase();
  const standIn = settings.standIns.find((entry) => entry.id === id);

  if (!standIn || standIn.state === 'resolved' || !issueKey) return settings;

  const branches = standIn.heldOn ?? [];
  const replacements = new Map(
    settings.attributionRules
      .filter((rule) => standInIdOf(rule) === id)
      .map((rule) => [rule.id, narrowedRules({ rule, branches, issueKey })] as const),
  );
  const resolvedRuleIds = [...replacements.values()].flat().map((rule) => rule.id);

  return {
    ...settings,
    standIns: settings.standIns.map((entry) =>
      entry.id === id ? { ...entry, state: 'resolved', issueKey, resolvedRuleIds } : entry,
    ),
    attributionRules: settings.attributionRules.flatMap((rule) => replacements.get(rule.id) ?? rule),
  };
};

/**
 * Undoes a resolve: the stand-in waits again, and the rules it rewrote name it rather than the issue.
 *
 * Only those rules. A rule the user wrote against the same issue by hand is left alone, which is why
 * the resolve records which ones it touched rather than searching for the key.
 *
 * The caller decides whether it may be undone at all. A day that already reached Tempo holds the key
 * in a worklog nothing here can reach, so undoing it there would leave the two disagreeing.
 */
export const reopenStandIn = (options: { settings: TimetrackSettings; id: string }): TimetrackSettings => {
  const { settings, id } = options;
  const standIn = settings.standIns.find((entry) => entry.id === id);

  if (!standIn || standIn.state !== 'resolved') return settings;

  const rewritten = standIn.resolvedRuleIds ?? [];

  return {
    ...settings,
    standIns: settings.standIns.map((entry) =>
      entry.id === id ? { ...entry, state: 'open', issueKey: undefined, resolvedRuleIds: undefined } : entry,
    ),
    attributionRules: settings.attributionRules.map((rule) =>
      rewritten.includes(rule.id) ? { ...rule, target: { kind: 'stand-in', standInId: id } } : rule,
    ),
  };
};

/**
 * Records that a day holds bands of this stand-in, so a resolve can name the days it made bookable
 * after the events behind them are pruned by retention.
 *
 * The branches that day's bands ran on are recorded with it, because that is the grain the resolve
 * cuts the rule back to. It is collected here rather than read at the resolve: the placeholder may
 * still name these, and work the checkout does after the resolve was never this issue.
 */
export const withStandInDay = (options: {
  settings: TimetrackSettings;
  id: string;
  day: string;
  /** The branches the day's bands of this stand-in ran on. */
  branches?: readonly string[];
  /** Branch names that are integration rather than one piece of work, so never a grain. */
  baseBranches?: readonly string[];
}): TimetrackSettings => ({
  ...options.settings,
  standIns: options.settings.standIns.map((entry) => {
    if (entry.id !== options.id) return entry;

    const heldOn = standInBranches({
      standIn: entry,
      branches: options.branches ?? [],
      baseBranches: options.baseBranches ?? [],
    });

    return {
      ...entry,
      days: standInDays({ standIn: entry, day: options.day }),
      ...(heldOn.length ? { heldOn } : {}),
    };
  }),
});
