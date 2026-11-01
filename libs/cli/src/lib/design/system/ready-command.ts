import { openPointsText } from './open-points';
import { drawnPartPointsOf, markPartReady, readyPartOf } from './part-ready';
import { partKeyOf } from './resolve-product';
import { staleDistWarningsOf } from './stale-dist';
import { argsOf, authorOf, configOf, NEEDS_AUTHOR, oneProductOf } from './sketch/cli-args';
import { parseTarget } from './sketch/sketch';

export const READY_USAGE = 'ready <layer>/<name> --product <name> --by <name>';

/** `et design ready <layer>/<name> …` marks a part ready, and exits 1 with its open points while it has any. */
export const designReady = async (options: { target: string; argv: string[]; invocation: string }) => {
  const { target, argv, invocation } = options;
  const args = argsOf(argv, ['--product', '--by']);
  const usage = `usage: ${invocation} ${READY_USAGE}`;

  if (typeof args === 'string' || authorOf(args) === null || args.positional.length !== 1) {
    if (typeof args === 'string') console.error(args);
    else if (authorOf(args) === null) console.error(`ready ${NEEDS_AUTHOR}`);

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

  for (const line of staleDistWarningsOf({ target, config })) console.warn(line);

  const part = partKeyOf(parsed);
  const located = readyPartOf({ product, part });
  const marked = await markPartReady({
    product,
    part,
    hash: typeof located === 'string' ? '-' : located.hash,
    by: authorOf(args),
    pointsOf: async () => {
      const points = await drawnPartPointsOf({ target, config, product, part });

      return 'unavailable' in points ? { status: 503, error: `cannot draw ${part}: ${points.unavailable}` } : points;
    },
  });

  if ('status' in marked) {
    if (marked.points)
      openPointsText(product.name, [{ part, points: marked.points }]).forEach((line) => console.error(line));

    console.error(marked.error);

    return 1;
  }

  console.log(`${part} is ready in ${product.name}`);

  return 0;
};
