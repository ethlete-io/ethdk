import { DEFAULT_EXCLUSION_RULES, TimetrackExclusionRule } from '../store/exclusion';
import { TimetrackSettings } from './model';

/**
 * Applications shipped as holding no work context, `app_id` as each platform reports it.
 *
 * A media player is here because no workflow makes one a checkout. A messenger is here because a
 * window of one names no checkout even on the day it is work, and its calls are counted by
 * `TimetrackCallRules` rather than by its window. Discord is deliberately absent: it is the one of
 * them a team may run a working session in all day.
 *
 * `holdsWorkApps` is the escape hatch, one application at a time, because a team that works in one of
 * these all day should not have to give up the rest of the list. Nothing here drops an event or a
 * minute — it only says why the minute named no checkout.
 */
export const DEFAULT_NO_WORK_CONTEXT_APPS = [
  'spotify',
  'com.spotify.Client',
  'com.apple.Music',
  'org.gnome.Rhythmbox',
  'io.bassi.Amberol',
  'vlc',
  'mpv',
  'com.slack.Slack',
  'slack',
  'WhatsApp',
  'org.telegram.desktop',
  'signal',
  'com.microsoft.teams',
];

/**
 * The applications read as no work context: the shipped list plus the user's own, less the ones the
 * user took back. Taking one back beats both lists, so the panel's control always has an effect.
 */
export const effectiveNoWorkContextApps = (settings: TimetrackSettings) => {
  const held = new Set(settings.holdsWorkApps.map((id) => id.toLowerCase()));

  return [...new Set([...DEFAULT_NO_WORK_CONTEXT_APPS, ...settings.noWorkContextApps])].filter(
    (id) => !held.has(id.toLowerCase()),
  );
};

const keyOf = (rule: TimetrackExclusionRule) =>
  rule.kind === 'app-id' ? `app-id:${rule.appId.toLowerCase()}` : `title-pattern:${rule.pattern}`;

/**
 * The rules collection actually runs with: the shipped defaults unless they were turned off, plus the
 * user's own. A user rule that repeats a default is folded into one, so an exclusion is never reported
 * twice for the same reason.
 */
export const effectiveExclusionRules = (settings: TimetrackSettings): TimetrackExclusionRule[] => {
  const all = [...(settings.keepDefaultExclusionRules ? DEFAULT_EXCLUSION_RULES : []), ...settings.exclusionRules];
  const seen = new Set<string>();

  return all.filter((rule) => {
    const key = keyOf(rule);

    if (seen.has(key)) return false;

    seen.add(key);

    return true;
  });
};
