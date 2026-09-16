import { AttributionRule, standInIdOf } from '../model/attribution';
import { StandIn, standInBranches, standInDays } from '../model/stand-in';
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
  options.settings.attributionRules.find((rule) => standInIdOf(rule) === options.standIn.id && !rule.branch)?.repoPath;

/**
 * Takes a stand-in out, and every rule that named it with it.
 *
 * Leaving the rules would point them at a record that is gone, and the bands they cover would read as
 * named by something nobody can open. A delete is the resolve with no issue at the end of it: the
 * bands go back to unnamed on every day the stand-in held.
 *
 * Deleting one the app opened also refuses the checkout. The work under it is still unnamed, so the
 * next auto pass would open another placeholder within seconds and the delete would never stick.
 */
export const withoutStandIn = (options: { settings: TimetrackSettings; id: string }): TimetrackSettings => {
  const { settings } = options;
  const standIn = settings.standIns.find((entry) => entry.id === options.id);
  const refused = standIn?.author === 'app' && standIn.state === 'open' ? checkoutOf({ settings, standIn }) : undefined;

  return {
    ...settings,
    standIns: settings.standIns.filter((entry) => entry.id !== options.id),
    attributionRules: settings.attributionRules.filter((rule) => standInIdOf(rule) !== options.id),
    noStandInCheckouts: refused ? [...new Set([...settings.noStandInCheckouts, refused])] : settings.noStandInCheckouts,
  };
};

/** Lets the app open a placeholder for the checkout again, which is how a delete is taken back. */
export const withStandInCheckoutAllowed = (options: {
  settings: TimetrackSettings;
  repoPath: string;
}): TimetrackSettings => ({
  ...options.settings,
  noStandInCheckouts: options.settings.noStandInCheckouts.filter((path) => path !== options.repoPath),
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
