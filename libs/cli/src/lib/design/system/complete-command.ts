import { chromiumOf } from '../browser';
import { completenessGapLineOf, completenessOf } from './complete';
import { partKeyOf } from './resolve-product';
import { argsOf, configOf, oneProductOf } from './sketch/cli-args';
import { parseTarget } from './sketch/sketch';

export const COMPLETE_USAGE = 'complete <layer>/<name> [--product <name>]';

/** `et design complete <layer>/<name>` exits 1 while a control the part declares lacks a drawn, reviewed state or surface. */
export const designComplete = async (options: {
  target: string;
  argv: string[];
  invocation: string;
  chromiumOf?: typeof chromiumOf;
}) => {
  const { target, argv, invocation } = options;
  const args = argsOf(argv, ['--product']);
  const usage = `usage: ${invocation} ${COMPLETE_USAGE}`;

  if (typeof args === 'string' || args.positional.length !== 1) {
    if (typeof args === 'string') console.error(args);

    console.error(usage);

    return 2;
  }

  const config = configOf(target);

  if (typeof config === 'string') {
    console.error(config);

    return 1;
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

  for (const gap of result.gaps) console.error(completenessGapLineOf(gap));

  if (result.gaps.length > 0) {
    console.error(`${part} in ${product.name} is not design complete: ${result.gaps.length} gap(s)`);

    return 1;
  }

  console.log(`${part} in ${product.name} is design complete`);

  return 0;
};
