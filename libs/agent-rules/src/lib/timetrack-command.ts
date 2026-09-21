import { closeSync, lstatSync, openSync, unlinkSync, writeSync } from 'fs';
import {
  TimetrackAttributionRule,
  TimetrackIssue,
  TimetrackNamingDecline,
  TimetrackStandIn,
  timetrackAddWorklog,
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
  timetrackSplitStandIn,
  timetrackStandIns,
  timetrackStatus,
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
];

/** Every human-readable line, with anything a terminal would act on printed rather than obeyed. */
const say = (line: string) => console.log(plain(line));

const positionalArgs = (args: string[]) =>
  args.filter((entry, index) => !entry.startsWith('--') && !FLAGS_WITH_VALUE.includes(args[index - 1] ?? ''));

const flagValue = (args: string[], flag: string) => {
  const index = args.indexOf(flag);

  return index === -1 ? undefined : args[index + 1];
};

const numberFlag = (args: string[], flag: string) => {
  const raw = flagValue(args, flag);

  if (raw === undefined) return undefined;

  const value = Number(raw);

  if (!Number.isFinite(value)) throw new Error(`${flag} takes a number, not ${raw}.`);

  return value;
};

/** `--at` takes anything `Date` reads, so an agent may pass an ISO instant or leave it out for now. */
const instantFlag = (args: string[]) => {
  const raw = flagValue(args, '--at');

  if (!raw) return Date.now();

  const at = new Date(raw);

  if (Number.isNaN(at.getTime())) throw new Error(`--at takes a date, not ${raw}.`);

  return at.getTime();
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

const describeStandIn = (options: { standIn: TimetrackStandIn; rules: readonly TimetrackAttributionRule[] }) => {
  const { standIn } = options;
  const days = Math.floor((Date.now() - standIn.createdAtMs) / DAY_MS);
  const where = standIn.projectKey ? ` in ${standIn.projectKey}` : '';
  const held = wholeCheckoutHeld(options);
  const grain = held ? `\n    covers all of ${held}, so no branch of it gets one of its own` : '';

  return `${standIn.name}${where}  ${days}d old, ${standIn.days.length} day(s) of work${grain}`;
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

/** `--from` and `--to` take anything `Date` reads, so a caller may pass an ISO instant or a clock. */
const instantOf = (flag: string, raw: string) => {
  const at = new Date(raw);

  if (Number.isNaN(at.getTime())) throw new Error(`${flag} takes a date, not ${raw}.`);

  return at.getTime();
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
    writeSync(handle, data);
  } finally {
    closeSync(handle);
  }
};

/** `--json` answers data, never a terminal-formatted line, so it is printed as it parses. */
const printed = (value: unknown, json: boolean) => {
  if (json) console.log(JSON.stringify(value, null, 2));

  return 0;
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
  const answer = await timetrackSplitStandIn({
    id,
    branch,
    repoPath,
    commits,
    projectRoots,
    paths,
    claim,
    apply,
  });

  if (!json) {
    say(`${standIn.name}  ${standIn.days.length} day(s), branch ${branch}`);
    say(`Directories the commits name (${answer.candidates.length})`);
    answer.candidates.forEach((piece) => say(`  ${piece.workPath}  ${piece.commits}c  ${piece.days.join(', ')}`));

    if (!answer.pieces.length) {
      say('None of them is an automatic grain. Pick the pieces with --paths <dir>,<dir>.');
    } else if (apply) {
      say(`Split into ${answer.pieces.length}, and the rule that named it rewritten one per directory.`);
    } else {
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
    }
  }

  return printed(answer, json);
};

const USAGE = `ethlete-agents timetrack — ask the running Timetrack app about Jira

The app holds this machine's Jira credentials, so no repository needs a token of its own.

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
  timetrack standins --split <id> [--repo <dir>] [--paths <dir>,<dir>] [--claim <dir>] [--author <email>]
                                [--force]
                                Cut one that covered a whole checkout into one per directory
  timetrack naming [YYYY-MM-DD] Which checkouts the day offers a name for, and why the rest do not

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
      limit: numberFlag(argv, '--limit'),
    });

    if (!json) {
      if (issues.length === 0) say('No issue matches.');
      issues.forEach((issue) => say(issueLine(issue)));
    }

    return printed(issues, json);
  }

  if (subcommand === 'project') {
    const found = await timetrackRepoProject(value ?? root);

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

    const issue = await timetrackCreateIssue({
      summary,
      description: flagValue(argv, '--description'),
      projectKey: flagValue(argv, '--project'),
      issueTypeName: flagValue(argv, '--type'),
      parentKey: flagValue(argv, '--parent'),
      subject: flagValue(argv, '--subject'),
    });

    if (!json) say(`${issue.key}  ${summary}`);

    return printed(issue, json);
  }

  if (subcommand === 'log') {
    const issueKey = flagValue(argv, '--issue');
    const minutes = numberFlag(argv, '--minutes');

    if (!issueKey) throw new Error('Pass --issue <KEY>.');
    if (!minutes || minutes <= 0) throw new Error('Pass --minutes <n> above zero.');

    const worklog = await timetrackAddWorklog({
      issueKey,
      description: flagValue(argv, '--description'),
      fromMs: instantFlag(argv),
      durationMs: Math.round(minutes * 60_000),
    });

    if (!json) {
      say(`${worklog.issueKey}  ${minutes}m on ${worklog.day}`);
      say('It is a row on the day, not a Tempo entry — review the day in Timetrack, then sync it.');
    }

    return printed(worklog, json);
  }

  if (subcommand === 'day') {
    const day = value ?? today();

    if (!DAY.test(day)) throw new Error(`Pass a day as YYYY-MM-DD, not ${day}.`);

    const found = await timetrackDayEvents(day);
    const out = flagValue(argv, '--out');

    if (out) {
      writeExport({ path: out, data: JSON.stringify(found), overwrite: argv.includes('--overwrite') });
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

    const edited = await timetrackEditDay({ day, edits: [editOf({ argv, rowId: value })] });

    if (!json) {
      say(`${edited.day}  ${edited.applied} of 1 edit landed`);
      edited.rows.forEach((row) => say(`  ${rowLine(row)}`));
      edited.warnings.forEach((warning) => say(`  ! ${warning.kind}: ${warning.detail}`));
    }

    return printed(edited, json);
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

  if (subcommand === 'naming') {
    const day = value && DAY.test(value) ? value : today();
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

  if (subcommand === 'standins') {
    const split = flagValue(argv, '--split');

    if (split) return await splitStandIn({ id: split, argv, json });

    const remove = flagValue(argv, '--remove');
    const stranded = remove ? await strandedDays(remove) : [];

    if (stranded.length && !argv.includes('--force')) {
      say(`${remove} holds ${stranded.length} day(s) before today: ${stranded.join(', ')}.`);
      say('Deleting it takes the rule with it, so those days read as unnamed and nothing reopens them.');
      say('The app reopens a placeholder for today only. Pass --force if that is what you want.');

      return 1;
    }

    const standIns = remove ? await timetrackRemoveStandIn(remove) : await timetrackStandIns();
    const rules = json ? [] : (await timetrackRules()).attributionRules;
    const open = standIns
      .filter((standIn) => standIn.state === 'open')
      .sort((left, right) => left.createdAtMs - right.createdAtMs);

    if (!json) {
      if (remove) say(`Deleted ${remove}, and the rule that named it.`);
      say(`${open.length} open, ${standIns.length - open.length} resolved`);
      open.forEach((standIn) => say(`  ${describeStandIn({ standIn, rules })}`));
      if (open.length) say('Only the app opens or resolves one — you may delete one, not write one.');
    }

    return printed(standIns, json);
  }

  say(USAGE);

  return subcommand === undefined || subcommand === '--help' || subcommand === '-h' ? 0 : 1;
};
