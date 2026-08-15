import { CollectedEventSource, TimetrackCredentialStatus } from '@ethlete/timetrack';

/**
 * Whether a source is producing evidence right now.
 *
 * `collecting` is the only state that puts anything in the database. `ready` has its credentials and
 * answers when something asks, `configured` means the code is there and waiting on credentials the user
 * has not given yet, and `planned` means it is not built.
 */
export type EvidenceSourceState = 'collecting' | 'ready' | 'configured' | 'planned';

export type EvidenceSource = {
  id: string;
  name: string;
  /** Where the observation comes from, in one line. */
  reads: string;
  /**
   * What is written to the encrypted store. This is the whole point of the inventory: a tool that
   * watches a workday has to be able to say exactly what it kept.
   */
  stores: string;
  /** What the source does once it has everything it needs. A row without its credential reads as
   * `configured` whatever this says. */
  state: EvidenceSourceState;
  /**
   * The credential this source cannot be read without, so storing a token flips the row rather than
   * needing an edit here.
   */
  credential?: keyof TimetrackCredentialStatus;
  /** What the source is still waiting on. Not shown once it has everything it needs. */
  detail?: string;
  /** The collector whose run this row reports. Focus and presence share one drain, so both name it. */
  collector?: 'window' | 'git' | 'agent-session' | 'calendar';
  /** The `source` its events carry in the store, for counting what it has actually put there. */
  eventSource?: CollectedEventSource;
};

/**
 * Every source the tool reads, or intends to.
 *
 * The ones that are not built are listed on purpose: a person deciding whether to install this needs
 * to see the whole surface it will eventually watch, not only the part that is watching today.
 */
export const EVIDENCE_SOURCES: EvidenceSource[] = [
  {
    id: 'window',
    name: 'Focused window',
    reads: 'The compositor reports the focused application and its title on every switch.',
    stores: 'The application id and the window title, unless an exclusion rule denies it.',
    state: 'collecting',
    collector: 'window',
    eventSource: 'window',
  },
  {
    id: 'idle',
    name: 'Presence',
    reads: 'The idle notifier, at a five-minute threshold.',
    stores: 'Only that the machine went idle or came back, with the instant it happened.',
    state: 'collecting',
    collector: 'window',
    eventSource: 'idle',
  },
  {
    id: 'git',
    name: 'Local git repositories',
    reads:
      'The reflog and the commit log of every repository found on this machine, re-read when its HEAD or refs move.',
    stores: 'Branch switches, and your own commits with their subject line. No diffs and no file paths.',
    state: 'collecting',
    collector: 'git',
    eventSource: 'git',
  },
  {
    id: 'agent-session',
    name: 'Coding-agent sessions',
    reads: "Claude Code's own session logs under the home directory.",
    stores: 'When a session was active, its working directory and branch, and its summary line.',
    state: 'collecting',
    collector: 'agent-session',
    eventSource: 'agent-session',
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    reads: 'The events of the calendars you pick, read-only.',
    stores: 'The event title, its span, whether you accepted, and a conference link when there is one.',
    state: 'collecting',
    credential: 'google',
    collector: 'calendar',
    eventSource: 'calendar',
    detail: 'Waiting on the OAuth client — nothing is fetched until you register one and grant calendar access.',
  },
  {
    id: 'jira',
    name: 'Jira',
    reads: 'The issues behind the keys the grammar found, read-only.',
    stores: 'Nothing. Issue summaries are fetched to label a row and are not persisted as evidence.',
    state: 'ready',
    credential: 'jira',
    detail: 'Waiting on a host, an account email and an API token in Settings.',
  },
  {
    id: 'tempo',
    name: 'Tempo',
    reads: "The worklogs already on your account, so a day's sync knows what it owns and what is somebody else's.",
    stores: 'The worklogs this app created, so it never writes the same time twice.',
    state: 'ready',
    credential: 'tempo',
    detail: 'Waiting on an API token in Settings.',
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    reads: 'Your own push, comment, approval and merge events, and the merge requests awaiting your review.',
    stores: 'Review work that leaves no local trace, attributed through the merge request’s source branch.',
    state: 'planned',
    detail: 'Phase 2.',
  },
  {
    id: 'vscode',
    name: 'Editor heartbeats',
    reads: 'A VS Code extension reporting the file and workspace being edited.',
    stores: 'Which project was being edited when, for the stretches window titles are too coarse for.',
    state: 'planned',
    detail: 'Phase 2, and only if window titles prove insufficient.',
  },
  {
    id: 'slack',
    name: 'Slack huddles',
    reads: 'Your own profile’s huddle state, polled on an interval.',
    stores: 'When a huddle started and ended, as coarsely as the poll interval allows.',
    state: 'planned',
    detail: 'Phase 3. There is no retroactive huddle API, so only days the app was running can ever be covered.',
  },
  {
    id: 'discord',
    name: 'Discord calls',
    reads: 'Voice state in the one configured guild, through a bot you have to be allowed to add.',
    stores: 'When you joined and left a voice channel, and which one.',
    state: 'planned',
    detail: 'Phase 3, and always proposed as a weak guess that is never synced without an explicit accept.',
  },
  {
    id: 'gmail',
    name: 'Gmail notifications',
    reads: 'A narrow query over Jira and GitLab notification senders.',
    stores: 'Only what those notifications say about issues you touched.',
    state: 'planned',
    detail: 'Phase 3, and last on purpose — once the APIs are wired this is a worse copy of the same events.',
  },
];
