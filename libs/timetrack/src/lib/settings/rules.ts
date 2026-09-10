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
 * these all day should not have to give up the rest of the list. Nothing here drops an event, and the
 * folded line still holds the minutes, so the day still reconciles with the Today screen. What it does
 * drop is the row: `dropNoWorkContext` takes these blocks out before any row is proposed from them.
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
  'com.gabm.satty',
  'PrusaSlicer',
];

/**
 * Applications shipped as transient chrome: a window that opens over the work rather than beside it,
 * `app_id` as each platform reports it.
 *
 * A file picker is the case this exists for. It holds the focus for twenty seconds, names no checkout,
 * and without this it both takes a lane of its own and cuts the checkout underneath it in two. A short
 * one takes the context of the block it interrupted instead, so the work reads as one stretch.
 *
 * A password manager popup is the same window in a browser. Chrome reports one as
 * `chrome-<extension id>-Default`, and an extension id is the same on every machine that installs it,
 * so naming the popup by id is portable. Only the popups are listed: a web application installed as a
 * window reports the same shape and is real work, so the shape itself is no rule.
 *
 * `holdsWorkApps` takes an entry off this list as well, and a window that outlasts
 * `DEFAULT_MAX_TRANSIENT_MS` is dropped rather than given the work around it.
 */
export const DEFAULT_TRANSIENT_APPS = [
  'xdg-desktop-portal-gnome',
  'xdg-desktop-portal-gtk',
  'xdg-desktop-portal-kde',
  'xdg-desktop-portal-hyprland',
  'org.freedesktop.impl.portal.desktop.gnome',
  'org.freedesktop.impl.portal.desktop.gtk',
  'chrome-nngceckbapebfimnlniiiahkandclblb-Default',
  'chrome-hhieiojnefblcnbdbmeamnljodladlem-Default',
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

/**
 * The applications read as transient chrome: the shipped list, less the ones the user took back. There
 * is no user list to add to it, because naming a file picker is not a thing a user should have to do.
 */
export const effectiveTransientApps = (settings: TimetrackSettings) => {
  const held = new Set(settings.holdsWorkApps.map((id) => id.toLowerCase()));

  return DEFAULT_TRANSIENT_APPS.filter((id) => !held.has(id.toLowerCase()));
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
