import { AgentTarget } from './config';

export type CommandArgs = {
  targets?: AgentTarget[];
  root?: string;
  dryRun: boolean;
  help: boolean;
  problems: string[];
};

const VALUE_FLAGS = ['--targets', '--root'];

const FLAGS_BY_COMMAND: Record<string, string[]> = {
  sync: ['--targets', '--root', '--dry-run'],
  check: ['--targets', '--root'],
  init: ['--root'],
  migrate: ['--targets', '--root', '--dry-run'],
};

export const parseCommandArgs = (command: string, argv: readonly string[]): CommandArgs => {
  const allowed = [...(FLAGS_BY_COMMAND[command] ?? []), '--help', '-h'];
  const args: CommandArgs = { dryRun: false, help: false, problems: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index] ?? '';
    const separator = argument.indexOf('=');
    const flag = separator === -1 ? argument : argument.slice(0, separator);

    if (!allowed.includes(flag)) {
      args.problems.push(
        flag.startsWith('-') ? `Unknown flag "${flag}" for ${command}.` : `Unexpected argument "${argument}".`,
      );
      continue;
    }

    if (VALUE_FLAGS.includes(flag)) {
      const value = separator === -1 ? argv[++index] : argument.slice(separator + 1);

      if (!value || value.startsWith('-')) {
        args.problems.push(`${flag} needs a value.`);
        continue;
      }

      if (flag === '--root') args.root = value;
      else args.targets = value.split(',').map((entry) => entry.trim()) as AgentTarget[];
      continue;
    }

    if (flag === '--dry-run') args.dryRun = true;
    else args.help = true;
  }

  return args;
};
