import { unusedInVariantOf } from './system/sketch/unused-closure';
import { relative, resolve } from 'path';
import { DesignConfig } from './paths';
import { ASSETS_FOLDER } from './system/assets';
import { addressSketchComments, commentsOnSketch } from './system/comments/comment';
import { productDirOf } from './system/product';
import { Problem } from './system/problem';
import { partKeyOf, ResolvedProduct } from './system/resolve-product';
import { formatProblemsOf, formatSketch } from './system/sketch/check-format';
import {
  openSketchProblemsOf,
  typecheckVariant,
  variantProblemsOf,
  variantWarningsOf,
} from './system/sketch/check-sketches';
import { Args, argsOf, authorOf, configOf, NEEDS_AUTHOR, oneProductOf, productNamesOf } from './system/sketch/cli-args';
import { shotsShowNoChange, variantsThatDoNotLoad } from './ready-shots';
import { discardSketch, mergeSketch } from './system/sketch/merge';
import { recordAllowedMerge, recordAutoMerge } from './system/sketch/merged-parts';
import { renderIssueLineOf, renderIssuesOf } from './system/render-check';
import { mergePreviewOf } from './system/sketch/merge-preview';
import {
  addVariant,
  createSketch,
  decideSketch,
  editRound,
  findSketch,
  finishSketchReport,
  heldProblemOf,
  holdSketch,
  isVariantName,
  listSketches,
  markSketchReady,
  parseTarget,
  rebaseSketch,
  rejectionOf,
  releaseSketch,
  reportSketch,
  runningRoundOf,
  sharedDirOf,
  Sketch,
  sketchSourceOf,
  SketchVariantVerdict,
  SketchVerdictBy,
  sourceFilesIn,
} from './system/sketch/sketch';

export const SKETCH_USAGE = [
  'sketch new <layer>/<name> [<layer>/<name>…] --variants a,b --by <model id> [--like <layer>/<name>[:<variant>]] [--round <title>] [--note <text>] [--variant-note <variant>=<text>]… [--override | --into-base] [--product <name>]',
  'sketch variant <layer>/<name> <variant>[,<variant>…] --from <variant> --by <model id> [--round <title> --note <why the running round lost> [--round-note <what the new round shows>]] [--product <name>]',
  'sketch round <layer>/<name> <round> [--title <text>] [--note <text>] [--drops <state,state>] --by <model id> [--product <name>]',
  'sketch list [--product <name>] [--json]',
  'sketch report <layer>/<name> --variant <key> --by <model id> (<text> | --done) [--product <name>]',
  'sketch ready <layer>/<name> --by <model id> [--product <name>]',
  'sketch hold <layer>/<name> --until <what the change waits on> --by <model id> [--product <name>]',
  'sketch release <layer>/<name> --by <model id> [--product <name>]',
  'sketch check [<layer>/<name>] [--fix] [--product <name>]',
  'sketch preview <layer>/<name> <variant> [--product <name>] [--json]',
  'sketch rebase <layer>/<name> --by <model id> [--product <name>]',
  'sketch merge <layer>/<name> [--note <reason>] [--variant <key> --allowed-by <plan ref>] --by <model id> [--product <name>]',
  'sketch discard <layer>/<name> --by <model id> [--product <name>]',
  'sketch reject <layer>/<name> --variant <key> [--reason <text>] --by <model id | designer> [--product <name>]',
  'sketch reopen <layer>/<name> --variant <key> [--reason <text>] --by <model id | designer> [--product <name>]',
];

const FLAG_HELP: Record<string, string> = {
  '--variants': 'the variant folders to open, a comma list: a,b,c',
  '--variant-note':
    "the note of one variant, kept in sketch.json apart from the part's merged note; repeat it per variant: a=<text>",
  '--by': 'the exact model id the coordinator gave you, e.g. claude-opus-5-5',
  '--like': 'start each variant from another part, or from a variant of the open sketch on it',
  '--override':
    'on a base part: merge into a product copy that overrides the base, not into the base; on a product override: sketch that copy',
  '--into-base':
    'on a part the product overrides: start from the product copy, merge into the base and remove the copy',
  '--round': 'the title of a new round',
  '--round-note': 'what the new round shows',
  '--from': 'the variant to copy',
  '--title': 'the new title of the round',
  '--drops': 'the states the round drops on purpose, a comma list',
  '--variant': 'the variant the command is about; on merge, the only live variant of a sketch with no pick',
  '--allowed-by':
    'the plan entry that lets the merge go without a pick in Studio; logged in accepted.json, needs --variant',
  '--reason':
    'why; on reject of a variant that is rejected already it sets the reason of that rejection; stored with who wrote it',
  '--until': 'what the pending change waits on: an open decision, a helper still to land',
  '--done': 'end the live report of the variant',
  '--product': 'the product; needed only when config.json declares more than one and no other product has the sketch',
  '--json': 'print JSON',
  '--fix': "write the variants in the checkout's Prettier format first",
};

const VERDICT_BY_HELP =
  "a model id records the verdict as the agent's; --by designer records it as the designer's - only when the designer said it at this terminal";

const NOTE_HELP: Record<string, string> = {
  new: 'what the first round shows',
  variant: 'why the running round lost; needed with --round',
  round: 'what the round shows',
  merge: 'why this variant',
};

/** One line per flag the usage line names, for `sketch <command> --help`. */
export const sketchFlagHelpOf = (usage: string) => {
  const command = usage.split(' ')[1] ?? '';
  const help: Record<string, string | undefined> = {
    ...FLAG_HELP,
    '--note': NOTE_HELP[command],
    ...(VERDICTS.has(command) ? { '--by': VERDICT_BY_HELP } : {}),
  };

  return [...new Set(usage.match(/--[a-z-]+/gu) ?? [])].flatMap((flag) =>
    help[flag] === undefined ? [] : [`  ${flag.padEnd(16)}${help[flag]}`],
  );
};

const VERDICTS = new Set(['reject', 'reopen']);

const WRITES = new Set([
  'new',
  'variant',
  'round',
  'report',
  'ready',
  'hold',
  'release',
  'rebase',
  'merge',
  'discard',
  ...VERDICTS,
]);

type Context = { target: string; config: DesignConfig; args: Args; noSketchHint?: string };

const fail = (message: string) => {
  console.error(message);

  return 1;
};

const productsWithSketchOf = (context: Context, has: (productDir: string, product: string) => boolean) =>
  Object.keys(context.config.products ?? {}).filter((name) =>
    has(productDirOf({ target: context.target, product: name }), name),
  );

/**
 * The product a sketch command works on: the one `--product` names or the only one the config declares, else the
 * only product with an open sketch on the target - or with any open sketch when the command names no target.
 */
const sketchProductOf = (context: Context): ResolvedProduct | string => {
  const { target, config, args } = context;
  const asked = args.values['--product'];
  const declared = Object.keys(config.products ?? {});

  if (asked !== undefined || declared.length < 2) return oneProductOf({ target, config, asked });

  const parsed = parseTarget(args.positional[0]);
  const holders =
    args.positional[0] === undefined
      ? productsWithSketchOf(context, (productDir, product) =>
          listSketches({ productDir, product }).some((sketch) => typeof sketch !== 'string'),
        )
      : typeof parsed === 'string'
        ? []
        : productsWithSketchOf(
            context,
            (productDir, product) => findSketch({ productDir, product, sketch: parsed }) !== null,
          );

  return oneProductOf({ target, config, asked: holders.length === 1 ? holders[0] : undefined });
};

const productAndSketchOf = (context: Context): { product: ResolvedProduct; sketch: Sketch } | string => {
  const { args } = context;
  const product = sketchProductOf(context);

  if (typeof product === 'string') return product;

  const parsed = parseTarget(args.positional[0]);

  if (typeof parsed === 'string') return parsed;

  const sketch = findSketch({ productDir: product.dir, product: product.name, sketch: parsed });

  if (sketch === null) return `NO SKETCH on ${partKeyOf(parsed)} in ${product.name}${context.noSketchHint ?? ''}`;
  if (typeof sketch === 'string') return sketch;

  return { product, sketch };
};

const withSketch = (context: Context, run: (found: { product: ResolvedProduct; sketch: Sketch }) => number) => {
  const found = productAndSketchOf(context);

  return typeof found === 'string' ? fail(found) : run(found);
};

const partFileOf = (options: { root: string; sketch: Sketch; variant: string; part: string }) => {
  const { root, sketch, variant, part } = options;
  const name = part.split('/').pop() ?? '';

  return relative(root, resolve(sketch.dir, variant, part, `${name}.ts`));
};

const variantLineOf = (options: { root: string; sketch: Sketch; variant: string }) => {
  const { root, sketch, variant } = options;
  const files = sketch.targets.map((part) => partFileOf({ ...options, part })).join(', ');

  return `  ${variant}: ${files}  assets: ${relative(root, resolve(sketch.dir, variant, ASSETS_FOLDER))}/`;
};

const created = (context: Context) => {
  const { target, config, args } = context;
  const product = oneProductOf({ target, config, asked: args.values['--product'] });

  if (typeof product === 'string') return fail(product);

  const [parsed, ...others] = (args.positional.length > 0 ? args.positional : [undefined]).map(parseTarget);
  const unknown = [parsed, ...others].find((entry) => typeof entry === 'string');

  if (typeof unknown === 'string') return fail(unknown);
  if (parsed === undefined || typeof parsed === 'string') return fail(SKETCH_USAGE[0] ?? '');

  const variants = (args.values['--variants'] ?? '').split(',').filter((variant) => variant !== '');
  const notes = variantNotesOf(args.repeated['--variant-note'] ?? [], variants);

  if (typeof notes === 'string') return fail(notes);

  if (args.values['--round'] !== undefined && (args.values['--note'] ?? '').trim() === '')
    return fail(`--round needs --note "<what the round shows>" - sketch ready refuses a round without a note`);

  const asked = args.values['--like'];
  const like = asked === undefined ? undefined : sketchSourceOf({ product, like: asked });

  if (typeof like === 'string') return fail(like);

  const override = args.flags.has('--override');
  const intoBase = args.flags.has('--into-base');

  if (override && intoBase) return fail('pass --override or --into-base, not both');

  const sketch = createSketch({
    product,
    sketch: parsed,
    others: others.filter((entry) => typeof entry !== 'string'),
    variants,
    roundTitle: args.values['--round'],
    roundNote: args.values['--note'],
    author: authorOf(args) ?? undefined,
    like,
    variantNotes: notes,
    merge: override ? 'override' : intoBase ? 'into-base' : undefined,
  });

  if (typeof sketch === 'string') return fail(sketch);

  formatSketch({ target, sketch, variants: sketch.variants });
  console.log(
    `${sketch.targets.join(', ')} in progress: ${relative(target, sketch.dir)} with ${sketch.variants.join(', ')}`,
  );

  for (const variant of sketch.variants) console.log(variantLineOf({ root: target, sketch, variant }));

  const shared = sourceFilesIn(sharedDirOf(sketch));

  if (shared.length > 0) {
    console.log(`  shared by every variant, imported as @shared/<path>; edit it here, not in a copy:`);
    shared.forEach((file) => console.log(`    ${relative(target, file)}`));
  }

  nextStepsOf(sketch, product.name).forEach((line) => console.log(line));

  return 0;
};

const nextStepsOf = (sketch: Sketch, product: string) => {
  const at = `${sketch.target} --product ${product}`;
  const first = sketch.variants[0] ?? '<key>';
  const running = runningRoundOf(sketch);

  return [
    'Next:',
    `  sketch report ${at} --variant ${first} --by <model id> "<what you draw>"   while you draw a variant`,
    `  sketch report ${at} --variant ${first} --by <model id> --done              when you stop drawing it; no report runs yet, so none is needed now`,
    ...(running.note.trim() === ''
      ? [
          `  sketch round ${sketch.target} ${running.key} --product ${product} --note "<what the round shows>" --by <model id>`,
        ]
      : []),
    `  sketch check ${at}`,
    `  sketch ready ${at} --by <model id>`,
  ];
};

const variantNotesOf = (pairs: string[], variants: string[]): Map<string, string> | string => {
  const notes = new Map<string, string>();

  for (const pair of pairs) {
    const split = pair.indexOf('=');
    const variant = pair.slice(0, split);

    if (split < 1 || !variants.includes(variant))
      return `--variant-note needs <variant>=<text> with one of ${variants.join(', ') || 'the --variants'}; got "${pair}"`;

    notes.set(variant, pair.slice(split + 1).trim());
  }

  return notes;
};

const VARIANT_USAGE =
  'usage: sketch variant <layer>/<name> <variant>[,<variant>…] --from <variant> [--round <title> --note <why the running round lost> [--round-note <what the new round shows>]]';

const varied = (context: Context) =>
  withSketch(
    {
      ...context,
      noSketchHint: ` - start one with: sketch new ${context.args.positional[0] ?? '<layer>/<name>'} --variants a,b,c --round "<title>"`,
    },
    ({ sketch }) => {
      const { positional, values } = context.args;
      const variant = positional[1];
      const from = values['--from'];
      const title = values['--round'];
      const lostNote = values['--note'];
      const roundNote = values['--round-note'];

      if (
        positional.length !== 2 ||
        !variant ||
        !from ||
        (title === undefined) !== (lostNote === undefined) ||
        (title === undefined && roundNote !== undefined)
      )
        return fail(VARIANT_USAGE);

      const open =
        title === undefined
          ? commentsOnSketch({ productDir: resolve(sketch.dir, '..', '..'), product: sketch.product, sketch })
          : [];

      if (open.length > 0)
        return fail(
          [
            `${sketch.target} has ${open.length} open comment(s) - a variant that answers them starts a new round:`,
            ...open.map((comment) => `  ${comment.id} on ${comment.sketch?.variant ?? ''}: ${comment.text}`),
            `sketch variant ${sketch.target} ${variant} --from <variant> --round "<title>" --note "<why the running round lost>" --round-note "<what the new round shows>"`,
            `if the variant answers none of them, close each first with: inbox done <id> --note <text>`,
          ].join('\n'),
        );

      const variants = variant.split(',').filter((name) => name !== '');
      const taken = variants.find((name, index) => sketch.variants.includes(name) || variants.indexOf(name) !== index);

      const invalid = variants.find((name) => !isVariantName(name));

      if (invalid !== undefined)
        return fail(`"${invalid}" is no variant name - use lower case letters, digits and dashes, and not "shared"`);
      if (taken !== undefined) return fail(`${sketch.target} already has a variant "${taken}"`);

      let added = sketch;

      for (const [index, name] of variants.entries()) {
        const next = addVariant({
          sketch: added,
          variant: name,
          from,
          author: authorOf(context.args) ?? undefined,
          ...(index === 0 && title !== undefined && lostNote !== undefined
            ? { round: { title, lostNote, note: roundNote } }
            : {}),
        });

        if (typeof next === 'string') return fail(next);

        added = next;
      }

      const round = added.rounds.find((entry) => entry.key === added.variantInfo[variants[0] ?? '']?.round);

      const previous = title === undefined ? undefined : added.rounds[added.rounds.length - 2];

      if (previous) console.log(`why round ${previous.key} ${previous.title} lost: ${previous.lost ?? ''}`);

      formatSketch({ target: context.target, sketch: added, variants });

      for (const name of variants) {
        console.log(`${added.target} in progress: variant ${name} from ${from} in round ${round?.key ?? ''}`);
        console.log(variantLineOf({ root: context.target, sketch: added, variant: name }));
      }

      if (title !== undefined && round?.note === '')
        console.log(
          `round ${round.key} has no note yet - sketch ready needs one: sketch round ${added.target} ${round.key} --note "<what the round shows>" --by <model id>`,
        );

      if (title === undefined) return 0;

      const addressed = addressSketchComments({
        sketch,
        variant: from,
        reason: 'round',
        author: authorOf(context.args) ?? undefined,
        note: lostNote,
        round: round?.key,
      });

      if (addressed.length > 0)
        console.log(
          `addressed ${addressed.length} comment(s) on variant ${from} in round ${round?.key ?? ''}: ${addressed.map(({ id }) => id).join(', ')}`,
        );

      return 0;
    },
  );

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
      const rejected = sketch.variants.filter((variant) => rejectionOf(sketch, variant));

      console.log(
        `${sketch.product}  ${sketch.target}  ${sketch.status}  ${sketch.variants.join(', ')}${decided}${rejected.length > 0 ? `, rejected ${rejected.join(', ')}` : ''}${sketch.hold ? `, held until: ${sketch.hold.until}` : ''}`,
      );

      for (const round of sketch.rounds) {
        const variants = sketch.variants.filter((variant) => sketch.variantInfo[variant]?.round === round.key);

        console.log(
          `  ${round.key}  ${round.title}  ${variants.join(', ')}${round.note === '' ? '' : `  - ${round.note}`}${round.lost ? `  - lost: ${round.lost}` : ''}`,
        );
      }
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
    const done = context.args.flags.has('--done');

    if ((message === '' && !done) || !variant || !author)
      return fail(
        `usage: sketch report <layer>/<name> --variant <key> --by <model id> (<text> | --done) [--product <name>] - --product is needed when config.json declares more than one product`,
      );

    if (done) {
      finishSketchReport({ checkout: context.target, sketch, variant });
      console.log(`${sketch.target} variant ${variant} marked done`);

      return 0;
    }

    const reported = reportSketch({ checkout: context.target, sketch, variant, author, message });

    if (typeof reported === 'string') return fail(reported);

    console.log(
      `reported on ${sketch.target} variant ${variant}: ${message}${sketch.status === 'ready' ? ' - back in progress, mark it ready again when done' : ''}`,
    );

    return 0;
  });

const ROUND_USAGE =
  'usage: sketch round <layer>/<name> <round> [--title <text>] [--note <text>] [--drops <state,state>] --by <model id>';

const roundEdited = (context: Context) =>
  withSketch(context, ({ sketch }) => {
    const { positional, values } = context.args;
    const round = positional[1];

    if (positional.length !== 2 || !round) return fail(ROUND_USAGE);

    const edited = editRound({
      sketch,
      round,
      title: values['--title'],
      note: values['--note'],
      drops: values['--drops']
        ?.split(',')
        .map((state) => state.trim())
        .filter((state) => state !== ''),
    });

    if (typeof edited === 'string') return fail(edited);

    const entry = edited.rounds.find((candidate) => candidate.key === round);

    console.log(
      `${edited.target} round ${round}: ${entry?.title ?? ''}${entry?.note ? ` - ${entry.note}` : ''}${entry?.lost ? ` - lost: ${entry.lost}` : ''}${entry?.drops ? ` - drops ${entry.drops.join(', ')}` : ''}`,
    );

    return 0;
  });

const readied = (context: Context) => {
  const found = productAndSketchOf(context);

  if (typeof found === 'string') return fail(found);

  const hold = heldProblemOf(found.sketch);

  if (hold !== null) return fail(hold);

  const refused = readyRefusalOf(context, found);

  if (refused !== null) return refused;

  return renderedAndReady(context, found);
};

const renderedAndReady = async (context: Context, found: { product: ResolvedProduct; sketch: Sketch }) => {
  const { product, sketch } = found;
  const rendered = await renderedVariantsOf({
    target: context.target,
    config: context.config,
    product,
    entries: sketch.variants.map((variant) => ({ sketch, variant })),
    drawn: false,
  });

  if ('issues' in rendered && rendered.issues.length > 0)
    return fail(`${sketch.target} has problems - fix them before ready`);

  return loadedAndReady(context, found);
};

const loadedAndReady = async (context: Context, { product, sketch }: { product: ResolvedProduct; sketch: Sketch }) => {
  const unloaded = await variantsThatDoNotLoad({ target: context.target, config: context.config, product, sketch });

  if (unloaded.length > 0)
    return fail(
      `${unloaded.map((line) => `${sketch.target} ${line}`).join('\n')}\n${sketch.target} does not load - fix it before ready`,
    );

  const ready =
    sketch.status === 'ready'
      ? sketch
      : markSketchReady({ checkout: context.target, sketch, author: authorOf(context.args) ?? undefined });

  if (typeof ready === 'string') return fail(ready);

  return autoMerged({ context, product, sketch: ready, again: sketch.status === 'ready' });
};

const autoMerged = async (options: { context: Context; product: ResolvedProduct; sketch: Sketch; again: boolean }) => {
  const { context, product, sketch, again } = options;

  if (!again) console.log(`${sketch.target} is ready`);

  for (const variant of sketch.variants.filter((candidate) => !rejectionOf(sketch, candidate))) {
    const { shared } = mergePreviewOf({ product, sketch, variant });

    if (shared.length > 0) console.log(`variant ${variant}: a shared/ edit reaches ${shared.join(', ')}`);
  }

  if (!sketch.targets.every((key) => product.parts.some((part) => partKeyOf(part) === key))) {
    console.log('auto-merge skipped: new part, the user merges');

    return again ? fail(`${sketch.target} is ready, not in progress`) : 0;
  }

  const noChange = await shotsShowNoChange({ target: context.target, config: context.config, product, sketch });

  if (noChange !== true) {
    console.log(`auto-merge skipped: ${noChange}`);

    return again ? fail(`${sketch.target} is ready, not in progress`) : 0;
  }

  const author = authorOf(context.args) ?? undefined;
  const variant = sketch.variants.find((candidate) => !rejectionOf(sketch, candidate)) ?? '';
  const decided = decideSketch({ sketch, decision: { kind: 'pick', variant } });

  if (typeof decided === 'string') return fail(decided);

  const result = mergeSketch({ target: context.target, config: context.config, product, sketch: decided, author });

  if (!Array.isArray(result)) {
    console.warn(`${sketch.target} shows no visible change but did not merge: ${result.reason}`);

    return 0;
  }

  for (const part of sketch.targets) recordAutoMerge({ product, part, by: author ?? 'user' });
  console.log(`No visible change in any state: merged ${sketch.targets.join(', ')} automatically.`);

  return 0;
};

const noteProblemsBefore = ({ sketch, variant, before }: { sketch: Sketch; variant: string; before: Problem[] }) => {
  if (before.length > 0)
    console.warn(
      `NOTE ${sketch.target} ${variant}: ${before.length} problem${before.length === 1 ? ' was' : 's were'} there before (design check lists them)`,
    );
};

const readyRefusalOf = (
  context: Context,
  { product, sketch }: { product: ResolvedProduct; sketch: Sketch },
): number | null => {
  const lineOf = (variant: string, problem: Problem) =>
    `${sketch.target} ${variant}: ${problem.rule} ${relative(context.target, problem.file)}: ${problem.message}`;
  const found = variantProblemsOf({ product, sketch });

  found.forEach(noteProblemsBefore);

  const problems = found.flatMap(({ variant, problems }) =>
    [
      ...problems,
      ...formatProblemsOf({ target: context.target, sketch, variant }),
      ...(rejectionOf(sketch, variant) ? [] : unusedInVariantOf({ product, sketch, variant })),
    ].map((problem) => lineOf(variant, problem)),
  );

  sketch.variants.forEach((variant) =>
    variantWarningsOf({ target: context.target, product, sketch, variant }).forEach((warning) =>
      console.warn(`${sketch.target} ${variant}: ${warning}`),
    ),
  );

  if (problems.length > 0) return fail(`${problems.join('\n')}\n${sketch.target} has problems - fix them before ready`);

  const running = runningRoundOf(sketch);

  if (running.note.trim() === '')
    return fail(
      `${sketch.target} round ${running.key} has no note - set it with: sketch round ${sketch.target} ${running.key} --note "<what the round shows>" --by <model id>`,
    );

  return null;
};

const rebased = (context: Context) =>
  withSketch(context, ({ product, sketch }) => {
    rebaseSketch({ product, sketch });
    console.log(`${sketch.target} now compares with the product as it is`);

    return 0;
  });

const held = (context: Context) =>
  withSketch(context, ({ sketch }) => {
    const until = context.args.values['--until'];

    if (context.args.positional.length !== 1 || until === undefined)
      return fail(
        `usage: sketch hold <layer>/<name> --until <what the change waits on> --by <model id> [--product <name>]`,
      );

    const wasReady = sketch.status === 'ready';
    const holding = holdSketch({ sketch, until, by: authorOf(context.args) ?? '' });

    if (typeof holding === 'string') return fail(holding);

    console.log(
      `${holding.target} is held until: ${holding.hold?.until ?? ''}${wasReady ? ' - back in progress, out of the merge queue' : ''}`,
    );

    return 0;
  });

const released = (context: Context) =>
  withSketch(context, ({ sketch }) => {
    const freed = releaseSketch({ sketch });

    if (typeof freed === 'string') return fail(freed);

    console.log(`${freed.target} is no longer held - mark it ready once the change is in`);

    return 0;
  });

const renderedVariantsOf = async ({
  target,
  config,
  product,
  entries,
  drawn,
}: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  entries: { sketch: Sketch; variant: string }[];
  drawn: boolean;
}) => {
  const rendered = await renderIssuesOf({
    target,
    config,
    jobs: entries.map(({ sketch, variant }) => {
      const preview = mergePreviewOf({ product, sketch, variant });

      return {
        product: product.name,
        sketch: { target: sketch.target, variant },
        parts: [...preview.changed, ...preview.affected],
      };
    }),
  });

  if ('unavailable' in rendered) console.log(`RENDER CHECK SKIPPED - ${rendered.unavailable}`);
  else {
    for (const { sketch, part, state, size } of drawn ? rendered.drawn : []) {
      const rules = [
        ...new Set(
          rendered.issues
            .filter(
              (issue) =>
                issue.sketch?.target === sketch?.target &&
                issue.sketch?.variant === sketch?.variant &&
                issue.part === part &&
                issue.state === state &&
                issue.size === size,
            )
            .map((issue) => issue.rule),
        ),
      ];

      console.log(
        `${sketch?.target ?? ''} ${sketch?.variant ?? ''}: ${part} ${state} at ${size} ${rules.join(' ') || 'ok'}`,
      );
    }

    if (drawn)
      rendered.grids.forEach(({ sketch, part, line }) =>
        console.log(`${sketch?.target ?? ''} ${sketch?.variant ?? ''}: ${part} ${line}`),
      );
    rendered.warnings.forEach((issue) =>
      console.warn(`${issue.sketch?.target ?? ''} ${issue.sketch?.variant ?? ''}: WARNING ${renderIssueLineOf(issue)}`),
    );
    rendered.issues.forEach((issue) =>
      console.error(`${issue.sketch?.target ?? ''} ${issue.sketch?.variant ?? ''}: ${renderIssueLineOf(issue)}`),
    );
  }

  return rendered;
};

const checked = async (context: Context) => {
  const { target, config, args } = context;
  const product = sketchProductOf(context);

  if (typeof product === 'string') return fail(product);

  const asked = args.positional[0];
  const { unreadable, variants } = openSketchProblemsOf(product);
  const chosen = asked === undefined ? variants : variants.filter((entry) => entry.sketch.target === asked);

  if (asked !== undefined && chosen.length === 0) return fail(`NO SKETCH on ${asked} in ${product.name}`);

  if (args.flags.has('--fix'))
    new Set(chosen.map((entry) => entry.sketch)).forEach((sketch) =>
      formatSketch({ target, sketch, variants: sketch.variants }),
    );

  let failed = asked === undefined && unreadable.length > 0;

  if (asked === undefined)
    unreadable.forEach((problem) =>
      console.error(`${problem.rule} ${relative(target, problem.file)}: ${problem.message}`),
    );

  new Set(chosen.map((entry) => entry.sketch)).forEach((sketch) => {
    if (sketch.hold) console.warn(`HELD ${sketch.target}: until ${sketch.hold.until}`);
  });

  for (const { sketch, variant, problems, before } of chosen) {
    const typed = typecheckVariant({ target, product, sketch, variant });

    noteProblemsBefore({ sketch, variant, before });

    variantWarningsOf({ target, product, sketch, variant }).forEach((warning) =>
      console.warn(`${sketch.target} ${variant}: ${warning}`),
    );

    const all = [
      ...problems,
      ...formatProblemsOf({ target, sketch, variant }),
      ...(typed.kind === 'failed' ? [{ rule: 'TYPE-ERROR', file: sketch.dir, message: `\n${typed.output}` }] : []),
      ...(typed.kind === 'unavailable' ? [{ rule: 'NO-TYPE-CHECKER', file: sketch.dir, message: typed.message }] : []),
    ];

    for (const problem of all) {
      console.error(
        `${sketch.target} ${variant}: ${problem.rule} ${relative(target, problem.file)}: ${problem.message}`,
      );
    }

    failed ||= all.length > 0;
  }

  if (failed) return 1;

  const rendered = await renderedVariantsOf({
    target,
    config,
    product,
    entries: chosen,
    drawn: true,
  });

  if ('issues' in rendered && rendered.issues.length > 0) return 1;

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

      if (preview.shared.length > 0) console.log(`a shared/ edit reaches: ${preview.shared.join(', ')}`);

      console.log(`shows: ${preview.affected.join(', ') || 'no other element or page'}`);
    }

    return 0;
  });

const allowedMergeOf = (options: { sketch: Sketch; variant: string }) => {
  const { sketch, variant } = options;
  const live = sketch.variants.filter((candidate) => !rejectionOf(sketch, candidate));

  if (live.length !== 1 || live[0] !== variant)
    return `${sketch.target} has ${live.length} live variants (${live.join(', ') || 'none'}), not only "${variant}" - the user picks in Studio`;

  return decideSketch({ sketch, decision: { kind: 'pick', variant } });
};

const merged = (context: Context) =>
  withSketch(context, ({ product, sketch }) => {
    const { '--note': note, '--variant': flagVariant, '--allowed-by': planRef } = context.args.values;

    if (context.args.positional.length > 1)
      return fail(`usage: sketch merge <layer>/<name> [--note <reason>] - it merges the variant the user picked`);
    if ((flagVariant === undefined) !== (planRef === undefined))
      return fail(
        '--variant and --allowed-by go together: name the only live variant and the plan that allows the merge',
      );

    const allowed = flagVariant !== undefined && planRef !== undefined && sketch.decision?.kind !== 'pick';
    const decidedSketch = allowed ? allowedMergeOf({ sketch, variant: flagVariant }) : sketch;

    if (typeof decidedSketch === 'string') return fail(decidedSketch);

    const result = mergeSketch({
      target: context.target,
      config: context.config,
      product,
      sketch: decidedSketch,
      note,
      author: authorOf(context.args) ?? undefined,
    });

    if (!Array.isArray(result)) return fail(result.reason);

    if (allowed)
      for (const part of sketch.targets)
        recordAllowedMerge({ product, part, by: authorOf(context.args) ?? 'user', planRef: planRef.trim() });

    const variant = decidedSketch.decision?.kind === 'pick' ? decidedSketch.decision.variant : '';

    console.log(`merged ${sketch.target} variant ${variant} into ${product.name}: ${result.join(', ')}`);

    return 0;
  });

const discarded = (context: Context) =>
  withSketch(context, ({ sketch }) => {
    const problem = discardSketch({ target: context.target, sketch, author: authorOf(context.args) ?? undefined });

    if (problem) return fail(problem);

    console.log(`discarded the sketch on ${sketch.target}`);

    return 0;
  });

const verdictOriginOf = (by: SketchVerdictBy, of: SketchVerdictBy | undefined) =>
  of && of !== by ? ` (reason by the ${of})` : '';

/** The verdicts a variant had, oldest first, and whether it is rejected now. */
export const verdictLinesOf = (sketch: Sketch, variant: string) => {
  const history = sketch.rejections?.[variant] ?? [];
  const lines = history.flatMap((rejection) => [
    `  rejected by the ${rejection.by} at ${rejection.decidedAt}${verdictOriginOf(rejection.by, rejection.reasonBy)}${rejection.reason ? `: ${rejection.reason}` : ''}`,
    ...(rejection.reopened
      ? [
          `  reopened by the ${rejection.reopened.by} at ${rejection.reopened.decidedAt}${rejection.reopened.reason ? `: ${rejection.reopened.reason}` : ''}`,
        ]
      : []),
  ]);

  return [`${sketch.target} variant ${variant}: ${rejectionOf(sketch, variant) ? 'rejected' : 'live'}`, ...lines];
};

const judged = (kind: 'reject' | 'reopen') => (context: Context) =>
  withSketch(context, ({ sketch }) => {
    const { positional, values } = context.args;
    const variant = values['--variant'];
    const reason = values['--reason']?.trim() || undefined;
    const by: SketchVerdictBy = authorOf(context.args) === 'designer' ? 'designer' : 'agent';

    if (positional.length !== 1 || !variant)
      return fail(
        `usage: sketch ${kind} <layer>/<name> --variant <key> [--reason <text>] --by <model id | designer> [--product <name>]`,
      );

    const decision: SketchVariantVerdict =
      kind === 'reject' && reason && rejectionOf(sketch, variant)
        ? { kind: 'reason', variant, reason, by }
        : { kind, variant, ...(reason ? { reason } : {}), by };
    const decided = decideSketch({ sketch, decision });

    if (typeof decided === 'string') return fail(decided);

    verdictLinesOf(decided, variant).forEach((line) => console.log(line));

    return 0;
  });

const COMMANDS: Record<string, (context: Context) => number | Promise<number>> = {
  new: created,
  variant: varied,
  round: roundEdited,
  list: listed,
  report: reported,
  ready: readied,
  hold: held,
  release: released,
  check: checked,
  preview: previewed,
  rebase: rebased,
  merge: merged,
  discard: discarded,
  reject: judged('reject'),
  reopen: judged('reopen'),
};

/**
 * `et design sketch <command> …` opens, adds variants to, reports on, readies, checks, previews, rebases, merges and
 * discards sketches, and rejects and reopens their variants.
 */
export const designSketch = (options: { target: string; argv: string[]; invocation: string }) => {
  const { target, argv, invocation } = options;
  const [command = '', ...rest] = argv;
  const run = COMMANDS[command];
  const args = argsOf(rest, [
    '--product',
    '--variants',
    '--note',
    '--variant',
    '--by',
    '--from',
    '--round',
    '--round-note',
    '--title',
    '--like',
    '--drops',
    '--variant-note',
    '--reason',
    '--allowed-by',
    '--until',
  ]);
  const unauthored = typeof args !== 'string' && WRITES.has(command) && authorOf(args) === null;

  if (!run || typeof args === 'string' || unauthored) {
    if (typeof args === 'string') console.error(args);
    if (!run) console.error(`unknown sketch command "${command}"`);
    if (unauthored) console.error(`sketch ${command} ${NEEDS_AUTHOR}`);

    console.error(SKETCH_USAGE.map((line) => `usage: ${invocation} ${line}`).join('\n'));

    return 2;
  }

  const config = configOf(target);

  if (typeof config === 'string') return fail(config);

  return run({ target, config, args });
};
