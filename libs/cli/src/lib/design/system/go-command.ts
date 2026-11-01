import { tomGoRefusalOf } from './go-guard';
import { goPartOf, markPartGo } from './part-go';
import { repoRootOf } from './reachable-files';
import { partKeyOf } from './resolve-product';
import { argsOf, authorOf, configOf, NEEDS_AUTHOR, oneProductOf } from './sketch/cli-args';
import { parseTarget } from './sketch/sketch';

export const GO_USAGE = 'go <layer>/<name> --product <name> --by <name> [--note "Impl Qnn"]';

/** `et design go <layer>/<name> …` releases a part for implementation at its current hash. */
export const designGo = async (options: { target: string; argv: string[]; invocation: string }) => {
  const { target, argv, invocation } = options;
  const args = argsOf(argv, ['--product', '--by', '--note']);
  const usage = `usage: ${invocation} ${GO_USAGE}`;

  if (typeof args === 'string' || authorOf(args) === null || args.positional.length !== 1) {
    if (typeof args === 'string') console.error(args);
    else if (authorOf(args) === null) console.error(`go ${NEEDS_AUTHOR}`);

    console.error(usage);

    return 2;
  }

  const config = configOf(target);
  const parsed = parseTarget(args.positional[0]);

  if (typeof config === 'string' || typeof parsed === 'string') {
    console.error(typeof config === 'string' ? config : parsed);

    return 1;
  }

  const product = oneProductOf({ target, config, asked: args.values['--product'] });

  if (typeof product === 'string') {
    console.error(product);

    return 1;
  }

  const part = partKeyOf(parsed);
  const located = goPartOf({ product, part });

  if (typeof located === 'string') {
    console.error(located);

    return 1;
  }

  const by = authorOf(args);
  const note = args.values['--note']?.trim() || undefined;

  if (by?.toLowerCase() === 'tom') {
    const refusal = tomGoRefusalOf({ root: repoRootOf(product), note, files: located.design.files });

    if (refusal) {
      console.error(refusal);

      return 1;
    }
  }

  const marked = markPartGo({ product, part, by, note });

  if ('status' in marked) {
    console.error(marked.error);

    return 1;
  }

  console.log(`${part} has a go in ${product.name}`);

  return 0;
};
