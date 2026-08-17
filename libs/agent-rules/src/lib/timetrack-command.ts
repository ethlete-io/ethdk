import {
  TimetrackIssue,
  timetrackAddWorklog,
  timetrackCreateIssue,
  timetrackDiscoveryPath,
  timetrackInstance,
  timetrackIssue,
  timetrackRepoProject,
  timetrackSearch,
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

  console.log(USAGE);

  return subcommand === undefined || subcommand === '--help' || subcommand === '-h' ? 0 : 1;
};
