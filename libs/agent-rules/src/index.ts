#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { AGENT_TARGETS, AgentTarget, CONFIG_FILE_NAME, detectTargets } from './lib/config';
import { migrate } from './lib/migrate';
import { check, sync } from './lib/sync';

const USAGE = `ethlete-agents — compile @ethlete agent rules and skills into your repo

  ethlete-agents sync      Write the generated rules/skills for every detected agent
  ethlete-agents check     Exit non-zero when the generated files are out of date (for CI)
  ethlete-agents init      Write a starter ${CONFIG_FILE_NAME}
  ethlete-agents migrate   Convert the repo to the AGENTS.md + .agents/skills layout:
                           CLAUDE.md content moves into AGENTS.md (CLAUDE.md becomes an
                           @AGENTS.md import), hand-written .claude/skills move to
                           .agents/skills with symlinks left behind, then a sync runs

Options
  --targets <list>   Comma-separated subset of: ${AGENT_TARGETS.join(', ')}
  --root <path>      Repo root to write into (default: current directory)
  --dry-run          Print what would change without writing (sync and migrate)
`;

const readFlag = (args: string[], flag: string) => {
  const index = args.indexOf(flag);

  if (index === -1) return undefined;

  return args[index + 1];
};

const parseTargets = (args: string[]) => {
  const raw = readFlag(args, '--targets');

  if (!raw) return undefined;

  return raw.split(',').map((entry) => entry.trim()) as AgentTarget[];
};

const readVersion = () => {
  const manifest = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as { version: string };

  return manifest.version;
};

const init = (root: string) => {
  const path = join(root, CONFIG_FILE_NAME);

  if (existsSync(path)) {
    console.error(`${CONFIG_FILE_NAME} already exists.`);

    return 1;
  }

  const template = {
    targets: detectTargets(root),
    vars: {},
    exclude: [],
    hooks: [],
  };

  writeFileSync(path, `${JSON.stringify(template, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${CONFIG_FILE_NAME}. Fill in "vars" for your repo, then run \`ethlete-agents sync\`.`);

  return 0;
};

const run = (argv: string[]) => {
  const command = argv[0];
  const root = readFlag(argv, '--root') ?? process.cwd();
  const options = { root, version: readVersion(), targets: parseTargets(argv) };

  switch (command) {
    case 'sync':
      return sync({ ...options, dryRun: argv.includes('--dry-run') });
    case 'check':
      return check(options);
    case 'init':
      return init(root);
    case 'migrate':
      return migrate({ ...options, dryRun: argv.includes('--dry-run') });
    default:
      console.log(USAGE);

      return command === undefined || command === '--help' || command === '-h' ? 0 : 1;
  }
};

export * from './lib';

// Guarded so the package can also be imported as a library without running the CLI.
if (require.main === module) {
  try {
    process.exit(run(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
