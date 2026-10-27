import { relative } from 'path';
import { DesignConfig } from './paths';
import { productDirOf } from './system/product';
import { partKeyOf, ResolvedProduct } from './system/resolve-product';
import { openSketchProblemsOf, typecheckVariant } from './system/sketch/check-sketches';
import { Args, argsOf, authorOf, configOf, NEEDS_AUTHOR, oneProductOf, productNamesOf } from './system/sketch/cli-args';
import { discardSketch, mergeSketch } from './system/sketch/merge';
import { mergePreviewOf } from './system/sketch/merge-preview';
import {
  createSketch,
  findSketch,
  listSketches,
  markSketchReady,
  parseTarget,
  rebaseSketch,
  reportSketch,
  Sketch,
} from './system/sketch/sketch';

export const SKETCH_USAGE = [
  'sketch new <layer>/<name> --variants a,b --by <model id> [--product <name>]',
  'sketch list [--product <name>] [--json]',
  'sketch report <layer>/<name> --variant <key> --by <model id> <text> [--product <name>]',
  'sketch ready <layer>/<name> --by <model id> [--product <name>]',
  'sketch check [<layer>/<name>] [--product <name>]',
  'sketch preview <layer>/<name> <variant> [--product <name>] [--json]',
  'sketch rebase <layer>/<name> --by <model id> [--product <name>]',
  'sketch merge <layer>/<name> --note <reason> --by <model id> [--product <name>]',
  'sketch discard <layer>/<name> --by <model id> [--product <name>]',
];

const WRITES = new Set(['new', 'report', 'ready', 'rebase', 'merge', 'discard']);

type Context = { target: string; config: DesignConfig; args: Args };

const fail = (message: string) => {
  console.error(message);

  return 1;
};

const productAndSketchOf = (context: Context): { product: ResolvedProduct; sketch: Sketch } | string => {
  const { target, config, args } = context;
  const product = oneProductOf({ target, config, asked: args.values['--product'] });

  if (typeof product === 'string') return product;

  const parsed = parseTarget(args.positional[0]);

  if (typeof parsed === 'string') return parsed;

  const sketch = findSketch({ productDir: product.dir, product: product.name, sketch: parsed });

  if (sketch === null) return `NO SKETCH on ${partKeyOf(parsed)} in ${product.name}`;
  if (typeof sketch === 'string') return sketch;

  return { product, sketch };
};

const withSketch = (context: Context, run: (found: { product: ResolvedProduct; sketch: Sketch }) => number) => {
  const found = productAndSketchOf(context);

  return typeof found === 'string' ? fail(found) : run(found);
};

const created = (context: Context) => {
  const { target, config, args } = context;
  const product = oneProductOf({ target, config, asked: args.values['--product'] });

  if (typeof product === 'string') return fail(product);

  const parsed = parseTarget(args.positional[0]);

  if (typeof parsed === 'string') return fail(parsed);

  const variants = (args.values['--variants'] ?? '').split(',').filter((variant) => variant !== '');
  const sketch = createSketch({ product, sketch: parsed, variants });

  if (typeof sketch === 'string') return fail(sketch);

  console.log(`${sketch.target} in progress: ${relative(target, sketch.dir)} with ${sketch.variants.join(', ')}`);

  return 0;
};

const listed = (context: Context) => {
  const names = productNamesOf({ config: context.config, asked: context.args.values['--product'] });

  if (typeof names === 'string') return fail(names);

  const sketches = names.flatMap((name) =>
    listSketches({ productDir: productDirOf({ target: context.target, product: name }), product: name }),
  );
  const unreadable = sketches.filter((sketch): sketch is string => typeof sketch === 'string');
  const open = sketches.filter((sketch): sketch is Sketch => typeof sketch !== 'string');

  unreadable.forEach((problem) => console.error(problem));

  if (context.args.flags.has('--json')) {
    console.log(
      JSON.stringify(
        open.map(({ dir, ...sketch }) => ({ ...sketch, dir: relative(context.target, dir) })),
        null,
        2,
      ),
    );
  } else {
    for (const sketch of open) {
      const decided = sketch.decision
        ? sketch.decision.kind === 'pick'
          ? `, picked ${sketch.decision.variant}`
          : ', discard asked'
        : '';

      console.log(`${sketch.product}  ${sketch.target}  ${sketch.status}  ${sketch.variants.join(', ')}${decided}`);
    }

    if (open.length === 0) console.log('no open sketch');
  }

  return unreadable.length > 0 ? 1 : 0;
};

const reported = (context: Context) =>
  withSketch(context, ({ sketch }) => {
    const message = context.args.positional.slice(1).join(' ');
    const variant = context.args.values['--variant'];
    const author = authorOf(context.args);

    if (message === '' || !variant || !author)
      return fail(`usage: sketch report <layer>/<name> --variant <key> --by <model id> <text>`);

    const reported = reportSketch({ checkout: context.target, sketch, variant, author, message });

    return typeof reported === 'string' ? fail(reported) : 0;
  });

const readied = (context: Context) =>
  withSketch(context, ({ sketch }) => {
    const ready = markSketchReady({ checkout: context.target, sketch });

    if (typeof ready === 'string') return fail(ready);

    console.log(`${ready.target} is ready`);

    return 0;
  });

const rebased = (context: Context) =>
  withSketch(context, ({ product, sketch }) => {
    rebaseSketch({ product, sketch });
    console.log(`${sketch.target} now compares with the product as it is`);

    return 0;
  });

const checked = (context: Context) => {
  const { target, config, args } = context;
  const product = oneProductOf({ target, config, asked: args.values['--product'] });

  if (typeof product === 'string') return fail(product);

  const asked = args.positional[0];
  const { unreadable, variants } = openSketchProblemsOf(product);
  const chosen = asked === undefined ? variants : variants.filter((entry) => entry.sketch.target === asked);

  if (asked !== undefined && chosen.length === 0) return fail(`NO SKETCH on ${asked} in ${product.name}`);

  let failed = asked === undefined && unreadable.length > 0;

  if (asked === undefined)
    unreadable.forEach((problem) =>
      console.error(`${problem.rule} ${relative(target, problem.file)}: ${problem.message}`),
    );

  for (const { sketch, variant, problems } of chosen) {
    const typed = typecheckVariant({ target, product, sketch, variant });
    const all = [
      ...problems,
      ...(typed.kind === 'failed' ? [{ rule: 'TYPE-ERROR', file: sketch.dir, message: `\n${typed.output}` }] : []),
      ...(typed.kind === 'unavailable' ? [{ rule: 'TYPE-ERROR', file: sketch.dir, message: typed.message }] : []),
    ];

    for (const problem of all) {
      console.error(
        `${sketch.target} ${variant}: ${problem.rule} ${relative(target, problem.file)}: ${problem.message}`,
      );
    }

    failed ||= all.length > 0;
  }

  if (failed) return 1;

  console.log('ok');

  return 0;
};

const previewed = (context: Context) =>
  withSketch(context, ({ product, sketch }) => {
    const variant = context.args.positional[1];

    if (!variant || !sketch.variants.includes(variant))
      return fail(`${sketch.target} has no variant "${variant ?? ''}" - it has ${sketch.variants.join(', ')}`);

    const preview = mergePreviewOf({ product, sketch, variant });

    if (context.args.flags.has('--json')) {
      console.log(JSON.stringify(preview, null, 2));
    } else {
      console.log(`changes: ${preview.changed.join(', ')}`);
      console.log(`shows: ${preview.affected.join(', ') || 'no other element or page'}`);
    }

    return 0;
  });

const merged = (context: Context) =>
  withSketch(context, ({ product, sketch }) => {
    const note = context.args.values['--note'];

    if (context.args.positional.length > 1 || note === undefined)
      return fail(`usage: sketch merge <layer>/<name> --note <reason> - it merges the variant the user picked`);

    const result = mergeSketch({ target: context.target, config: context.config, product, sketch, note });

    if (typeof result === 'string') return fail(result);

    const variant = sketch.decision?.kind === 'pick' ? sketch.decision.variant : '';

    console.log(`merged ${sketch.target} variant ${variant} into ${product.name}: ${result.join(', ')}`);

    return 0;
  });

const discarded = (context: Context) =>
  withSketch(context, ({ sketch }) => {
    const problem = discardSketch({ target: context.target, sketch });

    if (problem) return fail(problem);

    console.log(`discarded the sketch on ${sketch.target}`);

    return 0;
  });

const COMMANDS: Record<string, (context: Context) => number> = {
  new: created,
  list: listed,
  report: reported,
  ready: readied,
  check: checked,
  preview: previewed,
  rebase: rebased,
  merge: merged,
  discard: discarded,
};

/** `et design sketch <command> …` opens, reports on, readies, checks, previews, rebases, merges and discards sketches. */
export const designSketch = (options: { target: string; argv: string[]; invocation: string }) => {
  const { target, argv, invocation } = options;
  const [command = '', ...rest] = argv;
  const run = COMMANDS[command];
  const args = argsOf(rest, ['--product', '--variants', '--note', '--variant', '--by']);
  const unauthored = typeof args !== 'string' && WRITES.has(command) && authorOf(args) === null;

  if (!run || typeof args === 'string' || unauthored) {
    if (typeof args === 'string') console.error(args);
    if (unauthored) console.error(`sketch ${command} ${NEEDS_AUTHOR}`);

    console.error(SKETCH_USAGE.map((line) => `usage: ${invocation} ${line}`).join('\n'));

    return 2;
  }

  const config = configOf(target);

  if (typeof config === 'string') return fail(config);

  return run({ target, config, args });
};
