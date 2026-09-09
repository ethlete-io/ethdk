import { StreamDayOptions, TimetrackSettings } from '@ethlete/timetrack';

/**
 * What this app's own windows report themselves as: the bundle identifier on macOS, and on Linux the
 * GTK application id, which is the binary name rather than the identifier.
 */
export const OWN_APP_IDS = ['io.ethlete.timetrack', 'timetrack'];

/**
 * The options every reader of a stream day passes.
 *
 * Shared rather than built per screen, because the Today screen and the Sources panel measure the same
 * folded line: a different set of roots or links in one of them would make the two disagree about
 * minutes neither is wrong about.
 */
export const streamDayOptionsOf = (options: {
  repoRoots: readonly string[];
  settings: TimetrackSettings;
  /** The instant the window source has reported through, which is its last drain. */
  windowsSeenThroughMs?: number;
}): Partial<StreamDayOptions> => ({
  repoRoots: [...options.repoRoots],
  links: options.settings.projectLinks,
  ownAppIds: OWN_APP_IDS,
  windowsSeenThroughMs: options.windowsSeenThroughMs,
  callRules: options.settings.callRules,
});
