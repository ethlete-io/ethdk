import { ETHLETE_SCOPE } from './packages';

export type UpdateArgs = {
  /** Full package names the run is limited to. Empty means every `@ethlete/*` the manifest declares. */
  packages: string[];
  tag?: string;
  /** A single version named with `--to`. */
  version?: string;
  /** The version the migrations of a package run from, keyed by full package name. */
  from: Record<string, string>;
  check: boolean;
  dryRun: boolean;
  install: boolean;
  resume: boolean;
  ai: boolean;
  force: boolean;
  help: boolean;
  problems: string[];
};

const VALUE_FLAGS = ['--tag', '--to', '--from'];

const BOOLEAN_FLAGS = ['--check', '--dry-run', '--no-install', '--continue', '--ai', '--force', '--help', '-h'];

/** `core` and `@ethlete/core` both name the same package on the command line. */
export const fullPackageName = (name: string) => (name.includes('/') ? name : `${ETHLETE_SCOPE}${name}`);

const splitFlag = (argument: string) => {
  const separator = argument.indexOf('=');

  return separator === -1
    ? { flag: argument, inline: undefined }
    : { flag: argument.slice(0, separator), inline: argument.slice(separator + 1) };
};

/** Reads the flags of `et update`, collecting every problem so one run reports them all. */
export const parseUpdateArgs = (argv: readonly string[]): UpdateArgs => {
  const args: UpdateArgs = {
    packages: [],
    from: {},
    check: false,
    dryRun: false,
    install: true,
    resume: false,
    ai: false,
    force: false,
    help: false,
    problems: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index] ?? '';

    if (!argument.startsWith('-')) {
      args.packages.push(fullPackageName(argument));
      continue;
    }

    const { flag, inline } = splitFlag(argument);

    if (VALUE_FLAGS.includes(flag)) {
      const value = inline ?? argv[index + 1];

      if (inline === undefined) index += 1;

      if (value === undefined || value.startsWith('-')) {
        args.problems.push(`${flag} needs a value.`);
        continue;
      }

      if (flag === '--tag') args.tag = value;
      if (flag === '--to') args.version = value;

      if (flag === '--from') {
        const separator = value.lastIndexOf('@');
        const name = separator > 0 ? value.slice(0, separator) : undefined;
        const version = separator > 0 ? value.slice(separator + 1) : undefined;

        if (!name || !version) args.problems.push(`--from needs <package>@<version>, not "${value}".`);
        else args.from[fullPackageName(name)] = version;
      }

      continue;
    }

    if (!BOOLEAN_FLAGS.includes(flag)) {
      args.problems.push(`Unknown flag "${flag}".`);
      continue;
    }

    if (flag === '--check') args.check = true;
    if (flag === '--dry-run') args.dryRun = true;
    if (flag === '--no-install') args.install = false;
    if (flag === '--continue') args.resume = true;
    if (flag === '--ai') args.ai = true;
    if (flag === '--force') args.force = true;
    if (flag === '--help' || flag === '-h') args.help = true;
  }

  if (args.version !== undefined && args.tag !== undefined) {
    args.problems.push('--to and --tag ask for different targets. Pass one of them.');
  }

  if (args.version !== undefined && args.packages.length !== 1) {
    args.problems.push('--to sets the version of one package, so name that package.');
  }

  return args;
};
