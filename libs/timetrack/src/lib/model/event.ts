/** The collector a raw observation came from. Retention and exclusion rules are applied per source. */
export type CollectedEventSource = 'window' | 'idle' | 'git' | 'agent-session' | 'calendar';

type CollectedEventBase<TSource extends CollectedEventSource, TKind extends string> = {
  at: Date;
  source: TSource;
  kind: TKind;
};

export type WindowFocusEvent = CollectedEventBase<'window', 'window-focus'> & {
  appId: string;
  title: string;
};

/** A presence transition. `idle-start` and `lock` both end the block that was running. */
export type PresenceEvent = CollectedEventBase<'idle', 'idle-start' | 'idle-end' | 'lock' | 'unlock'>;

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

export type CalendarOccurrenceEvent = CollectedEventBase<'calendar', 'calendar-event'> & {
  until: Date;
  title: string;
  accepted: boolean;
  conferenceUrl?: string;
};

export type CollectedEvent =
  WindowFocusEvent | PresenceEvent | GitCheckoutEvent | GitCommitEvent | AgentSessionEvent | CalendarOccurrenceEvent;

/** Events that describe what the machine was doing, as opposed to what a calendar claims. */
export type ActivityEvent = WindowFocusEvent | PresenceEvent | GitCheckoutEvent | GitCommitEvent | AgentSessionEvent;

export const isActivityEvent = (event: CollectedEvent): event is ActivityEvent => event.source !== 'calendar';
