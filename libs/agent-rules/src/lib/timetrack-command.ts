import { writeFileSync } from 'fs';
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
  timetrackStandIns,
  timetrackStatus,
} from './timetrack';

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
];

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

const describeStandIn = (standIn: TimetrackStandIn) => {
  const days = Math.floor((Date.now() - standIn.createdAtMs) / DAY_MS);
  const where = standIn.projectKey ? ` in ${standIn.projectKey}` : '';

  return `${standIn.name}${where}  ${days}d old, ${standIn.days.length} day(s) of work`;
};

const HOUR_MS = 60 * 60_000;

const hours = (ms: number) => `${(ms / HOUR_MS).toFixed(1)}h`;

const DECLINE_LINES: Record<TimetrackNamingDecline['reason'], string> = {
  'already-named': 'a rule already names an issue for it',
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

const printed = (value: unknown, json: boolean) => {
  if (json) console.log(JSON.stringify(value, null, 2));

  return 0;
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
  --out <path>        Write the raw answer to a file, and print how many events it holds

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
      console.log(`Timetrack   ${timetrackDiscoveryPath()}`);
      console.log(`  jira      ${status.jiraReady ? 'configured' : 'not configured — set it in Timetrack Settings'}`);
      console.log(`  tempo     ${status.tempoReady ? 'configured' : 'not configured — no worklog history is read'}`);
      console.log(`  projects  ${status.projects.map((project) => project.key).join(', ') || '— none picked'}`);
      console.log(`  subject   ${status.subjectField || '— no field configured, the summary is used'}`);
    }

    return printed(status, json);
  }

  if (subcommand === 'instance') {
    const instance = await timetrackInstance();

    if (!json) {
      console.log('Levels, highest first');
      instance.levels.forEach((level) => console.log(`  ${level.hierarchyLevel}  ${level.typeNames.join(', ')}`));
      console.log(`A parent can be named by  ${instance.suggestedParenting}`);
      console.log(`Branch-subject candidates (${instance.subjectFieldCandidates.length})`);
      instance.subjectFieldCandidates.forEach((field) => console.log(`  ${field.id}  ${field.name}`));
    }

    return printed(instance, json);
  }

  if (subcommand === 'issue') {
    if (!value) throw new Error('Pass an issue key, e.g. `ethlete-agents timetrack issue FIP-2177`.');

    const issue = await timetrackIssue(value);

    if (!json) console.log(issueLine(issue));

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
      if (issues.length === 0) console.log('No issue matches.');
      issues.forEach((issue) => console.log(issueLine(issue)));
    }

    return printed(issues, json);
  }

  if (subcommand === 'project') {
    const found = await timetrackRepoProject(value ?? root);

    if (!json) {
      const where = found.inherited ? ' (from a directory above it)' : '';

      if (found.private) console.log(`${found.repoPath} is marked private — work there is logged nowhere${where}.`);
      else if (found.projectKey) console.log(`${found.repoPath} logs into ${found.projectKey}${where}.`);
      else if (found.suggestedProjectKey) {
        console.log(`${found.repoPath} is linked to nothing. Its name suggests ${found.suggestedProjectKey}.`);
      } else console.log(`${found.repoPath} is linked to no project. Link it in Timetrack Settings.`);
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

    if (!json) console.log(`${issue.key}  ${summary}`);

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
      console.log(`${worklog.issueKey}  ${minutes}m on ${worklog.day}`);
      console.log('It is a row on the day, not a Tempo entry — review the day in Timetrack, then sync it.');
    }

    return printed(worklog, json);
  }

  if (subcommand === 'day') {
    const day = value ?? today();

    if (!DAY.test(day)) throw new Error(`Pass a day as YYYY-MM-DD, not ${day}.`);

    const found = await timetrackDayEvents(day);
    const out = flagValue(argv, '--out');

    if (out) {
      writeFileSync(out, JSON.stringify(found));
      console.log(`${found.day}  ${found.events.length} events written to ${out}`);

      return 0;
    }

    if (!json) {
      console.log(`${found.day}  ${found.events.length} events`);
      countByKind(found.events).forEach(([kind, count]) => console.log(`  ${kind}  ${count}`));
      console.log('Pass --out <path> to write the events themselves, which are far too many to read.');
    }

    return printed(found, json);
  }

  if (subcommand === 'rows') {
    const day = value ?? today();

    if (!DAY.test(day)) throw new Error(`Pass a day as YYYY-MM-DD, not ${day}.`);

    const found = await timetrackDayRows(day);

    if (!json) {
      console.log(`${found.day}  ${hours(found.loggedMs)} logged of a ${hours(found.targetMs)} target`);
      found.rows.forEach((row) => console.log(`  ${rowLine(row)}`));
      found.hidden.forEach((row) => console.log(`  ${rowLine(row)}`));
      found.warnings.forEach((warning) => console.log(`  ! ${warning.kind}: ${warning.detail}`));
    }

    return printed(found, json);
  }

  if (subcommand === 'edit') {
    const day = flagValue(argv, '--day') ?? today();

    if (!value) throw new Error('Pass the row id to edit, as `timetrack rows` prints it.');
    if (!DAY.test(day)) throw new Error(`Pass a day as YYYY-MM-DD, not ${day}.`);

    const edited = await timetrackEditDay({ day, edits: [editOf({ argv, rowId: value })] });

    if (!json) {
      console.log(`${edited.day}  ${edited.applied} of 1 edit landed`);
      edited.rows.forEach((row) => console.log(`  ${rowLine(row)}`));
      edited.warnings.forEach((warning) => console.log(`  ! ${warning.kind}: ${warning.detail}`));
    }

    return printed(edited, json);
  }

  if (subcommand === 'rules') {
    const rules = await timetrackRules();

    if (!json) {
      console.log(`target ${Math.round(rules.dayTargetMs / 60_000)}m  day starts at ${rules.dayStartHour}:00`);
      console.log(`${rules.attributionRules.length} attribution rule(s)`);
      rules.attributionRules.forEach((rule) => console.log(`  ${describeRule(rule)}`));
      console.log(`${rules.projectLinks.length} project link(s)`);
      rules.projectLinks.forEach((link) =>
        console.log(`  ${link.path} → ${link.private ? 'private' : (link.projectKey ?? 'no project')}`),
      );
    }

    return printed(rules, json);
  }

  if (subcommand === 'naming') {
    const day = value && DAY.test(value) ? value : today();
    const naming = await timetrackNaming(day);

    if (!json) {
      console.log(`${day}   tempo ${naming.tempoReady ? 'configured' : 'not configured'}`);
      console.log(`History   ${naming.history}, ${naming.historyWorklogs} worklog(s) in the span`);
      if (naming.historyMessage) console.log(`          ${naming.historyMessage}`);
      console.log(`Offered (${naming.offers.length})`);
      naming.offers.forEach((offer) =>
        console.log(
          `  ${offer.repoPath} → ${offer.issueKey}  ${hours(offer.loggedMs)}, ${Math.round(offer.share * 100)}%, ${offer.days}d`,
        ),
      );
      console.log(`Not offered (${naming.declines.length})`);
      naming.declines.forEach((decline) => console.log(`  ${describeDecline(decline)}`));
    }

    return printed(naming, json);
  }

  if (subcommand === 'standins') {
    const standIns = await timetrackStandIns();
    const open = standIns
      .filter((standIn) => standIn.state === 'open')
      .sort((left, right) => left.createdAtMs - right.createdAtMs);

    if (!json) {
      console.log(`${open.length} open, ${standIns.length - open.length} resolved`);
      open.forEach((standIn) => console.log(`  ${describeStandIn(standIn)}`));
      if (open.length) console.log('Only the app opens or resolves one — report them, do not write one.');
    }

    return printed(standIns, json);
  }

  console.log(USAGE);

  return subcommand === undefined || subcommand === '--help' || subcommand === '-h' ? 0 : 1;
};
