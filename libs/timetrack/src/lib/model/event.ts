/** The collector a raw observation came from. Retention and exclusion rules are applied per source. */
export type CollectedEventSource = 'window' | 'idle' | 'git' | 'agent-session' | 'calendar' | 'gitlab' | 'editor';

type CollectedEventBase<TSource extends CollectedEventSource, TKind extends string> = {
  at: Date;
  source: TSource;
  kind: TKind;
};

export type WindowFocusEvent = CollectedEventBase<'window', 'window-focus'> & {
  appId: string;
  title: string;
};

/**
 * A transition in whether the machine was being watched at all. `idle-start` and `lock` both end the
 * block that was running, and so does `pause-start` — the difference is who decided: the idle timer
 * guesses, the lock is the user leaving, and the pause is the user asking not to be watched.
 */
export type PresenceEvent = CollectedEventBase<
  'idle',
  'idle-start' | 'idle-end' | 'lock' | 'unlock' | 'pause-start' | 'pause-end'
>;

export type GitCheckoutEvent = CollectedEventBase<'git', 'git-checkout'> & {
  repoPath: string;
  branch: string;
};

export type GitCommitEvent = CollectedEventBase<'git', 'git-commit'> & {
  repoPath: string;
  branch: string;
  sha: string;
  /** The conventional-commit subject. Never carries an issue key — use it as description material. */
  subject: string;
};

export type AgentSessionEvent = CollectedEventBase<'agent-session', 'agent-session'> & {
  sessionId: string;
  cwd: string;
  gitBranch?: string;
  /** The session's own summary line, when it has one. */
  title?: string;
};

/**
 * What an editor was showing when it last reported, from a reporter the user installed themselves.
 *
 * A window title says which application had focus; this says which checkout, which branch and which
 * file — so a stretch inside one repository is attributable even when every window title reads
 * `Visual Studio Code`. It is a periodic sample rather than an edge: the reporter posts one every
 * interval while its window has focus, and the stretch between two of them is the observed time.
 */
export type EditorHeartbeatEvent = CollectedEventBase<'editor', 'editor-heartbeat'> & {
  /** Which reporter observed it, such as `vscode`. One reporter is one editor on this machine. */
  reporter: string;
  /** The checkout the editor had open, when it had one. */
  repoPath?: string;
  branch?: string;
  /**
   * The directory the edited file is in, relative to `repoPath` — the whole path when there is no
   * checkout. The directory rather than the file: `libs/components/src/lib/table` is what makes a
   * stretch recognisable, and a file name is one more thing to keep that nothing here reads.
   */
  directory?: string;
  /** The editor's own name for the language, such as `typescript`. */
  language?: string;
  /** Whether the file changed during the interval this heartbeat covers, as opposed to being read. */
  editing: boolean;
};

export type CalendarOccurrenceEvent = CollectedEventBase<'calendar', 'calendar-event'> & {
  /**
   * The provider's id for this one occurrence, not for the series. A collector reads overlapping
   * windows, so this is what keeps the same meeting from being stored on every run.
   */
  occurrenceId: string;
  until: Date;
  title: string;
  accepted: boolean;
  conferenceUrl?: string;
};

/**
 * Something the user did in GitLab: pushed, opened, commented on or approved a merge request.
 *
 * It carries an instant and no duration, so it never becomes time on its own — a comment at 10:02
 * says what the reviewer was doing, and the local collectors say how long they were at it. What it
 * does carry is the merge request's source branch, which under the branch grammar names the issue,
 * and that is how time spent in somebody else's merge request reaches the Task being reviewed.
 */
export type MergeRequestActivityEvent = CollectedEventBase<'gitlab', 'merge-request-activity'> & {
  /** GitLab's own event id. Unique inside one instance, which is what the dedupe key rests on. */
  eventId: string;
  /** GitLab's wording for what happened — `approved`, `commented on`, `pushed to`. */
  action: string;
  projectPath?: string;
  mergeRequestIid?: string;
  branch?: string;
  title?: string;
  url?: string;
};

export type CollectedEvent =
  | WindowFocusEvent
  | PresenceEvent
  | GitCheckoutEvent
  | GitCommitEvent
  | AgentSessionEvent
  | EditorHeartbeatEvent
  | CalendarOccurrenceEvent
  | MergeRequestActivityEvent;

/** Events that describe what the machine was doing, as opposed to what a calendar or an API claims. */
export type ActivityEvent =
  WindowFocusEvent | PresenceEvent | GitCheckoutEvent | GitCommitEvent | AgentSessionEvent | EditorHeartbeatEvent;

/**
 * Whether the event is one the day is reconstructed from. A calendar occurrence and a GitLab event
 * both describe work without observing it, so neither may open or extend a block: an instant with no
 * duration would otherwise invent one, and a stale sticky context would take real work with it.
 */
export const isActivityEvent = (event: CollectedEvent): event is ActivityEvent =>
  event.source !== 'calendar' && event.source !== 'gitlab';
