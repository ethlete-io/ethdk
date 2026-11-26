import {
  applyOutputStylePlan,
  availableOutputStyles,
  DEFAULT_OUTPUT_STYLE,
  OutputStylePlan,
  planOutputStyle,
} from './output-style';

const FLAGS_WITH_VALUE = ['--config-dir'];

const positionalArgs = (args: string[]) =>
  args.filter((entry, index) => !entry.startsWith('--') && !FLAGS_WITH_VALUE.includes(args[index - 1] ?? ''));

const flagValue = (args: string[], flag: string) => {
  const index = args.indexOf(flag);

  return index === -1 ? undefined : args[index + 1];
};

const usage = () => `ethlete-agents output-style — install an Ethlete output style into Claude Code

An output style replaces Claude Code's own answer style for every session, so it is written
into the machine's Claude config rather than into a repository.

  output-style [name]     Install the style and switch Claude Code to it
                          (default: ${DEFAULT_OUTPUT_STYLE})

Options
  --no-activate        Write the file, but leave "outputStyle" in settings.json alone
  --remove             Delete the style file and stop using it
  --force              Overwrite (or delete) a style file this command did not write
  --dry-run            Print what would change without writing
  --config-dir <path>  Claude's config directory (default: $CLAUDE_CONFIG_DIR, else ~/.claude)

Ships: ${availableOutputStyles().join(', ') || 'nothing'}

Claude Code only. Codex has no output-style mechanism - everything it is told comes from
AGENTS.md, which \`ethlete-agents sync\` already writes.
`;

const describe = (file: OutputStylePlan['files'][number]) => `  ${file.action.padEnd(6)} ${file.path}`;

export const outputStyleCommand = (options: { argv: string[] }) => {
  const { argv } = options;

  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(usage());

    return 0;
  }

  const plan = planOutputStyle({
    name: positionalArgs(argv)[0],
    configDir: flagValue(argv, '--config-dir'),
    activate: !argv.includes('--no-activate'),
    remove: argv.includes('--remove'),
    force: argv.includes('--force'),
  });

  console.log(`Style   ${plan.name}`);
  console.log(`Config  ${plan.configDir}`);

  if (plan.conflict) {
    console.error(plan.conflict);

    return 1;
  }

  if (plan.files.length === 0) {
    console.log(argv.includes('--remove') ? 'It is not installed here.' : 'Already installed and in use.');

    return 0;
  }

  plan.files.forEach((file) => console.log(describe(file)));

  if (argv.includes('--dry-run')) {
    console.log(`\n${plan.files.length} file(s) would change. Re-run without --dry-run to apply.`);

    return 0;
  }

  applyOutputStylePlan(plan);

  if (argv.includes('--remove')) {
    console.log('\nRemoved. A session that is already open keeps the style until it restarts.');

    return 0;
  }

  console.log(`\nInstalled. Start a new session, or run \`/output-style ${plan.name}\`, to use it.`);

  return 0;
};
