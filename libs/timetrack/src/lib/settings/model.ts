import { AttributionRule } from '../correlate/rules';
import { TimetrackExclusionRule } from '../store/exclusion';

/** How much time a day is expected to account for when nothing else is configured. */
export const DEFAULT_DAY_TARGET_MS = 8 * 60 * 60_000;

export const MIN_DAY_TARGET_MS = 15 * 60_000;
export const MAX_DAY_TARGET_MS = 24 * 60 * 60_000;

/** Holds a day target inside the range a day can hold, whether it came from an input or a document. */
export const clampDayTargetMs = (value: number) =>
  Math.min(MAX_DAY_TARGET_MS, Math.max(MIN_DAY_TARGET_MS, Math.round(value)));

/** How long an idle gap may be and still count as the work around it. */
export const DEFAULT_GAP_FILL_MS = 15 * 60_000;

/**
 * A cap rather than a preference. The sessionizer ends a block after 30 unobserved minutes, so a
 * longer gap is a stretch nothing watched at all — and claiming it would be inventing time, not
 * reading evidence.
 */
export const MAX_GAP_FILL_MS = 30 * 60_000;

/** Holds a gap-fill threshold inside its range. Zero is meaningful: it fills nothing. */
export const clampGapFillMs = (value: number) => Math.min(MAX_GAP_FILL_MS, Math.max(0, Math.round(value)));

/**
 * The Jira instance issue keys are resolved against. The API token is not here — it lives in the OS
 * keychain, and this document holds only what may be read back into the window.
 */
export type TimetrackJiraSettings = {
  /** The Cloud host, with or without a scheme. `normalizeJiraHost` is what makes it a base URL. */
  host: string;
  email: string;
};

/**
 * The Google account meetings are read from. The client secret and the refresh token are keychain
 * entries; the client id is not one, and the settings screen has to show it to be editable at all.
 */
export type TimetrackGoogleSettings = {
  /** The OAuth desktop client the user registered themselves, as `…apps.googleusercontent.com`. */
  clientId: string;
  /**
   * The calendars that count as work. Empty reads nothing: a personal calendar is on the same account,
   * and guessing which one is work would put someone's private appointments in a worklog.
   */
  calendarIds: string[];
};

/**
 * Everything the user configures that is not a secret, read and written as one document.
 *
 * It is deliberately small: a value belongs here only when the app cannot work it out and being wrong
 * about it costs the user something. Everything derived — a repository's author, the Jira account id —
 * is read from the source that owns it instead.
 */
export type TimetrackSettings = {
  dayTargetMs: number;
  /**
   * The longest idle gap that is logged as the work around it. Five minutes without a keystroke is
   * reading a diff rather than a break, and a day is short by the sum of them. Zero fills nothing.
   */
  gapFillMs: number;
  jira: TimetrackJiraSettings;
  google: TimetrackGoogleSettings;
  /** The user's own deny rules. `effectiveExclusionRules` is what composes them with the defaults. */
  exclusionRules: TimetrackExclusionRule[];
  /** Whether the shipped defaults still apply. Turning them off is a deliberate, visible choice. */
  keepDefaultExclusionRules: boolean;
  /** Directories the repository discovery walks. Empty means the host decides. */
  gitScanRoots: string[];
  /**
   * The Jira project keys a branch name or a window title may name, such as `FIP`. Empty accepts
   * anything shaped like a key, which also reads `chore/angular-22` as issue ANGULAR-22 — so a
   * repository whose branch subjects can start with a word and a number needs this set.
   */
  issueKeyPrefixes: string[];
  /**
   * What the user decided a context belongs to, for repositories the branch grammar cannot name an
   * issue in. A setting rather than a table of its own: it is a handful of statements the user wrote,
   * and it is read and written whole exactly like the rest of this document.
   */
  attributionRules: AttributionRule[];
};

export const DEFAULT_TIMETRACK_SETTINGS: TimetrackSettings = {
  dayTargetMs: DEFAULT_DAY_TARGET_MS,
  gapFillMs: DEFAULT_GAP_FILL_MS,
  jira: { host: '', email: '' },
  google: { clientId: '', calendarIds: [] },
  exclusionRules: [],
  keepDefaultExclusionRules: true,
  gitScanRoots: [],
  issueKeyPrefixes: [],
  attributionRules: [],
};
