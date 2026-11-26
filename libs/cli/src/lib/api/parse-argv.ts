const VALUE_FLAGS = ['--profile', '--wait'] as const;

export type ParsedApiArgv = {
  /** Every argument before the first `--`, flags included. */
  head: string[];
  /** The non-flag arguments of `head`, without the values of `--profile` and `--wait`. */
  positionals: string[];
  /** Everything after the first `--`, unchanged. `undefined` when there is no `--`. */
  rest: string[] | undefined;
  profile: string | undefined;
  wait: string | undefined;
};

/** Splits `et api` arguments at the first `--` and reads the value flags before it. */
export const parseApiArgv = (argv: string[]): ParsedApiArgv => {
  const separator = argv.indexOf('--');
  const head = separator === -1 ? argv : argv.slice(0, separator);
  const rest = separator === -1 ? undefined : argv.slice(separator + 1);
  const positionals: string[] = [];
  const values: Record<string, string | undefined> = {};

  for (let index = 0; index < head.length; index++) {
    const arg = head[index] as string;
    const flag = VALUE_FLAGS.find((candidate) => arg === candidate || arg.startsWith(`${candidate}=`));

    if (flag !== undefined) {
      if (arg === flag) {
        values[flag] = head[index + 1];
        index++;
      } else {
        values[flag] = arg.slice(flag.length + 1);
      }
    } else if (!arg.startsWith('-')) {
      positionals.push(arg);
    }
  }

  return { head, positionals, rest, profile: values['--profile'], wait: values['--wait'] };
};
