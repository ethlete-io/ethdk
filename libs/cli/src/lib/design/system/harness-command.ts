import { relative } from 'path';
import { harnessMapOf, writeHarnessMap } from './harness-map';
import { argsOf, configOf, oneProductOf } from './sketch/cli-args';

export const HARNESS_USAGE = 'harness --product <name> [--check]';

/** `et design harness --product <name>` writes the product's part-to-component map into its harness app. */
export const designHarness = (options: { target: string; argv: string[]; invocation: string }) => {
  const { target, invocation } = options;
  const args = argsOf(options.argv, ['--product']);

  if (typeof args === 'string' || args.positional.length > 0) {
    if (typeof args === 'string') console.error(args);

    console.error(`usage: ${invocation} ${HARNESS_USAGE}`);

    return 2;
  }

  const config = configOf(target);

  if (typeof config === 'string') {
    console.error(config);

    return 1;
  }

  const product = oneProductOf({ target, config, asked: args.values['--product'] });

  if (typeof product === 'string') {
    console.error(product);

    return 1;
  }

  const map = harnessMapOf({ target, product });

  if (map === null || typeof map === 'string') {
    console.error(map ?? `product "${product.name}" declares no harness in config.json`);

    return 1;
  }

  const path = relative(target, map.file);

  if (args.flags.has('--check')) {
    if (map.current) {
      console.log(`${path} is current`);

      return 0;
    }

    console.error(`${path} is stale - run ${invocation} harness --product ${product.name}`);

    return 1;
  }

  if (map.current) {
    console.log(`${path} is current`);

    return 0;
  }

  writeHarnessMap(map);
  console.log(`wrote ${path}`);

  return 0;
};
