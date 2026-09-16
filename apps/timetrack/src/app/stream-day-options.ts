import {
  BuildRowsOptions,
  EpicOptions,
  RecurringPattern,
  StreamDayOptions,
  TimetrackSettings,
  effectiveNoWorkContextApps,
  effectiveTransientApps,
  gitFlowConfigFor,
} from '@ethlete/timetrack';

/**
 * What this app's own windows report themselves as: the bundle identifier on macOS, and on Linux the
 * GTK application id, which is the binary name rather than the identifier.
 */
export const OWN_APP_IDS = ['io.ethlete.timetrack', 'timetrack'];

/**
 * What every reader turns a day's blocks into rows with — see `buildRows`.
 *
 * `links` and `calls` are left out on purpose: `streamDay` holds the user's project links and has
 * already classified the day's calls, and a second copy of either would let the streams and the rows
 * disagree about a minute neither is wrong about.
 */
export const dayRowsOptionsOf = (options: {
  settings: TimetrackSettings;
  /** The standing commitments the user's Tempo history holds, from `injectRecurringPatterns`. */
  patterns?: readonly RecurringPattern[];
  /**
   * What a sibling checkout on the same branch name books, from `injectEpicSiblings`.
   *
   * Left out by a reader that builds the day the resolver itself reads: that read is the rung's first
   * pass, and handing it an answer it produced would let the day narrow its own input.
   */
  epics?: EpicOptions;
}): Omit<BuildRowsOptions, 'links' | 'calls'> => {
  const { settings } = options;

  return {
    config: gitFlowConfigFor(settings),
    rules: settings.attributionRules,
    standIns: settings.standIns,
    cut: { backgroundProjects: settings.backgroundProjects },
    patterns: [...(options.patterns ?? [])],
    epics: options.epics,
    fill: { maxFillGapMs: settings.gapFillMs },
    meetings: { namings: settings.meetingNamings, callNamings: settings.callNamings },
    noWorkContext: {
      apps: effectiveNoWorkContextApps(settings),
      workApps: [...settings.holdsWorkApps],
      transientApps: effectiveTransientApps(settings),
    },
  };
};

/**
 * The options every reader of a stream day passes.
 *
 * Shared rather than built per screen, because the day screen, the tray readout and the Sources panel
 * measure the same folded line: a different set of roots or links in one of them would make them
 * disagree about minutes none of them is wrong about.
 */
export const streamDayOptionsOf = (options: {
  repoRoots: readonly string[];
  settings: TimetrackSettings;
  /** The standing commitments the user's Tempo history holds, from `injectRecurringPatterns`. */
  patterns?: readonly RecurringPattern[];
  /** What a sibling checkout on the same branch name books, from `injectEpicSiblings`. */
  epics?: EpicOptions;
  /** The instant the window source has reported through, which is its last drain. */
  windowsSeenThroughMs?: number;
  /** What this reader adds to the shared row options: the day's timer runs, pauses and edits. */
  rows?: Omit<BuildRowsOptions, 'links' | 'calls'>;
}): Partial<StreamDayOptions> => ({
  repoRoots: [...options.repoRoots],
  links: options.settings.projectLinks,
  ownAppIds: OWN_APP_IDS,
  windowsSeenThroughMs: options.windowsSeenThroughMs,
  callRules: options.settings.callRules,
  noWorkContextApps: effectiveNoWorkContextApps(options.settings),
  transientApps: effectiveTransientApps(options.settings),
  minBreakMs: options.settings.gapFillMs,
  rows: {
    ...dayRowsOptionsOf({ settings: options.settings, patterns: options.patterns, epics: options.epics }),
    ...options.rows,
  },
});
