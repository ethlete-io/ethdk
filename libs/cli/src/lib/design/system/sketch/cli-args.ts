import { configPathOf, DesignConfig, readConfig } from '../../paths';
import { resolveProduct, ResolvedProduct } from '../resolve-product';

/** `values` holds the last value of each flag, `repeated` every value in order. */
export type Args = {
  positional: string[];
  values: Record<string, string>;
  repeated: Record<string, string[]>;
  flags: Set<string>;
};

/** Splits an argument list into positionals, the flags that take a value, and switches. */
export const argsOf = (argv: string[], valueFlags: string[]): Args | string => {
  const args: Args = { positional: [], values: {}, repeated: {}, flags: new Set() };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index] ?? '';

    if (valueFlags.includes(arg)) {
      const value = argv[index + 1];

      if (value === undefined) return `${arg} needs a value`;

      args.values[arg] = value;
      args.repeated[arg] = [...(args.repeated[arg] ?? []), value];
      index++;
    } else if (arg.startsWith('--')) {
      args.flags.add(arg);
    } else {
      args.positional.push(arg);
    }
  }

  return args;
};

/** The model id `--by` names, the agent that runs a write command; `null` when it is missing or blank. */
export const authorOf = (args: Args) => args.values['--by']?.trim() || null;

export const NEEDS_AUTHOR =
  'needs --by <model id>: the exact model id the coordinator gave you, e.g. claude-opus-5-5. Never guess it.';

export const configOf = (target: string): DesignConfig | string =>
  readConfig(target) ?? `design-explore: no config at ${configPathOf(target)}`;

const declaredOf = (config: DesignConfig) => Object.keys(config.products ?? {});

/** The products a command runs on: the one `--product` names, else every product of the config. */
export const productNamesOf = (options: { config: DesignConfig; asked: string | undefined }): string[] | string => {
  const declared = declaredOf(options.config);

  if (options.asked === undefined) return declared;
  if (!declared.includes(options.asked))
    return `NO PRODUCT "${options.asked}" - config.json declares ${declared.join(', ') || 'none'}.`;

  return [options.asked];
};

/** The one product a command works on: the one `--product` names, or the only one the config declares. */
export const oneProductOf = (options: {
  target: string;
  config: DesignConfig;
  asked: string | undefined;
}): ResolvedProduct | string => {
  const { target, config, asked } = options;
  const declared = declaredOf(config);
  const name = asked ?? (declared.length === 1 ? declared[0] : undefined);

  if (name === undefined)
    return declared.length > 1
      ? `more than one product - pass --product <name>; config.json declares ${declared.join(', ')}.`
      : `pass --product <name> - config.json declares none.`;

  const entry = config.products?.[name];

  if (!entry) return `NO PRODUCT "${name}" - config.json declares ${declared.join(', ') || 'none'}.`;

  return resolveProduct({ target, name, config: entry });
};
