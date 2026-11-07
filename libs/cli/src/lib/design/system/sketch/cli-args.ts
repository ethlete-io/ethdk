import { configPathOf, DesignConfig, readConfig } from '../../design-config';
import { resolveProduct, ResolvedProduct } from '../resolve-product';

/** `values` holds the last value of each flag, `repeated` every value in order. */
export type Args = {
  positional: string[];
  values: Record<string, string>;
  repeated: Record<string, string[]>;
  flags: Set<string>;
};

/**
 * Splits an argument list into positionals, the flags that take a value, and switches. With `switches`, any other
 * `--flag` is refused with a message that lists the known flags.
 */
export const argsOf = (argv: string[], flags: { values: string[]; switches?: string[] }): Args | string => {
  const { values: valueFlags, switches } = flags;
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
      if (switches && !switches.includes(arg))
        return `unknown flag ${arg} (flags: ${[...valueFlags, ...switches].join(', ') || 'none'})`;

      args.flags.add(arg);
    } else {
      args.positional.push(arg);
    }
  }

  return args;
};

/** The model id `--by` names, the agent that runs a write command; `null` when it is missing or blank. */
export const authorOf = (args: Args) => args.values['--by']?.trim() || null;

const MODEL_ID = /^(claude|gpt|gemini|codex)-[a-z0-9][a-z0-9._-]*$/iu;

/** Whether `by` looks like the id of a model: a known family, a dash, then the version. */
export const isModelId = (by: string) => MODEL_ID.test(by);

/** Why a verdict `--by` is refused: it is neither `designer` nor a model id; `null` when it is valid. */
export const verdictByProblemOf = (by: string) =>
  by === 'designer' || isModelId(by)
    ? null
    : `--by "${by}" is not valid for a verdict: use designer or a model id such as claude-opus-5-5 (families: claude, gpt, gemini, codex)`;

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
