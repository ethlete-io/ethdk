import { closeSync, lstatSync, openSync, unlinkSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import {
  TimetrackApprovalStatus,
  TimetrackAttributionRule,
  TimetrackQueued,
  TimetrackIssue,
  TimetrackNamingDecline,
  TimetrackStandIn,
  TimetrackTempoSync,
  TimetrackTempoWorklog,
  TimetrackCalendarEvent,
  timetrackAddWorklog,
  timetrackApplyStandInSplit,
  timetrackApprovalStatus,
  timetrackCreateIssue,
  TimetrackRow,
  TimetrackRowEdit,
  timetrackDayEvents,
  timetrackDayRows,
  timetrackDiscoveryPath,
  timetrackEditDay,
  timetrackInstance,
  timetrackIssue,
  timetrackNaming,
  timetrackRepoProject,
  timetrackRules,
  timetrackSearch,
  timetrackRemoveStandIn,
  timetrackRenameStandIn,
  timetrackMergeStandIn,
  timetrackResyncAgentSessions,
  timetrackSplitStandIn,
  timetrackStandIns,
  timetrackStatus,
  timetrackTempoDelete,
  timetrackTempoSync,
  timetrackTempoSyncWrite,
  timetrackTempoWorklogs,
  timetrackCalendarEvents,
} from './timetrack';
import { plain } from './plain-text';
import { commitAuthorOf, commitPathsOnDays, currentBranch, projectRootsOf } from './git';

const FLAGS_WITH_VALUE = [
  '--root',
  '--project',
  '--limit',
  '--summary',
  '--description',
  '--type',
  '--parent',
  '--subject',
  '--issue',
  '--minutes',
  '--at',
  '--out',
  '--day',
  '--from',
  '--to',
  '--state',
  '--remove',
  '--split',
  '--branch',
  '--paths',
  '--claim',
  '--author',
  '--plan',
  '--delete',
  '--repo',
  '--name',
  '--rename',
  '--merge',
  '--into',
];

/** Every human-readable line, with anything a terminal would act on printed rather than obeyed. */
const say = (line: string) => console.log(plain(line));

const positionalArgs = (args: string[]) =>
  args.filter((entry, index) => !entry.startsWith('--') && !FLAGS_WITH_VALUE.includes(args[index - 1] ?? ''));

const flagValue = (args: string[], flag: string) => {
  const index = args.indexOf(flag);

  if (index === -1) return undefined;

  const value = args[index + 1];

  if (value === undefined || value.startsWith('--')) throw new Error(`${flag} needs a value.`);

  return value;
};

const numberFlag = (args: string[], flag: string) => {
  const raw = flagValue(args, flag);

  if (raw === undefined) return undefined;

  const value = raw.trim() ? Number(raw) : Number.NaN;

  if (!Number.isFinite(value)) throw new Error(`${flag} takes a number, not ${raw}.`);

  return value;
};

const countFlag = (args: string[], flag: string) => {
  const value = numberFlag(args, flag);

  if (value !== undefined && (!Number.isInteger(value) || value <= 0)) {
    throw new Error(`${flag} takes a whole number above zero, not ${value}.`);
  }

  return value;
};

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_CLOCK = /^(\d{1,2}):(\d{2})$/;

/**
 * Reads an instant flag. A date alone is local midnight and a clock alone is that time today, where
 * `Date` would read the first as UTC and refuse the second; anything else goes to `Date` as it is.
 */
const instantOf = (flag: string, raw: string) => {
  const date = LOCAL_DATE.exec(raw);
  const clock = LOCAL_CLOCK.exec(raw);
  const today = new Date();
  const at = date
    ? new Date(Number(date[1]), Number(date[2]) - 1, Number(date[3]))
    : clock
      ? new Date(today.getFullYear(), today.getMonth(), today.getDate(), Number(clock[1]), Number(clock[2]))
      : new Date(raw);

  if (Number.isNaN(at.getTime())) throw new Error(`${flag} takes a date, not ${raw}.`);

  return at.getTime();
};

const instantFlag = (args: string[]) => {
  const raw = flagValue(args, '--at');

  return raw ? instantOf('--at', raw) : Date.now();
};

const issueLine = (issue: TimetrackIssue) =>
  [
    issue.key,
    issue.issueType,
    issue.summary,
    ...(issue.parentKey ? [`under ${issue.parentKey}`] : []),
    ...(issue.subject ? [`subject ${issue.subject}`] : []),
  ].join('  ');

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const pad = (value: number) => String(value).padStart(2, '0');

const today = () => {
  const now = new Date();

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const countByKind = (events: readonly unknown[]) => {
  const counts = new Map<string, number>();

  for (const event of events) {
    const kind = String((event as { kind?: unknown }).kind ?? 'unknown');

    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }

  return [...counts].sort((left, right) => right[1] - left[1]);
};

const describeRule = (rule: TimetrackAttributionRule) => {
  const where = rule.appId
    ? `app ${rule.appId}`
    : `${rule.repoPath ?? 'nowhere'}${rule.branch ? ` @ ${rule.branch}` : ''}`;

  if (rule.donates) return `${where} → donate`;
  if (rule.standInId) return `${where} → stand-in ${rule.standInId}`;

  return `${where} → ${rule.issueKey ?? 'no issue'}`;
};

const DAY_MS = 24 * 60 * 60_000;

/**
 * The checkout an open placeholder holds at the wider grain, or nothing when it names a branch.
 *
 * Two separate things stop a branch-grained placeholder opening, and either alone is enough, so both
 * are read here. The record itself blocks when it was opened for a checkout and names no branch. A
 * rule blocks when it names the placeholder for a checkout and names no branch — and a record opened
 * before the grain was the branch has no `openedFor` at all, so the rule is the only side that shows
 * it. Until the placeholder goes, the checkout stays at the wider grain.
 */
const wholeCheckoutHeld = (options: { standIn: TimetrackStandIn; rules: readonly TimetrackAttributionRule[] }) => {
  const { standIn } = options;

  if (standIn.state !== 'open') return undefined;
  if (standIn.openedForBranch) return undefined;
  if (standIn.openedFor) return standIn.openedFor;

  return options.rules.find((rule) => rule.standInId === standIn.id && rule.repoPath && !rule.branch)?.repoPath;
};

/**
 * The days a delete of this record would leave unnamed, today left out.
 *
 * A delete takes the rule with it, and only the day the app next reviews gets a new placeholder. Any
 * earlier day the record covered reads as unnamed from then on, with nothing left to say what it was.
 */
const strandedDays = async (id: string) => {
  const standIn = (await timetrackStandIns()).find((entry) => entry.id === id);
  const now = today();

  return standIn?.state === 'open' ? standIn.days.filter((day) => day !== now).sort() : [];
};

/**
 * Where a placeholder stands for its work: the checkout, then the narrowest thing it was cut to.
 *
 * Two of them may carry one name and mean two pieces of work, because a spec track and the branch
 * that implements it are both called after the feature. One the user wrote by hand names no
 * checkout, and this answers nothing for it.
 */
const standInWhere = (standIn: TimetrackStandIn) => {
  if (!standIn.openedFor) return '';

  const checkout = standIn.openedFor.split('/').filter(Boolean).pop() ?? standIn.openedFor;

  if (standIn.openedForWorkPath) return `${checkout}, ${standIn.openedForWorkPath}`;

  return standIn.openedForBranch ? `${checkout}, on ${standIn.openedForBranch}` : checkout;
};

const describeStandIn = (options: { standIn: TimetrackStandIn; rules: readonly TimetrackAttributionRule[] }) => {
  const { standIn } = options;
  const days = Math.floor((Date.now() - standIn.createdAtMs) / DAY_MS);
  const project = standIn.projectKey ? ` in ${standIn.projectKey}` : '';
  const where = standInWhere(standIn);
  const held = wholeCheckoutHeld(options);
  const lines = [
    where ? `\n    ${where}` : '',
    held ? `\n    covers all of ${held}, so no branch of it gets one of its own` : '',
  ];

  return `${standIn.name}${project}  ${days}d old, ${standIn.days.length} day(s) of work${lines.join('')}`;
};

const HOUR_MS = 60 * 60_000;

const hours = (ms: number) => `${(ms / HOUR_MS).toFixed(1)}h`;

const DECLINE_LINES: Record<TimetrackNamingDecline['reason'], string> = {
  'already-named': 'a rule already names an issue for it',
  'named-by-stand-in': 'a rule names a placeholder for it, not an issue yet',
  'no-project-link': 'no project link covers it',
  'no-history': 'the project holds no Tempo worklog in the span',
  'project-too-small': 'the project holds too little time to read a habit from',
  'too-few-days': 'the leading issue spans too few days',
  'share-too-low': 'the leading issue holds too small a share of the project',
};

const describeDecline = (decline: TimetrackNamingDecline) => {
  const measured = decline.issueKey
    ? `  (${decline.issueKey} ${hours(decline.loggedMs ?? 0)} of ${hours(decline.projectMs ?? 0)}, ${Math.round((decline.share ?? 0) * 100)}%, ${decline.days ?? 0}d)`
    : '';

  return `${decline.repoPath} — ${DECLINE_LINES[decline.reason]}${measured}`;
};

const MINUTE_MS = 60_000;

const clock = (ms: number) => new Date(ms).toTimeString().slice(0, 5);

const rowLine = (row: TimetrackRow) =>
  [
    row.id,
    `${clock(row.fromMs)}-${clock(row.toMs)}`,
    `${Math.round(row.durationMs / MINUTE_MS)}m`,
    row.issueKey ?? row.standInId ?? 'unnamed',
    row.state,
    ...(row.edited ? ['edited'] : []),
    ...(row.hidden ? ['hidden'] : []),
    row.laneKey ?? 'no lane',
  ].join('  ');

const shiftDay = (day: string, days: number) => {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  const shifted = new Date(year, month - 1, date + days);

  return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}-${pad(shifted.getDate())}`;
};

const minutesOf = (ms: number) => Math.round(ms / MINUTE_MS);

const tempoDayLines = (worklogs: readonly TimetrackTempoWorklog[]) => {
  const days = new Map<string, Map<string, number>>();

  for (const worklog of worklogs) {
    const issues = days.get(worklog.day) ?? new Map<string, number>();
    const key = worklog.issueKey ?? `#${worklog.issueId}`;

    issues.set(key, (issues.get(key) ?? 0) + worklog.durationMs);
    days.set(worklog.day, issues);
  }

  return [...days]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([day, issues]) => {
      const total = [...issues.values()].reduce((sum, ms) => sum + ms, 0);
      const parts = [...issues]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([key, ms]) => `${key} ${minutesOf(ms)}m`);

      return `${day}  ${hours(total)}  ${parts.join('  ')}`;
    });
};

const syncWriteLine = (write: TimetrackTempoSync['writes'][number]) =>
  [
    write.kind.padEnd(6),
    write.issueKey ?? write.proposalId,
    `${clock(write.fromMs)}-${clock(write.fromMs + write.durationMs)}`,
    `${minutesOf(write.durationMs)}m`,
    write.reason,
    ...(write.tempoWorklogId ? [`worklog ${write.tempoWorklogId}`] : []),
    write.description || '(no description)',
    ...(write.blocked ? [`HELD BACK: ${write.blocked}`] : []),
  ].join('  ');

/** What a sync of a day would write, row by row, and what it leaves alone. */
const syncPlanLines = (plan: TimetrackTempoSync) => {
  const count = (kind: string) => plan.writes.filter((write) => write.kind === kind).length;
  const blocked = plan.writes.filter((write) => write.blocked).length;

  return [
    plan.writes.length
      ? `${plan.day}  plan ${plan.planHash}  ${count('create')} create, ${count('update')} update, ${count('delete')} delete`
      : `${plan.day}  nothing to write`,
    ...plan.writes.map((write) => `  ${syncWriteLine(write)}`),
    `${plan.unchanged} unchanged, ${plan.skipped} skipped (still awaiting review)`,
    ...(blocked ? [`${blocked} row(s) held back: Tempo would refuse them until they are fixed on the day.`] : []),
    ...(plan.unresolvedKeys.length
      ? [`Jira does not know ${plan.unresolvedKeys.join(', ')}, so nothing is written for those rows.`]
      : []),
    ...(plan.coveredMs
      ? [`${minutesOf(plan.coveredMs)}m of the day is already logged by foreign worklogs, so it is left out.`]
      : []),
    `Foreign worklogs (${plan.foreign.length}), never touched`,
    ...plan.foreign.map(
      (worklog) =>
        `  ${worklog.issueKey ?? `#${worklog.issueId}`}  ${clock(worklog.fromMs)}  ${minutesOf(worklog.durationMs)}m  ${worklog.description || '(no description)'}`,
    ),
  ];
};

/** Every row a write attempted, and what the user has to do about the ones that did not land. */
const syncRunLines = (run: NonNullable<TimetrackTempoSync['run']>) => [
  ...run.rows.map((row) =>
    [
      row.status.padEnd(7),
      row.kind.padEnd(6),
      row.issueKey ?? row.proposalId,
      ...(row.tempoWorklogId ? [`worklog ${row.tempoWorklogId}`] : []),
      ...(row.detail ? [row.detail] : []),
    ].join('  '),
  ),
  ...(run.retryCount
    ? [
        `${run.retryCount} row(s) did not land. Retry them on the Sync page, which retries this run's own plan: a new plan read straight after a write can miss what Tempo just took.`,
      ]
    : []),
  ...(run.unrecorded
    ? [
        `Written, but not recorded: ${run.unrecorded}. Tempo holds these worklogs and the app no longer owns them. Delete them in Tempo before writing this day again, or the time is logged twice.`,
      ]
    : []),
];

const meetingMs = (events: readonly TimetrackCalendarEvent[]) =>
  events
    .filter((event) => !event.allDay && event.response !== 'declined')
    .reduce((sum, event) => sum + event.endMs - event.startMs, 0);

const calendarEventLine = (event: TimetrackCalendarEvent) => {
  const start = new Date(event.startMs);
  const when = event.allDay
    ? 'all-day'
    : `${pad(start.getHours())}:${pad(start.getMinutes())} ${minutesOf(event.endMs - event.startMs)}m`;
  const answer = event.response === 'accepted' || event.response === 'organizer' ? [] : [event.response];

  return [when, event.title, ...answer].join('  ');
};

const calendarDayLines = (events: readonly TimetrackCalendarEvent[]) => {
  const days = new Map<string, TimetrackCalendarEvent[]>();

  for (const event of events) days.set(event.day, [...(days.get(event.day) ?? []), event]);

  return [...days]
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([day, dayEvents]) => [
      `${day}  ${dayEvents.length} event(s), ${hours(meetingMs(dayEvents))}`,
      ...dayEvents.map((event) => `  ${calendarEventLine(event)}`),
    ]);
};

/** Which edits the flags name. `--from` with `--to` is the one pair that names a single change. */
const namedEdits = (argv: string[]) => {
  const named = argv.includes('--from') || argv.includes('--to') ? ['--from/--to'] : [];

  return [
    ...named,
    ...['--issue', '--description', '--state', '--hide', '--show', '--reset'].filter((flag) => argv.includes(flag)),
  ];
};

/**
 * The one edit the flags state, or a refusal naming what they said instead.
 *
 * One edit per call, deliberately. A caller that means two changes to one row says so twice, and a
 * flag combination nobody meant can then never be read as a third thing.
 */
const editOf = (options: { argv: string[]; rowId: string }): TimetrackRowEdit => {
  const { argv, rowId } = options;
  const from = flagValue(argv, '--from');
  const to = flagValue(argv, '--to');
  const issueKey = flagValue(argv, '--issue');
  const description = flagValue(argv, '--description');
  const state = flagValue(argv, '--state');
  const named = namedEdits(argv);

  if (named.length > 1) {
    throw new Error(
      `One edit per call, and these name ${named.length}: ${named.join(', ')}. Run the command once for each.`,
    );
  }

  if (from && to) return { kind: 'range', rowId, fromMs: instantOf('--from', from), toMs: instantOf('--to', to) };
  if (from || to) throw new Error('Moving a row takes both --from and --to.');
  if (issueKey) return { kind: 'issue', rowId, issueKey: issueKey.toUpperCase() };
  if (description !== undefined) return { kind: 'description', rowId, description };

  if (state) {
    if (state !== 'accepted' && state !== 'rejected')
      throw new Error(`--state takes accepted or rejected, not ${state}.`);

    return { kind: 'state', rowId, state };
  }

  if (argv.includes('--hide')) return { kind: 'hidden', rowId, hidden: true };
  if (argv.includes('--show')) return { kind: 'hidden', rowId, hidden: false };
  if (argv.includes('--reset')) return { kind: 'reset', rowId };

  throw new Error('Pass one of --from with --to, --issue, --description, --state, --hide, --show or --reset.');
};

/**
 * Writes an export nobody but its owner can read.
 *
 * A day's events are the rawest personal record the app holds, and the recommended destination is a
 * shared temporary directory. The file therefore carries mode `0600` from the moment it exists, rather
 * than whatever the umask leaves. `lstatSync` reads the name itself, so a symlink somebody else planted
 * is refused rather than written through, and exclusive creation refuses one that arrives after the
 * check.
 */
const writeExport = (options: { path: string; data: string; overwrite: boolean }) => {
  const { path, data, overwrite } = options;
  const found = lstatSync(path, { throwIfNoEntry: false });

  if (found && !overwrite) {
    throw new Error(`${path} already exists. Pass --overwrite to replace it, or name another file.`);
  }

  if (found && !found.isFile()) throw new Error(`${path} is not a regular file, so it is not overwritten.`);
  if (found) unlinkSync(path);

  const handle = openSync(path, 'wx', 0o600);

  try {
    writeFileSync(handle, data);
  } finally {
    closeSync(handle);
  }
};

/** `--json` answers data, never a terminal-formatted line, so it is printed as it parses. */
const printed = (value: unknown, json: boolean) => {
  if (json) console.log(JSON.stringify(value, null, 2));

  return 0;
};

/** Every write waits in the app for the user's press, so what a write prints is where to look next. */
const queuedLines = (queued: TimetrackQueued, what: string) => [
  `Queued in Timetrack for the user's approval: ${what}.`,
  `Nothing is written until they approve it. Read the outcome with: timetrack approval ${queued.approvalId}`,
];

const printedQueued = (options: { queued: TimetrackQueued; what: string; json: boolean }) => {
  if (!options.json) queuedLines(options.queued, options.what).forEach(say);

  return printed(options.queued, options.json);
};

const isSyncWithRun = (value: unknown): value is TimetrackTempoSync & { run: NonNullable<TimetrackTempoSync['run']> } =>
  typeof value === 'object' && value !== null && 'run' in value && typeof value.run === 'object';

const UNDECIDED = {
  queued: "still waits for the user's approval in Timetrack.",
  rejected: 'the user rejected it. Nothing was written.',
  expired: 'expired at the end of the day it was asked on. Nothing was written. Ask again.',
};

const approvalLines = (found: TimetrackApprovalStatus) => {
  if (found.status !== 'approved') return [`${found.approvalId}  ${UNDECIDED[found.status]}`];
  if (found.error !== undefined) return [`${found.approvalId}  approved, but it failed: ${found.error}`];

  const unrecorded = unrecordedOf(found.result);

  return [
    `${found.approvalId}  approved and carried out.`,
    ...(isSyncWithRun(found.result) ? syncRunLines(found.result.run) : ['Pass --json for what it answered.']),
    ...(unrecorded && !isSyncWithRun(found.result)
      ? [`Carried out, but the app's ledger did not follow: ${unrecorded}. A later sync may undo it.`]
      : []),
  ];
};

const unrecordedOf = (value: unknown) =>
  typeof value === 'object' && value !== null && 'unrecorded' in value && typeof value.unrecorded === 'string'
    ? value.unrecorded
    : undefined;

/** Non-zero for anything that did not land in full, so a caller polling in a script can tell. */
const approvalExitCode = (found: TimetrackApprovalStatus) => {
  if (found.status === 'queued') return 0;
  if (found.status !== 'approved' || found.error !== undefined) return 1;
  if (unrecordedOf(found.result)) return 1;

  return isSyncWithRun(found.result) && (found.result.run.retryCount || found.result.run.unrecorded) ? 1 : 0;
};

/**
 * Cuts a placeholder that covered a whole checkout into one per directory its commits worked in.
 *
 * The directories are read here rather than in the app: a commit collected before Timetrack recorded
 * file paths carries none in the store, and that is every commit such a placeholder covers. Without
 * `--force` the plan is printed and nothing is written.
 */
const splitStandIn = async (options: { id: string; argv: string[]; json: boolean }) => {
  const { id, argv, json } = options;
  const standIn = (await timetrackStandIns()).find((entry) => entry.id === id);

  if (!standIn) {
    say(`Timetrack holds no stand-in ${id}.`);

    return 1;
  }

  const repoPath = flagValue(argv, '--repo');
  const checkout = standIn.openedFor ?? repoPath;

  if (!checkout) {
    say(`${id} names no checkout, so nothing says where its directories are. Name one with --repo <dir>.`);

    return 1;
  }

  const branch = flagValue(argv, '--branch') ?? currentBranch(checkout);
  const author = flagValue(argv, '--author') ?? commitAuthorOf(checkout);
  const commits = commitPathsOnDays({ root: checkout, days: standIn.days, ...(author ? { author } : {}) });

  if (!commits.length) {
    say(`No commit of ${checkout} falls on ${standIn.days.join(', ')}, so nothing says how to split it.`);

    return 1;
  }

  const paths = (flagValue(argv, '--paths') ?? '')
    .split(',')
    .map((path) => path.trim())
    .filter(Boolean);
  const claim = flagValue(argv, '--claim');
  const apply = argv.includes('--force');
  const projectRoots = projectRootsOf(checkout);
  const request = { id, branch, repoPath, commits, projectRoots, paths, claim };
  const answer = await timetrackSplitStandIn(request);

  if (!json) {
    say(`${standIn.name}  ${standIn.days.length} day(s), branch ${branch}`);
    say(`Directories the commits name (${answer.candidates.length})`);
    answer.candidates.forEach((piece) => say(`  ${piece.workPath}  ${piece.commits}c  ${piece.days.join(', ')}`));

    if (!answer.pieces.length) {
      say('None of them is an automatic grain. Pick the pieces with --paths <dir>,<dir>.');
    } else if (!apply) {
      say(`Would write ${answer.pieces.map((piece) => piece.workPath).join(', ')}. Pass --force to carry it out.`);
    }

    if (claim) {
      const covered = new Set(answer.pieces.flatMap((piece) => piece.days));
      const left = standIn.days.filter((day) => !covered.has(day));

      say(
        left.length
          ? `${claim} takes ${left.join(', ')}.`
          : `Every day already has a directory, so ${claim} takes none.`,
      );
    } else if (answer.remainder.length) {
      say(`No commit claims ${answer.remainder.join(', ')}, so those days go back to unnamed.`);
      say('Name them in the day review, or re-run with --claim <dir> to give them a directory.');
    }
  }

  if (apply && answer.pieces.length) {
    const queued = await timetrackApplyStandInSplit(request);

    return printedQueued({ queued, what: `split ${standIn.name} into ${answer.pieces.length}`, json });
  }

  return printed(answer, json);
};

const USAGE = `ethlete-agents timetrack — ask the running Timetrack app about Jira

The app holds this machine's Jira credentials, so no repository needs a token of its own.
Every write waits in the app until the user approves it there, and prints an approval id.

  timetrack status              Whether the app is reachable, and which projects it holds
  timetrack instance            The instance's own levels and its branch-subject candidates
  timetrack issue <KEY>         One issue: its summary, type, parent and branch subject
  timetrack search [text]       Open issues of the picked projects, most recently touched first
  timetrack project [path]      Which Jira project a repository logs into
  timetrack create --summary …  File a new issue with the instance's own ticket settings
  timetrack log --issue <KEY> --minutes <n>
                                Add a row nothing observed to the day it belongs to
  timetrack day [YYYY-MM-DD]    The evidence a day holds, which the encrypted store hides otherwise
  timetrack rows [YYYY-MM-DD]   The rows the day drew, with the ids an edit names them by
  timetrack edit <row-id> …     Change one row of a day: its times, its name, its note or its state
  timetrack rules               The rules that name a day's work: attribution, project links, apps
  timetrack standins            The names the user gave work Jira does not hold yet, and their age
  timetrack standins --remove <id>
                                Delete one placeholder, and the rule that named it
  timetrack standins --rename <id> --name <text>
                                Give one placeholder another name, keeping its days and its rules
  timetrack standins --merge <id> --into <id>
                                Fold one open placeholder into another, with its days and its rules
  timetrack standins --split <id> [--repo <dir>] [--paths <dir>,<dir>] [--claim <dir>] [--author <email>]
                                [--force]
                                Cut one that covered a whole checkout into one per directory
  timetrack worklogs [from] [to]
                                The account's own Tempo worklogs per day (default: the last 7 days)
  timetrack calendar [from] [to]
                                The watched calendars' events per day (default: the last 7 days)
  timetrack sync <YYYY-MM-DD>   What a Tempo sync of the day would write, as the Sync page plans it
  timetrack sync <YYYY-MM-DD> --write --plan <hash>
                                Write that plan to Tempo, once the user confirmed its rows
  timetrack worklog --delete <id> --day <YYYY-MM-DD>
                                Delete one of the account's own Tempo worklogs, once the user asked for it
  timetrack naming [YYYY-MM-DD] Which checkouts the day offers a name for, and why the rest do not
  timetrack resync [path…]      Read the agent session logs of checkouts again, after they got a link
  timetrack approval <id>       Where a queued write stands, and what it answered once approved

Options for search
  --project <KEY>     Search this project instead of the picked ones
  --mine              Only the issues assigned to the account
  --limit <n>         How many issues to read (default 100)

Options for create
  --summary <text>    Required
  --description <text>
  --project <KEY>     Required unless the app holds exactly one picked project
  --type <name>       Issue type by name (default: the app's configured type)
  --parent <KEY>      The story or epic it rolls up to
  --subject <text>    The branch subject, written to the instance's subject field

Options for log
  --issue <KEY>       Required
  --minutes <n>       Required
  --at <date>         When the work started (default: now)
  --description <text>

Options for day
  --out <path>        Write the raw answer to a new file, readable by you alone
  --overwrite         Replace the file --out names, which is refused otherwise

Options for resync
  --replace           Overwrite what the store holds for those sessions, after a parser fix

Options for sync
  --write             Queue the write of the plan. Refused without --plan; the app refuses it on
                      approval when the plan changed since
  --plan <hash>       The plan hash the read printed, for the rows the user confirmed

Options for edit — pass exactly one change
  --day <YYYY-MM-DD>  The day the row is on (default: today)
  --from <date> --to <date>
                      Move the row, or drag one of its ends
  --issue <KEY>       Name the row
  --description <text>
  --state <accepted|rejected>
  --hide              Take it off the timeline
  --show              Put it back
  --reset             Give the app's own row back

Options everywhere
  --json              Print the raw answer instead of lines
`;

/**
 * The agent-facing half of Timetrack: everything here is one call into the running app.
 *
 * Nothing in this file knows a Jira host or a token. That is the point — an agent working in any
 * repository asks the one process that holds them, so a machine has one secret to rotate rather than
 * one per checkout.
 */
export const timetrackCommand = async (options: { root: string; argv: string[] }) => {
  const { root, argv } = options;
  const [subcommand, value] = positionalArgs(argv);
  const json = argv.includes('--json');

  if (subcommand === 'status') {
    const status = await timetrackStatus();

    if (!json) {
      say(`Timetrack   ${timetrackDiscoveryPath()}`);
      say(`  jira      ${status.jiraReady ? 'configured' : 'not configured — set it in Timetrack Settings'}`);
      say(`  tempo     ${status.tempoReady ? 'configured' : 'not configured — no worklog history is read'}`);
      say(`  projects  ${status.projects.map((project) => project.key).join(', ') || '— none picked'}`);
      say(`  subject   ${status.subjectField || '— no field configured, the summary is used'}`);
    }

    return printed(status, json);
  }

  if (subcommand === 'instance') {
    const instance = await timetrackInstance();

    if (!json) {
      say('Levels, highest first');
      instance.levels.forEach((level) => say(`  ${level.hierarchyLevel}  ${level.typeNames.join(', ')}`));
      say(`A parent can be named by  ${instance.suggestedParenting}`);
      say(`Branch-subject candidates (${instance.subjectFieldCandidates.length})`);
      instance.subjectFieldCandidates.forEach((field) => say(`  ${field.id}  ${field.name}`));
    }

    return printed(instance, json);
  }

  if (subcommand === 'issue') {
    if (!value) throw new Error('Pass an issue key, e.g. `ethlete-agents timetrack issue FIP-2177`.');

    const issue = await timetrackIssue(value);

    if (!json) say(issueLine(issue));

    return printed(issue, json);
  }

  if (subcommand === 'search') {
    const issues = await timetrackSearch({
      text: value,
      projectKey: flagValue(argv, '--project'),
      assignedToMe: argv.includes('--mine'),
      limit: countFlag(argv, '--limit'),
    });

    if (!json) {
      if (issues.length === 0) say('No issue matches.');
      issues.forEach((issue) => say(issueLine(issue)));
    }

    return printed(issues, json);
  }

  if (subcommand === 'project') {
    const found = await timetrackRepoProject(resolve(root, value ?? '.'));

    if (!json) {
      const where = found.inherited ? ' (from a directory above it)' : '';

      if (found.private) say(`${found.repoPath} is marked private — work there is logged nowhere${where}.`);
      else if (found.projectKey) say(`${found.repoPath} logs into ${found.projectKey}${where}.`);
      else if (found.suggestedProjectKey) {
        say(`${found.repoPath} is linked to nothing. Its name suggests ${found.suggestedProjectKey}.`);
      } else say(`${found.repoPath} is linked to no project. Link it in Timetrack Settings.`);
    }

    return printed(found, json);
  }

  if (subcommand === 'create') {
    const summary = flagValue(argv, '--summary');

    if (!summary) throw new Error('Pass --summary "…".');

    const queued = await timetrackCreateIssue({
      summary,
      description: flagValue(argv, '--description'),
      projectKey: flagValue(argv, '--project'),
      issueTypeName: flagValue(argv, '--type'),
      parentKey: flagValue(argv, '--parent'),
      subject: flagValue(argv, '--subject'),
    });

    return printedQueued({ queued, what: `file the issue ${summary}`, json });
  }

  if (subcommand === 'log') {
    const issueKey = flagValue(argv, '--issue');
    const minutes = numberFlag(argv, '--minutes');

    if (!issueKey) throw new Error('Pass --issue <KEY>.');
    if (!minutes || minutes <= 0) throw new Error('Pass --minutes <n> above zero.');

    const queued = await timetrackAddWorklog({
      issueKey,
      description: flagValue(argv, '--description'),
      fromMs: instantFlag(argv),
      durationMs: Math.round(minutes * 60_000),
    });

    if (!json) say('Once approved it is a row on the day, not a Tempo entry — the day still needs a sync.');

    return printedQueued({ queued, what: `a ${minutes}m row for ${issueKey}`, json });
  }

  if (subcommand === 'day') {
    const day = value ?? today();

    if (!DAY.test(day)) throw new Error(`Pass a day as YYYY-MM-DD, not ${day}.`);

    const found = await timetrackDayEvents(day);
    const outFlag = flagValue(argv, '--out');

    if (outFlag) {
      const out = resolve(root, outFlag);

      writeExport({ path: out, data: JSON.stringify(found), overwrite: argv.includes('--overwrite') });

      if (json) return printed({ day: found.day, events: found.events.length, out }, json);

      say(`${found.day}  ${found.events.length} events written to ${out}, readable by you alone`);
      say('It holds the day as it was observed: window titles, paths and messages. Delete it when you are done.');

      return 0;
    }

    if (!json) {
      say(`${found.day}  ${found.events.length} events`);
      countByKind(found.events).forEach(([kind, count]) => say(`  ${kind}  ${count}`));
      say('Pass --out <path> to write the events themselves, which are far too many to read.');
    }

    return printed(found, json);
  }

  if (subcommand === 'rows') {
    const day = value ?? today();

    if (!DAY.test(day)) throw new Error(`Pass a day as YYYY-MM-DD, not ${day}.`);

    const found = await timetrackDayRows(day);

    if (!json) {
      say(`${found.day}  ${hours(found.loggedMs)} logged of a ${hours(found.targetMs)} target`);
      found.rows.forEach((row) => say(`  ${rowLine(row)}`));
      found.hidden.forEach((row) => say(`  ${rowLine(row)}`));
      found.warnings.forEach((warning) => say(`  ! ${warning.kind}: ${warning.detail}`));
    }

    return printed(found, json);
  }

  if (subcommand === 'edit') {
    const day = flagValue(argv, '--day') ?? today();

    if (!value) throw new Error('Pass the row id to edit, as `timetrack rows` prints it.');
    if (!DAY.test(day)) throw new Error(`Pass a day as YYYY-MM-DD, not ${day}.`);

    const queued = await timetrackEditDay({ day, edits: [editOf({ argv, rowId: value })] });

    return printedQueued({ queued, what: `an edit of row ${value} on ${day}`, json });
  }

  if (subcommand === 'rules') {
    const rules = await timetrackRules();

    if (!json) {
      say(`target ${Math.round(rules.dayTargetMs / 60_000)}m  day starts at ${rules.dayStartHour}:00`);
      say(`${rules.attributionRules.length} attribution rule(s)`);
      rules.attributionRules.forEach((rule) => say(`  ${describeRule(rule)}`));
      say(`${rules.projectLinks.length} project link(s)`);
      rules.projectLinks.forEach((link) =>
        say(`  ${link.path} → ${link.private ? 'private' : (link.projectKey ?? 'no project')}`),
      );
    }

    return printed(rules, json);
  }

  if (subcommand === 'resync') {
    const named = positionalArgs(argv).slice(1);
    const paths = (named.length ? named : ['.']).map((path) => resolve(root, path));
    const replace = argv.includes('--replace');
    const queued = await timetrackResyncAgentSessions(paths, { replace });
    const how = replace ? ', replacing what it stored for them' : '';

    return printedQueued({ queued, what: `read the agent sessions of ${paths.join(', ')} again${how}`, json });
  }

  if (subcommand === 'worklogs') {
    const to = positionalArgs(argv)[2] ?? today();
    const from = value ?? shiftDay(to, -6);

    if (!DAY.test(from)) throw new Error(`Pass a day as YYYY-MM-DD, not ${from}.`);
    if (!DAY.test(to)) throw new Error(`Pass a day as YYYY-MM-DD, not ${to}.`);

    const found = await timetrackTempoWorklogs({ from, to });

    if (!json) {
      const total = found.worklogs.reduce((sum, worklog) => sum + worklog.durationMs, 0);

      say(`${found.from} … ${found.to}  ${found.worklogs.length} worklog(s), ${hours(total)}`);
      tempoDayLines(found.worklogs).forEach((line) => say(`  ${line}`));
    }

    return printed(found, json);
  }

  if (subcommand === 'worklog') {
    if (argv.includes('--help')) {
      say(USAGE);

      return 0;
    }

    const worklogId = flagValue(argv, '--delete');
    const day = flagValue(argv, '--day');

    if (!worklogId || !/^\d+$/.test(worklogId))
      throw new Error('Pass the Tempo worklog id to delete with --delete <id>.');
    if (!day || !DAY.test(day)) throw new Error('Pass the day the worklog is on with --day <YYYY-MM-DD>.');

    const queued = await timetrackTempoDelete({ day, worklogId });

    return printedQueued({ queued, what: `delete Tempo worklog ${worklogId} on ${day}`, json });
  }

  if (subcommand === 'sync') {
    if (!value || !DAY.test(value)) throw new Error('Pass the day to sync as YYYY-MM-DD.');

    const planHash = flagValue(argv, '--plan');
    const write = argv.includes('--write');

    if (write && !planHash) {
      say(`A write names the plan the user confirmed. Read it with \`timetrack sync ${value}\`, show the rows,`);
      say('and pass the hash it prints with --plan once they agree.');

      return 1;
    }

    if (planHash && !write) {
      say('--plan only means something with --write. Nothing was written.');

      return 1;
    }

    if (write && planHash) {
      const queued = await timetrackTempoSyncWrite({ day: value, planHash });

      if (!json) say('The app checks the plan again on approval, and refuses it if the day changed since.');

      return printedQueued({ queued, what: `write plan ${planHash} of ${value} to Tempo`, json });
    }

    const found = await timetrackTempoSync(value);

    if (!json) {
      syncPlanLines(found).forEach(say);

      if (found.writes.length) {
        say(`Once the user has confirmed these rows: timetrack sync ${found.day} --write --plan ${found.planHash}`);
      }
    }

    return printed(found, json);
  }

  if (subcommand === 'calendar') {
    const to = positionalArgs(argv)[2] ?? today();
    const from = value ?? shiftDay(to, -6);

    if (!DAY.test(from)) throw new Error(`Pass a day as YYYY-MM-DD, not ${from}.`);
    if (!DAY.test(to)) throw new Error(`Pass a day as YYYY-MM-DD, not ${to}.`);

    const found = await timetrackCalendarEvents({ from, to });

    if (!json) {
      say(
        `${found.from} … ${found.to}  ${found.events.length} event(s) from ${found.calendarIds.length} calendar(s), ${hours(meetingMs(found.events))} in meetings`,
      );
      calendarDayLines(found.events).forEach((line) => say(`  ${line}`));
    }

    return printed(found, json);
  }

  if (subcommand === 'naming') {
    const day = value ?? today();

    if (!DAY.test(day)) throw new Error(`Pass a day as YYYY-MM-DD, not ${day}.`);

    const naming = await timetrackNaming(day);

    if (!json) {
      say(`${day}   tempo ${naming.tempoReady ? 'configured' : 'not configured'}`);
      say(`History   ${naming.history}, ${naming.historyWorklogs} worklog(s) in the span`);
      if (naming.historyMessage) say(`          ${naming.historyMessage}`);
      say(`Offered (${naming.offers.length})`);
      naming.offers.forEach((offer) =>
        say(
          `  ${offer.repoPath} → ${offer.issueKey}  ${hours(offer.loggedMs)}, ${Math.round(offer.share * 100)}%, ${offer.days}d`,
        ),
      );
      say(`Not offered (${naming.declines.length})`);
      naming.declines.forEach((decline) => say(`  ${describeDecline(decline)}`));
    }

    return printed(naming, json);
  }

  if (subcommand === 'approval') {
    if (!value) throw new Error('Pass the approval id a write printed, e.g. `timetrack approval <id>`.');

    const found = await timetrackApprovalStatus(value);

    if (!json) approvalLines(found).forEach(say);

    printed(found, json);

    return approvalExitCode(found);
  }

  if (subcommand === 'standins') {
    const split = flagValue(argv, '--split');

    if (split) return await splitStandIn({ id: split, argv, json });

    const rename = flagValue(argv, '--rename');
    const name = flagValue(argv, '--name');

    if (rename && !name) {
      say(`A rename needs the new name. Pass --name <text> with --rename ${rename}.`);

      return 1;
    }

    if (rename && name) {
      const queued = await timetrackRenameStandIn({ id: rename, name });

      return printedQueued({ queued, what: `rename ${rename} to ${name}`, json });
    }

    const merge = flagValue(argv, '--merge');
    const into = flagValue(argv, '--into');

    if (merge && !into) {
      say(`A merge needs the placeholder it goes into. Pass --into <id> with --merge ${merge}.`);

      return 1;
    }

    if (merge && into) {
      const queued = await timetrackMergeStandIn({ id: merge, into });

      return printedQueued({ queued, what: `merge ${merge} into ${into}`, json });
    }

    const remove = flagValue(argv, '--remove');
    const stranded = remove ? await strandedDays(remove) : [];

    if (stranded.length && !argv.includes('--force')) {
      say(`${remove} holds ${stranded.length} day(s) before today: ${stranded.join(', ')}.`);
      say('Deleting it takes the rule with it, so those days read as unnamed and nothing reopens them.');
      say('The app reopens a placeholder for today only. Pass --force if that is what you want.');

      return 1;
    }

    if (remove) {
      const queued = await timetrackRemoveStandIn(remove);

      return printedQueued({ queued, what: `delete ${remove} and the rule that named it`, json });
    }

    const standIns = await timetrackStandIns();
    const rules = json ? [] : (await timetrackRules()).attributionRules;
    const open = standIns
      .filter((standIn) => standIn.state === 'open')
      .sort((left, right) => left.createdAtMs - right.createdAtMs);

    if (!json) {
      say(`${open.length} open, ${standIns.length - open.length} resolved`);
      open.forEach((standIn) => say(`  ${describeStandIn({ standIn, rules })}`));
      if (open.length) say('Only the app opens or resolves one — you may delete one, not write one.');
    }

    return printed(standIns, json);
  }

  say(USAGE);

  return subcommand === undefined || subcommand === '--help' || subcommand === '-h' ? 0 : 1;
};
