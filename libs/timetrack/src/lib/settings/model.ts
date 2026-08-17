import { TimetrackProjectLink } from '../correlate/project-link';
import { AttributionRule } from '../correlate/rules';
import { JiraParenting } from '../jira/hierarchy';
import { DEFAULT_REASONING_OPTIONS } from '../reason/model';
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
 * One Jira project the user works in, picked from the instance rather than typed.
 *
 * The name is stored beside the key so a picker can read `FIP — Fanily Platform` with no call, and so
 * a list of keys somebody has to recognise stays readable on a machine that is offline or whose token
 * expired. It is a cache of one string, not a source of truth: a project renamed in Jira reads under
 * its old name until the list is picked again, which is a wrong label, never a wrong worklog.
 */
export type TimetrackFavoriteProject = {
  key: string;
  name: string;
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
 * The GitLab instance review activity is read from. The personal access token is a keychain entry;
 * the host is not one, and the settings screen has to show which instance it will call.
 */
export type TimetrackGitLabSettings = {
  /** The instance, with or without a scheme. `normalizeGitLabHost` is what makes it a base URL. */
  host: string;
};

/**
 * The local agent CLI that proposes an issue for a context nothing deterministic could name.
 *
 * Off until the user turns it on, and it is the one part of the app that sends anything about the
 * day anywhere but Jira and Tempo. There is no API key here or in the keychain: the call runs as the
 * user's own CLI and uses whatever subscription that CLI is already signed in to.
 */
export type TimetrackReasoningSettings = {
  enabled: boolean;
  /** `claude` or `codex`. The host runs no other binary. */
  command: string;
  /** A model alias such as `sonnet`. Empty uses the CLI's own default, which is the usual answer. */
  model: string;
};

/**
 * How this instance wants a ticket filed, for the work a day found that no issue covers.
 *
 * Every value here is instance-specific and none of it can be worked out from the outside: Jira's
 * default hierarchy puts Story and Task on the same level, so whether a parent is even expressible
 * through the parent field depends on the levels the instance defines. `describeJiraHierarchy$`
 * reports what it can express; this is where the answer is written down.
 */
export type TimetrackTicketSettings = {
  /** The type a created ticket gets, by name — the name Jira shows, such as `Task`. */
  issueTypeName: string;
  /** The types a parent may be, by name. Empty offers every open issue in the project. */
  parentIssueTypeNames: string[];
  /** How the instance expresses the relation to a parent. */
  parenting: JiraParenting;
  /** The link type used when `parenting` is `issue-link`, by name, such as `Relates`. */
  parentLinkType: string;
  /**
   * The field holding a branch subject, such as `customfield_10057`. It is a field id rather than a
   * name because that is what the REST API writes to. Empty writes no subject at all.
   */
  subjectField: string;
};

/**
 * When the app says a day is not finished yet.
 *
 * The minute is local and the reminder is only ever about today: a past day is caught up in the week
 * view, and a machine that was off at the configured minute has nothing to be reminded about at 03:00.
 */
export type TimetrackNudgeSettings = {
  enabled: boolean;
  /** The local minute of day the day's review is due. */
  atMinute: number;
};

export const DEFAULT_NUDGE_AT_MINUTE = 17 * 60 + 30;

export const MAX_MINUTE_OF_DAY = 24 * 60 - 1;

/** Holds a reminder time inside a day, whether it came from a control or from a stored document. */
export const clampMinuteOfDay = (value: number) => Math.min(MAX_MINUTE_OF_DAY, Math.max(0, Math.round(value)));

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
  gitlab: TimetrackGitLabSettings;
  ticket: TimetrackTicketSettings;
  reasoning: TimetrackReasoningSettings;
  nudge: TimetrackNudgeSettings;
  /** The user's own deny rules. `effectiveExclusionRules` is what composes them with the defaults. */
  exclusionRules: TimetrackExclusionRule[];
  /** Whether the shipped defaults still apply. Turning them off is a deliberate, visible choice. */
  keepDefaultExclusionRules: boolean;
  /** Directories the repository discovery walks. Empty means the host decides. */
  gitScanRoots: string[];
  /**
   * The Jira projects this machine works in, picked from the instance.
   *
   * They are the app's whole notion of "your projects": the keys a branch name or a window title may
   * name, and the projects every issue picker reads from. An instance has hundreds of projects and a
   * person works in a handful, so a picker that offered all of them would be a list nobody reads.
   *
   * Empty is the unconfigured state, and it costs accuracy: a key in free text is then never trusted,
   * because anything shaped like one would count and `GCP-1234` in a browser title is not an issue.
   */
  favoriteProjects: TimetrackFavoriteProject[];
  /**
   * The issue a meeting is logged against when neither its own title nor Tempo history names one.
   * Empty leaves such a meeting unattributed, which is a question the review then asks every day.
   */
  meetingIssueKey: string;
  /**
   * What the user decided a context belongs to, for repositories the branch grammar cannot name an
   * issue in. A setting rather than a table of its own: it is a handful of statements the user wrote,
   * and it is read and written whole exactly like the rest of this document.
   */
  attributionRules: AttributionRule[];
  /**
   * Which paths are work, and which project each files its tickets in. A path nobody linked keeps
   * behaving as it always has — it becomes a context the review offers to name, because a checkout
   * that vanished from the day without being asked about is worse than one row too many.
   */
  projectLinks: TimetrackProjectLink[];
};

export const DEFAULT_TIMETRACK_SETTINGS: TimetrackSettings = {
  dayTargetMs: DEFAULT_DAY_TARGET_MS,
  gapFillMs: DEFAULT_GAP_FILL_MS,
  jira: { host: '', email: '' },
  google: { clientId: '', calendarIds: [] },
  gitlab: { host: '' },
  ticket: {
    issueTypeName: 'Task',
    parentIssueTypeNames: ['Story', 'Epic'],
    parenting: 'parent-field',
    parentLinkType: 'Relates',
    subjectField: '',
  },
  reasoning: { enabled: false, command: DEFAULT_REASONING_OPTIONS.command, model: DEFAULT_REASONING_OPTIONS.model },
  nudge: { enabled: true, atMinute: DEFAULT_NUDGE_AT_MINUTE },
  exclusionRules: [],
  keepDefaultExclusionRules: true,
  gitScanRoots: [],
  favoriteProjects: [],
  meetingIssueKey: '',
  attributionRules: [],
  projectLinks: [],
};
