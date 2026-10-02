#!/usr/bin/env node
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { CommandArgs, parseCommandArgs } from './lib/cli-args';
import { AGENT_TARGETS, CONFIG_FILE_NAME, detectTargets, resolveRepoRoot } from './lib/config';
import { gitFlowCommand } from './lib/git-flow-command';
import { loadDefaultVars } from './lib/load-content';
import { migrate } from './lib/migrate';
import { outputStyleCommand } from './lib/output-style-command';
import { detectCommandVars } from './lib/package-runner';
import { plain } from './lib/plain-text';
import { check, sync } from './lib/sync';
import { timetrackCommand } from './lib/timetrack-command';

const USAGE = `ethlete-agents — compile @ethlete agent rules and skills into your repo

  ethlete-agents sync      Write the generated rules/skills for every detected agent
  ethlete-agents check     Exit non-zero when the generated files are out of date (for CI)
  ethlete-agents init      Write a starter ${CONFIG_FILE_NAME}
  ethlete-agents git-flow  Name, check and repair branches against the repo's git flow
                           (start, check, repair, explain)
  ethlete-agents output-style
                           Install an Ethlete output style into this machine's Claude Code
                           config and switch to it (Claude Code only)
  ethlete-agents timetrack Ask the running Timetrack app about Jira - it holds this
                           machine's credentials, so no repo needs a token
                           (status, instance, issue, search, project, create, log)
  ethlete-agents migrate   Convert the repo to the AGENTS.md + .agents/skills layout:
                           CLAUDE.md content moves into AGENTS.md (CLAUDE.md becomes an
                           @AGENTS.md import), hand-written .claude/skills move to
                           .agents/skills with symlinks left behind, then a sync runs

Options
  --targets <list>   Comma-separated subset of: ${AGENT_TARGETS.join(', ')}
  --root <path>      Repo root to write into (default: the nearest directory holding
                     ${CONFIG_FILE_NAME}, else the current directory)
  --dry-run          Print what would change without writing (sync and migrate)
`;

const readFlag = (args: string[], flag: string) => {
  const index = args.indexOf(flag);

  if (index === -1) return undefined;

  return args[index + 1];
};

const INIT_VARS = ['lintCommand', 'lintFixCommand', 'formatCommand', 'storybookStartCommand', 'storybookUrl'];

const init = (root: string) => {
  const path = join(root, CONFIG_FILE_NAME);

  if (existsSync(path)) {
    console.error(`${CONFIG_FILE_NAME} already exists.`);

    return 1;
  }

  const defaults = loadDefaultVars();
  const detected = detectCommandVars(root);
  const vars = Object.fromEntries(
    INIT_VARS.map((name) => [name, detected[name] ?? defaults[name]]).filter(([, value]) => value),
  );
  const template = {
    targets: detectTargets(root),
    vars,
    exclude: [],
    hooks: [],
  };

  writeFileSync(path, `${JSON.stringify(template, null, 2)}\n`, 'utf8');
  console.log(
    `Wrote ${CONFIG_FILE_NAME}. Check the commands in "vars" (${Object.keys(vars).join(', ')}) against your repo, then run \`ethlete-agents sync\`.`,
  );

  return 0;
};

const STRICT_COMMANDS = ['sync', 'check', 'init', 'migrate'];

const runStrict = (command: string, args: CommandArgs) => {
  const root = args.root ?? resolveRepoRoot(process.cwd());
  const options = { root, targets: args.targets };

  switch (command) {
    case 'sync':
      return sync({ ...options, dryRun: args.dryRun });
    case 'check':
      return check(options);
    case 'init':
      return init(args.root ?? process.cwd());
    default:
      return migrate({ ...options, dryRun: args.dryRun });
  }
};

const run = (argv: string[]): number | Promise<number> => {
  const command = argv[0];

  if (command !== undefined && STRICT_COMMANDS.includes(command)) {
    const args = parseCommandArgs(command, argv.slice(1));

    if (args.problems.length) {
      console.error(`${args.problems.join('\n')}\n\n${USAGE}`);

      return 1;
    }

    if (args.help) {
      console.log(USAGE);

      return 0;
    }

    return runStrict(command, args);
  }

  const root = readFlag(argv, '--root') ?? resolveRepoRoot(process.cwd());

  switch (command) {
    case 'git-flow':
      return gitFlowCommand({ root, argv: argv.slice(1) });
    case 'output-style':
      return outputStyleCommand({ argv: argv.slice(1) });
    case 'timetrack':
      return timetrackCommand({ root, argv: argv.slice(1) });
    default:
      console.log(USAGE);

      return command === undefined || command === '--help' || command === '-h' ? 0 : 1;
  }
};

export * from './lib';

// Guarded so the package can also be imported as a library without running the CLI.
if (require.main === module) {
  Promise.resolve()
    .then(() => run(process.argv.slice(2)))
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      console.error(plain(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    });
}
