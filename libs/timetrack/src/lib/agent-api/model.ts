import { JiraParenting } from '../jira/hierarchy';
import { NamingAuthor } from '../model/attribution';
import { Confidence } from '../model/evidence';
import { WorklogProposalState } from '../model/proposal';
import { StandInState } from '../model/stand-in';
import { DayWarning } from '../rows/round';
import { RepoNamingDeclineReason } from '../rows/repo-naming';

/**
 * The contract between the app and a coding agent's CLI, spoken over the host's loopback endpoint.
 *
 * It exists so that a Jira token lives in one place on a machine. Every repository an agent works in
 * would otherwise need its own copy of the credentials to look up an issue key, and a secret copied
 * per repository is a secret nobody can rotate.
 *
 * The version is the whole contract's, not one operation's: a caller that does not know it refuses
 * rather than guessing what an answer means.
 */
export const AGENT_API_VERSION = 1;

/**
 * What the Jira instance itself is shaped like, read from the instance rather than from settings.
 *
 * It answers the two questions a setup step cannot guess: which levels exist, and which custom field
 * could hold a branch subject. Both differ on every instance, and a wrong answer to either files
 * tickets at the wrong level or writes a subject into a field that means something else.
 */
export type AgentApiInstance = {
  /** The levels this instance defines, highest first, with the type names sitting on each. */
  levels: { hierarchyLevel: number; typeNames: string[] }[];
  /** What those levels imply a parent can be named by. Settings may still override it. */
  suggestedParenting: JiraParenting;
  /** The custom text fields a branch subject could be written to, by name. */
  subjectFieldCandidates: { id: string; name: string }[];
};

/** One issue, as an agent reads it. The subject is resolved against the instance's own field. */
export type AgentApiIssue = {
  key: string;
  id: string;
  summary: string;
  issueType: string;
  /** The Story or Epic it rolls up to, when the instance reports one. */
  parentKey?: string;
  /** The branch subject the instance's subject field holds, when it is configured and set. */
  subject?: string;
};

/** What the app can say about itself, so a caller can report why an operation would fail. */
export type AgentApiStatus = {
  version: number;
  /** Whether a host, an account email and a token are all configured. */
  jiraReady: boolean;
  /**
   * Whether a Tempo token is stored. Without one the app reads no worklog history, so the recurrence
   * rung and the checkout-wide naming offer both stay silent with nothing to report.
   */
  tempoReady: boolean;
  /** The projects the user picked, which is every picker's scope and the branch grammar's prefixes. */
  projects: { key: string; name: string }[];
  /** The instance's branch-subject field id, or an empty string when none is configured. */
  subjectField: string;
};

/** Which project a repository logs into, as the settings already answer it. */
export type AgentApiRepoProject = {
  repoPath: string;
  /** The project the covering link names, or nothing when nothing covers the path. */
  projectKey?: string;
  /** Whether the link marks the path private — work there is logged nowhere. */
  private: boolean;
  /** Whether the covering link names a directory above the repository rather than the repository. */
  inherited: boolean;
  /** What the path's own name suggests, offered only while no link covers it. */
  suggestedProjectKey?: string;
};

export type AgentApiCreatedIssue = { key: string; id: string };

/** One standing statement about what work in a context is logged against. */
export type AgentApiAttributionRule = {
  id: string;
  /** The repository the rule applies to, as the absolute path the collectors report. */
  repoPath?: string;
  /** The one branch of `repoPath` the rule is restricted to, when it is restricted at all. */
  branch?: string;
  /** The application the rule names, for work that has no repository. */
  appId?: string;
  /** The issue the rule names, or nothing when it donates its time or names a stand-in instead. */
  issueKey?: string;
  /** The stand-in the rule names, as an id into the list `standIn.list` answers. */
  standInId?: string;
  /** Whether the rule donates its time to the work around it rather than naming an issue. */
  donates: boolean;
  createdAtMs: number;
};

/**
 * One name the user gave work that Jira does not hold yet.
 *
 * An agent reads this list to say what is still open and how long it has waited, and it may delete
 * one. It may not open one: a stand-in is the user's own word for their work, and an agent that opens
 * one puts a name on the day the user never chose.
 */
export type AgentApiStandIn = {
  id: string;
  /** What the user called the work, in their own words. */
  name: string;
  /** The Jira project the issue will be filed in, when a link or the user named one. */
  projectKey?: string;
  state: StandInState;
  /** The issue it resolved to. Absent while it is open. */
  issueKey?: string;
  /** The local day keys that hold bands of it, oldest first. */
  days: string[];
  author: NamingAuthor;
  createdAtMs: number;
  /** The checkout the app opened it for. Absent on one the user opened by hand. */
  openedFor?: string;
  /**
   * The branch of that checkout it covers. Absent on a record opened before the grain was the branch,
   * which is why such a record covers the whole checkout and blocks every branch of it.
   */
  openedForBranch?: string;
  /** The directory of that branch it covers, where the branch names no piece of work of its own. */
  openedForWorkPath?: string;
};

/** One standing statement about a path: whether it is work, and which project it files into. */
export type AgentApiProjectLink = {
  id: string;
  path: string;
  /** The project the link names, or nothing when it marks the path private instead. */
  projectKey?: string;
  private: boolean;
  createdAtMs: number;
};

/**
 * The settings that decide what a day's work is named, with nothing that could identify or
 * authenticate the user in it.
 *
 * A caller reaches this over the loopback endpoint and may hand what it reads to a hosted model, so
 * the Jira host, the account email and every token stay out of it by construction.
 */
export type AgentApiRules = {
  dayTargetMs: number;
  gapFillMs: number;
  dayStartHour: number;
  attributionRules: AgentApiAttributionRule[];
  projectLinks: AgentApiProjectLink[];
  /** The projects whose work runs behind the day rather than being it. */
  backgroundProjects: string[];
  /** The applications the user says hold no work context at all. */
  noWorkContextApps: string[];
  /** The applications the user says do hold work, which is what gives one a lane of its own. */
  holdsWorkApps: string[];
  /** Which applications a call counts as work in, and which it never does. */
  callRules: { countsAsWork: string[]; neverCountsAsWork: string[] };
  /** What the user answered for a meeting the calendar holds, keyed on its series. */
  meetingNamings: AgentApiMeetingNaming[];
  /** What the user answered for a call the calendar never held, keyed on the call's own features. */
  callNamings: AgentApiCallNaming[];
};

/**
 * One answer the user gave a meeting, as `settings.rules` reports it.
 *
 * `title` is the meeting's own name and it is here on purpose: without it a list of series keys says
 * nothing a reader can act on. A caller that forwards this to a hosted model forwards a meeting title
 * with it — see ADR 0013.
 */
export type AgentApiMeetingNaming = {
  seriesKey: string;
  issueKey: string;
  title: string;
  createdAtMs: number;
};

/**
 * One answer the user gave a call, as `settings.rules` reports it. The features are the key it is
 * matched on, so a reader can tell why a call did or did not reach it.
 */
export type AgentApiCallNaming = {
  appId: string;
  /** 0 for Sunday. */
  weekday: number;
  durationBand: string;
  /** What ran immediately before it, where anything did. */
  after?: string;
  /** Minutes past local midnight. */
  startMinute: number;
  issueKey?: string;
  standInId?: string;
  /** What the call read as when the answer was given. */
  label: string;
  createdAtMs: number;
};

/**
 * What the checkout-wide naming offer says about one day, offers and refusals alike.
 *
 * A card the day screen never draws is the hardest thing to ask about: the project link, the Tempo
 * history and the three thresholds are each invisible from the screen, and each of them stops
 * silently. This names the step that stopped, so an agent can answer "why was this checkout never
 * offered a name" without reading any of the user's worklogs.
 */
export type AgentApiNaming = {
  day: string;
  /** Whether a Tempo token is stored. Without one every checkout declines with `no-history`. */
  tempoReady: boolean;
  /**
   * How far the read of the user's Tempo history got. A token that is stored and a history that
   * arrived are different claims, and `no-history` on every checkout means the second one failed.
   */
  history: AgentApiHistoryState;
  /** How many worklogs the span holds, whatever project they are in. */
  historyWorklogs: number;
  /** What the read failed with. Absent unless `history` is `failed`. */
  historyMessage?: string;
  offers: AgentApiNamingOffer[];
  declines: AgentApiNamingDecline[];
};

export type AgentApiHistoryState = 'loading' | 'no-token' | 'ready' | 'failed';

export type AgentApiNamingOffer = {
  repoPath: string;
  projectKey: string;
  issueKey: string;
  summary: string;
  /** Distinct days of the history span that logged against the issue. */
  days: number;
  loggedMs: number;
  /** How much of the project's logged time went to this one issue, from 0 to 1. */
  share: number;
};

export type AgentApiNamingDecline = {
  repoPath: string;
  reason: RepoNamingDeclineReason;
  projectKey?: string;
  issueKey?: string;
  days?: number;
  loggedMs?: number;
  projectMs?: number;
  share?: number;
};

/** A row an agent wrote onto a day, as the app stored it. */
export type AgentApiWorklog = {
  /** The local day it landed on, as `YYYY-MM-DD`. */
  day: string;
  issueKey: string;
  description: string;
  fromMs: number;
  toMs: number;
  durationMs: number;
};

/** One row of a day as an agent reads it, and the id every edit to that row names it by. */
export type AgentApiReviewedRow = {
  id: string;
  /** Absent on a row nothing has named. Such a row is drawn and never written. */
  issueKey?: string;
  /** The stand-in naming the row, while Jira holds no issue for the work. */
  standInId?: string;
  description: string;
  fromMs: number;
  toMs: number;
  /** What a sync would write for the row, which is the time its band covers. */
  durationMs: number;
  /** What was observed under it. Zero on a row somebody wrote by hand. */
  observedMs: number;
  /** The lane the day screen draws it in. Absent for a row no checkout and no call holds. */
  laneKey?: string;
  state: WorklogProposalState;
  confidence: Confidence;
  /**
   * Why an unnamed row is unnamed, where the ladder did name it: the key the day withheld because
   * nobody was at the machine. A caller asked to check a day reads it to tell such a band apart from
   * one the ladder could not name at all.
   */
  withheldIssueKey?: string;
  /**
   * The other work a second rung named for this band, when two rungs named different work. The row
   * books `issueKey` all the same, so a caller reads this to tell a settled answer from a picked one.
   */
  disputedIssueKey?: string;
  /** The same, for a rung that named a stand-in rather than an issue. */
  disputedStandInId?: string;
  /** Whether a reviewer's own edit produced this row. */
  edited: boolean;
  /** Whether the row is off the timeline. A hidden row is neither written nor waiting for a name. */
  hidden: boolean;
};

/** A day as its review draws it: the rows on the timeline, the ones taken off it, and its totals. */
export type AgentApiDayRows = {
  day: string;
  rows: AgentApiReviewedRow[];
  hidden: AgentApiReviewedRow[];
  /** What a sync would write for the day. */
  proposedMs: number;
  /** The proposals plus what Tempo already holds. */
  loggedMs: number;
  targetMs: number;
  /** Observed time nothing has named, which is what the day still asks about. */
  unattributedMs: number;
  warnings: DayWarning[];
};

/**
 * One change to one row of a day, as a CLI in another repository states it.
 *
 * The row is named by the id `day.rows` answered and never by its clock, so an edit cannot land on a
 * band the caller never read. Nothing that restructures the day is here: an agent may correct a row's
 * times, its name, its note and whether it syncs, and it may not split, merge or delete one.
 */
export type AgentApiRowEdit =
  | { kind: 'range'; rowId: string; fromMs: number; toMs: number }
  | { kind: 'issue'; rowId: string; issueKey: string }
  | { kind: 'description'; rowId: string; description: string }
  | { kind: 'state'; rowId: string; state: 'accepted' | 'rejected' }
  | { kind: 'hidden'; rowId: string; hidden: boolean }
  | { kind: 'reset'; rowId: string };

/** What a write of edits reports: how many landed, and the day as it reads afterwards. */
export type AgentApiEditedDay = AgentApiDayRows & { applied: number };

export type AgentApiRequest =
  | { op: 'status' }
  | { op: 'jira.instance' }
  | { op: 'jira.issue'; key: string }
  | { op: 'jira.search'; text: string; projectKey?: string; assignedToMe: boolean; limit?: number }
  | { op: 'repo.project'; repoPath: string }
  | {
      op: 'jira.create';
      summary: string;
      description: string;
      projectKey?: string;
      issueTypeName?: string;
      parentKey?: string;
      subject?: string;
    }
  | { op: 'worklog.add'; issueKey: string; description: string; fromMs: number; durationMs: number }
  | { op: 'day.events'; day: string }
  | { op: 'day.rows'; day: string }
  | { op: 'day.edits'; day: string; edits: AgentApiRowEdit[] }
  | { op: 'settings.rules' }
  | { op: 'standIn.list' }
  | { op: 'standIn.remove'; id: string }
  | { op: 'standIn.split'; id: string; branch: string; commits: AgentApiWorkCommit[]; paths: string[]; apply: boolean }
  | { op: 'naming.offers'; day: string };

/**
 * One commit a split reads a directory out of: the local day it counts toward, and its changed files.
 *
 * The caller reads these out of `git log --name-only`. A commit collected before Timetrack recorded
 * file paths carries none in the store, which is every commit a wrongly grained placeholder covers.
 */
export type AgentApiWorkCommit = { day: string; paths: string[] };

/** One directory a split names, with the days of the record that worked in it. */
export type AgentApiStandInPiece = { workPath: string; days: string[] };

/**
 * What a split would do, or did.
 *
 * `candidates` is every directory the commits name, whether or not it is a grain. `pieces` is what
 * gets written: the directories the caller chose, or the automatic reading where they chose none.
 */
export type AgentApiStandInSplit = {
  candidates: AgentApiStandInPiece[];
  pieces: AgentApiStandInPiece[];
  standIns: AgentApiStandIn[];
};

export type AgentApiOp = AgentApiRequest['op'];

/**
 * What the endpoint writes back. `ok` is the operation's own verdict rather than the endpoint's: a key
 * Jira does not know is a failed operation over a working endpoint, and the HTTP status stays 200.
 */
export type AgentApiAnswer<T = unknown> = { ok: true; value: T } | { ok: false; message: string };
