import { CallNaming } from './call-naming';
import { MeetingNaming } from './meeting-naming';

const DAY_MS = 86_400_000;

/**
 * How long a ticket may go without a change in Jira before a record naming it is reported.
 *
 * A quarter, because the tickets these records name are standing ones: a meeting ticket is touched
 * rarely and is still the right ticket months later. A shorter limit reports every standing ticket
 * every day, and a warning nobody can act on is one nobody reads.
 */
export const DEFAULT_NAMING_QUIET_AFTER_DAYS = 90;

/** A remembered naming whose ticket Jira has recorded no change on for longer than the limit. */
export type AgedNaming = {
  issueKey: string;
  /** What the record reads as in the settings list: the meeting's title, or the call's label. */
  label: string;
  /** When Jira last recorded a change on the ticket. */
  touchedAt: Date;
  /** Whole days since that change. */
  quietDays: number;
};

/** The issue keys the two remembered stores name, for a caller to ask Jira about. */
export const namedIssueKeys = (options: { namings: readonly MeetingNaming[]; callNamings: readonly CallNaming[] }) => [
  ...new Set([
    ...options.namings.map((naming) => naming.issueKey),
    ...options.callNamings.flatMap((naming) => (naming.target.kind === 'issue' ? naming.target.issueKey : [])),
  ]),
];

/**
 * The remembered namings whose ticket has gone quiet in Jira.
 *
 * A record never expires on a date — ADR 0012 — so what is read is the ticket and never the record's
 * own age: a naming written two years ago that points at a ticket people still work in is right, and
 * one written last week that points at last year's standing ticket is not.
 *
 * A key Jira answered nothing for is left out. A missing token, an unreadable project and a dead
 * ticket all read the same from here, and only the last of the three is worth a warning.
 */
export const agedNamings = (options: {
  namings: readonly MeetingNaming[];
  callNamings: readonly CallNaming[];
  /** When Jira last recorded a change on each ticket, by issue key. The core makes no call itself. */
  touchedAt: ReadonlyMap<string, Date>;
  now: Date;
  quietAfterDays?: number;
}): AgedNaming[] => {
  const quietAfterDays = options.quietAfterDays ?? DEFAULT_NAMING_QUIET_AFTER_DAYS;

  if (quietAfterDays <= 0) return [];

  const records = [
    ...options.namings.map((naming) => ({ issueKey: naming.issueKey, label: naming.title })),
    ...options.callNamings.flatMap((naming) =>
      naming.target.kind === 'issue' ? { issueKey: naming.target.issueKey, label: naming.label } : [],
    ),
  ];
  const aged = new Map<string, AgedNaming>();

  for (const record of records) {
    const touchedAt = options.touchedAt.get(record.issueKey);

    if (!touchedAt) continue;

    const quietDays = Math.floor((options.now.getTime() - touchedAt.getTime()) / DAY_MS);

    if (quietDays < quietAfterDays || aged.has(record.issueKey)) continue;

    aged.set(record.issueKey, { ...record, touchedAt, quietDays });
  }

  return [...aged.values()];
};
