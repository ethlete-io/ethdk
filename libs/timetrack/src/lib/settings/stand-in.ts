import { standInIdOf } from '../model/attribution';
import { StandIn, standInDays } from '../model/stand-in';
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
 * Takes a stand-in out, and every rule that named it with it.
 *
 * Leaving the rules would point them at a record that is gone, and the bands they cover would read as
 * named by something nobody can open. A delete is the resolve with no issue at the end of it: the
 * bands go back to unnamed on every day the stand-in held.
 */
export const withoutStandIn = (options: { settings: TimetrackSettings; id: string }): TimetrackSettings => ({
  ...options.settings,
  standIns: options.settings.standIns.filter((entry) => entry.id !== options.id),
  attributionRules: options.settings.attributionRules.filter((rule) => standInIdOf(rule) !== options.id),
});

/**
 * Names the issue the work turned out to be, and rewrites every rule that pointed at the stand-in to
 * point at that issue instead.
 *
 * This is the whole of a resolve. Every band on every day the stand-in held is named by one of these
 * rules, so none of them is visited and no stored day is rewritten. An unknown id changes nothing.
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

  const rewritten = settings.attributionRules.filter((rule) => standInIdOf(rule) === id);
  const resolvedRuleIds = rewritten.map((rule) => rule.id);

  return {
    ...settings,
    standIns: settings.standIns.map((entry) =>
      entry.id === id ? { ...entry, state: 'resolved', issueKey, resolvedRuleIds } : entry,
    ),
    attributionRules: settings.attributionRules.map((rule) =>
      resolvedRuleIds.includes(rule.id) ? { ...rule, target: { kind: 'issue', issueKey } } : rule,
    ),
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
 */
export const withStandInDay = (options: {
  settings: TimetrackSettings;
  id: string;
  day: string;
}): TimetrackSettings => ({
  ...options.settings,
  standIns: options.settings.standIns.map((entry) =>
    entry.id === options.id ? { ...entry, days: standInDays({ standIn: entry, day: options.day }) } : entry,
  ),
});
