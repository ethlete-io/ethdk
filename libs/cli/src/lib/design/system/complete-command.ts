import { chromiumOf } from '../browser';
import { completenessGapLineOf, completenessOf } from './complete';
import { exceptionLineOf, requestException } from './exceptions';
import { partKeyOf } from './resolve-product';
import { argsOf, configOf, oneProductOf } from './sketch/cli-args';
import { parseTarget } from './sketch/sketch';

export const COMPLETE_USAGE =
  'complete <layer>/<name> [--product <name>] | complete --request <layer>/<name>.<control>.<requirement> --reason <text> [--product <name>]';

/** `et design complete <layer>/<name>` exits 1 while a control the part declares lacks a drawn, reviewed state or surface. */
export const designComplete = async (options: {
  target: string;
  argv: string[];
  invocation: string;
  chromiumOf?: typeof chromiumOf;
}) => {
  const { target, argv, invocation } = options;
  const args = argsOf(argv, ['--product', '--request', '--reason']);
  const usage = `usage: ${invocation} ${COMPLETE_USAGE}`;
  const request = typeof args === 'string' ? undefined : args.values['--request'];

  if (
    typeof args === 'string' ||
    args.positional.length !== (request === undefined ? 1 : 0) ||
    (request === undefined) !== (args.values['--reason'] === undefined)
  ) {
    if (typeof args === 'string') console.error(args);

    console.error(usage);

    return 2;
  }

  const config = configOf(target);

  if (typeof config === 'string') {
    console.error(config);

    return 1;
  }

  if (request !== undefined) {
    const product = oneProductOf({ target, config, asked: args.values['--product'] });
    const requested =
      typeof product === 'string'
        ? product
        : requestException({ product, key: request, reason: args.values['--reason'] ?? '' });

    if (typeof requested === 'string') {
      console.error(requested);

      return 1;
    }

    console.log(
      `requested exception ${request} - design complete still fails on it until the user approves it in Studio`,
    );

    return 0;
  }

  const parsed = parseTarget(args.positional[0]);

  if (typeof parsed === 'string') {
    console.error(parsed);

    return 1;
  }

  const product = oneProductOf({ target, config, asked: args.values['--product'] });

  if (typeof product === 'string') {
    console.error(product);

    return 1;
  }

  const part = partKeyOf(parsed);
  const result = await completenessOf({ target, config, product, part, chromiumOf: options.chromiumOf });

  if ('problem' in result) {
    console.error(result.problem);

    return 1;
  }

  if ('unavailable' in result) {
    console.error(`design complete needs a browser: ${result.unavailable}`);

    return 1;
  }

  for (const exception of result.exceptions ?? []) console.log(exceptionLineOf(exception));
  for (const gap of result.gaps) console.error(completenessGapLineOf(gap));

  if (result.gaps.length > 0) {
    console.error(`${part} in ${product.name} is not design complete: ${result.gaps.length} gap(s)`);

    return 1;
  }

  console.log(`${part} in ${product.name} is design complete`);

  return 0;
};
