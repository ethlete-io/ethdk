import { unusedInVariantOf } from './system/sketch/unused-closure';
import { createHash } from 'crypto';
import { existsSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, relative, resolve } from 'path';
import { DesignConfig } from './design-config';
import { timedPhase } from './phase-timing';
import { originOf } from './system/write-origin';
import { ASSETS_FOLDER } from './system/assets';
import { addressSketchComments, commentsOnSketch } from './system/comments/comment';
import { productDirOf } from './system/product';
import { Problem } from './system/problem';
import { partKeyOf, ResolvedProduct } from './system/resolve-product';
import { formatProblemsOf, formatSketch } from './system/sketch/check-format';
import { frameBudgetWarningsOf } from './system/sketch/frame-budget';
import { NOTE_LANGUAGE_NAMES, noteLanguageWarningsOf } from './system/sketch/note-language';
import {
  openSketchProblemsOf,
  typecheckVariant,
  variantProblemsOf,
  variantWarningsOf,
} from './system/sketch/check-sketches';
import {
  Args,
  argsOf,
  authorOf,
  configOf,
  NEEDS_AUTHOR,
  oneProductOf,
  productNamesOf,
  verdictByProblemOf,
} from './system/sketch/cli-args';
import {
  aktuellPlaceholderWarnings,
  identicalRenderLines,
  identicalRenders,
  sampleMarkDriftLines,
  variantChangesShown,
  variantsThatDoNotLoad,
} from './ready-shots';
import { noChangedStateLinesOf, noChangeOf } from './system/sketch/no-visible-change';
import { coverPartProblemOf, editCovers } from './system/sketch/covered-diffs';
import { unviewedShotLinesOf, VariantChange } from './system/sketch/viewed-shots';
import { addedUndeclaredControlsOf } from './system/complete';
import { discardSketch, mergeSketch } from './system/sketch/merge';
import { editRefOf, mergeAndRecord } from './system/sketch/merge-step';
import { staleSketchBasesOf } from './system/check-system';
import { staleBaseOf } from './system/sketch/stale-base';
import { repoInvocation } from '../invocation';
import { MERGED_FILE } from './system/sketch/merged-parts';
import { noVerdictLineOf } from './system/no-verdict';
import { BusyState, groupedIssueLinesOf, RenderIssue, renderIssueLineOf, renderIssuesOf } from './system/render-check';
import { mergePreviewOf } from './system/sketch/merge-preview';
import { openPointsText, PartOpenPoints } from './system/open-points';
import { instantLinesOf, sketchOpenPointsOf } from './system/read-open-points';
import { overlaySketch } from './system/sketch/overlay';
import { productModuleIdOf, SketchVariant } from './system/system-modules';
import { unchangedStatesOf } from './system/sketch/unchanged-states';
import { portBaseChanges } from './system/sketch/rebase-port';
import { THEMING_TEXT } from './system/theming-text';
import { createRunDraw, loadingOn, WarmDraw } from './warm-draw';
import {
  addVariant,
  createSketch,
  decideSketch,
  editRound,
  addTarget,
  removeTarget,
  editVariantNote,
  findSketch,
  finishSketchReport,
  heldProblemOf,
  holdSketch,
  isVariantName,
  listSketches,
  markSketchReady,
  reopenChangedReady,
  parseTarget,
  rebaseSketch,
  authorsOf,
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
  withdrawVariant,
  writeSketchFile,
  SKETCH_FILE,
} from './system/sketch/sketch';
import { spawnPlain } from '../plain-output';
import { lintGateLinesOf, variantLintFilesOf } from './design-lint';

export const SKETCH_USAGE = [
  'sketch new <layer>/<name> [<layer>/<name>…] --variants a,b --by <model id> [--like <layer>/<name>[:<variant>]] [--name <sketch name>] [--round <title>] [--note <text>] [--variant-note <variant>=<text>]… [--override | --into-base] [--ready] [--product <name>]',
  'sketch variant <layer>/<name> <variant>[,<variant>…] --from <variant> --by <model id> [--round <title> --note <why the running round lost> [--round-note <what the new round shows>]] [--product <name>]',
  'sketch round <layer>/<name> <round> [--title <text>] [--note <text>] [--drops <state,state>] --by <model id> [--product <name>]',
  'sketch covers <layer>/<name> [[<layer>/<name>:]<state>[@<x>,<y>,<w>,<h>]…] --by <model id> [--product <name>]',
  'sketch note <layer>/<name> [<variant>] <text> [--round <round>] --by <model id> [--product <name>]',
  'sketch target add <layer>/<name> <layer>/<name> --by <model id> [--product <name>]',
  'sketch target remove <layer>/<name> <layer>/<name> --by <model id> [--product <name>]',
  'sketch list [--product <name>] [--json]',
  'sketch report <layer>/<name> --variant <key> --by <model id> (<text> | --done) [--reopen] [--product <name>]',
  'sketch ready <layer>/<name> [--no-visible-change] --by <model id> [--product <name>]',
  'sketch hold <layer>/<name> --until <what the change waits on> --by <model id> [--product <name>]',
  'sketch release <layer>/<name> --by <model id> [--product <name>]',
  'sketch check [<layer>/<name>] [--fix] [--no-visible-change] [--product <name>]',
  'sketch preview <layer>/<name> <variant> [--product <name>] [--json]',
  'sketch rebase <layer>/<name> [--ported] --by <model id> [--product <name>]',
  'sketch merge <layer>/<name> [--note <reason> [--replace-note]] [--variant <key> --allowed-by <plan ref>] [--decided-by <name>] --by <model id> [--product <name>]',
  'sketch discard <layer>/<name> --by <model id> [--product <name>]',
  'sketch reject <layer>/<name> --variant <key> [--reason <text>] --by <model id | designer> [--product <name>]',
  'sketch reopen <layer>/<name> --variant <key> [--reason <text>] --by <model id | designer> [--product <name>]',
  'sketch withdraw <layer>/<name> --variant <key> --by <model id> [--product <name>]',
];

const FLAG_HELP: Record<string, string> = {
  '--variants': 'the variant folders to open, a comma list: a,b,c',
  '--variant-note':
    "the note of one variant, kept in sketch.json apart from the part's merged note; repeat it per variant: a=<text>",
  '--by': 'the exact model id the coordinator gave you, e.g. claude-opus-5-5',
  '--name':
    'a second sketch on a part that has one: it lives in its own folder and is addressed as <layer>/<name>@<sketch name>',
  '--like': 'start each variant from another part, or from a variant of the open sketch on it',
  '--override':
    'on a base part: merge into a product copy that overrides the base, not into the base; on a product override: sketch that copy',
  '--into-base':
    'on a part the product overrides: start from the product copy, merge into the base and remove the copy',
  '--ready':
    'on new: run sketch ready (its gates are the check) right after opening the sketch; it fails when either refuses and the sketch stays in progress',
  '--ported': 'on rebase: the conflicting files hold the product change already, ported by hand - keep them and rebase',
  '--round': 'the title of a new round; on note: the key of the round whose note to rewrite',
  '--round-note': 'what the new round shows',
  '--from': 'the variant to copy',
  '--title': 'the new title of the round',
  '--drops': 'the states the round drops on purpose, a comma list',
  '--variant': 'the variant the command is about; on merge, the only live variant of a sketch with no pick',
  '--allowed-by':
    'the plan entry that lets the merge go without a pick in Studio; noted in merged.json, needs --variant',
  '--decided-by':
    'on merge: who picked the variant, as merged.json records it (default user); a name the designer gave you at this terminal, e.g. tom - not with --allowed-by',
  '--replace-note': "on merge: also write --note over each target part's note",
  '--reason':
    'why; on reject of a variant that is rejected already it sets the reason of that rejection; stored with who wrote it',
  '--until': 'what the pending change waits on: an open decision, a helper still to land',
  '--done': 'end the live report of the variant',
  '--reopen': 'on report: move a ready sketch back to in progress',
  '--product': 'the product; needed only when config.json declares more than one and no other product has the sketch',
  '--json': 'print JSON',
  '--fix': "write the variants in the checkout's Prettier format first",
  '--no-visible-change':
    'the sketch must change no pixel: its variants may draw every state like the product, and ready merges it by itself',
};

const VERDICT_BY_HELP =
  "a model id records the verdict as the agent's; --by designer records it as the designer's - only when the designer said it at this terminal";

const NOTE_HELP: Record<string, string> = {
  new: 'what the first round shows',
  variant: 'why the running round lost; needed with --round',
  round: 'what the round shows',
  merge: "why this variant; noted in merged.json, the part's note stays",
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

const VERDICTS = new Set(['reject', 'reopen', 'withdraw']);

const WRITES = new Set([
  'new',
  'target',
  'variant',
  'round',
  'note',
  'covers',
  'report',
  'ready',
  'hold',
  'release',
  'rebase',
  'merge',
  'discard',
  ...VERDICTS,
]);

const RETRIES = new Set([...WRITES, 'check']);

type Context = {
  target: string;
  config: DesignConfig;
  args: Args;
  invocation?: string;
  noSketchHint?: string;
  warm?: WarmDraw;
};

const staleBasesOf = (context: Context, options: { product: ResolvedProduct; targets: Set<string> }) =>
  staleSketchBasesOf({
    ...options,
    invocation: context.invocation ?? repoInvocation({ root: context.target, subcommand: 'design' }),
  });

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

const opened = (context: Context) => {
  const { target, config, args } = context;
  const product = oneProductOf({ target, config, asked: args.values['--product'] });

  if (typeof product === 'string') return fail(product);

  const [parsed, ...others] = (args.positional.length > 0 ? args.positional : [undefined]).map(parseTarget);
  const unknown = [parsed, ...others].find((entry) => typeof entry === 'string');

  if (typeof unknown === 'string') return fail(unknown);
  if (parsed === undefined || typeof parsed === 'string') return fail(SKETCH_USAGE[0] ?? '');

  const name = args.values['--name'];
  const named = name === undefined ? parsed : parseTarget(`${parsed.layer}/${parsed.name}@${name}`);

  if (typeof named === 'string') return fail(named);

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
    sketch: named,
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

  nextStepsOf(sketch, product).forEach((line) => console.log(line));

  return 0;
};

const created = async (context: Context) => {
  const code = opened(context);

  if (code !== 0 || !context.args.flags.has('--ready')) return code;

  const found = productAndSketchOf({ ...context, args: { ...context.args, positional: [openedTargetOf(context)] } });

  if (typeof found === 'string') return fail(found);

  const again = { ...context, args: { ...context.args, positional: [found.sketch.target] } };

  const readyCode = await readied(again);

  return readyCode === 0
    ? 0
    : fail(`${found.sketch.target} is still in progress: sketch ready refused - fix it, then run sketch ready`);
};

const openedTargetOf = ({ args }: Context) => {
  const [first] = args.positional;
  const name = args.values['--name'];

  return name === undefined ? (first ?? '') : `${first}@${name}`;
};

const noteLanguageLineOf = (product: ResolvedProduct) =>
  product.config.noteLanguage === undefined
    ? []
    : [
        `  write every round and variant note in ${NOTE_LANGUAGE_NAMES[product.config.noteLanguage]}: that is the product's UI language`,
      ];

const nextStepsOf = (sketch: Sketch, productSource: ResolvedProduct) => {
  const product = productSource.name;
  const at = `${sketch.target} --product ${product}`;
  const first = sketch.variants[0] ?? '<key>';
  const running = runningRoundOf(sketch);

  return [
    'Next:',
    `  sketch report ${at} --variant ${first} --by <model id> "<what you draw>"   while you draw a variant`,
    ...(running.note.trim() === ''
      ? [
          `  sketch round ${sketch.target} ${running.key} --product ${product} --note "<what the round shows>" --by <model id>`,
        ]
      : []),
    `  sketch check ${at}`,
    ...noteLanguageLineOf(productSource),
    `  shot ${sketch.targets[0]} --states --variants --product ${product}   look at it: ready refuses a pixel diff without a viewed shot`,
    `  sketch ready ${at} --by <model id>`,
    `  sketch report ${at} --variant ${first} --by <model id> --done              after ready, once you stop drawing a variant; no report runs yet, so none is needed now`,
    `  a shared JSON file ready wrote (merged.json): commit it with \`et design commit-hunks <file> --part ${sketch.targets[0]}\`, never as a whole file another session also edits`,
    THEMING_TEXT,
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
        if (rejectionOf(added, from)?.status === 'withdrawn') console.log(`  ${name}: from withdrawn ${from}`);
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
      const rejected = sketch.variants.filter(
        (variant) => rejectionOf(sketch, variant)?.status !== 'withdrawn' && rejectionOf(sketch, variant),
      );
      const withdrawnKeys = sketch.variants.filter((variant) => rejectionOf(sketch, variant)?.status === 'withdrawn');

      const extra = sketch.targets.slice(1);

      console.log(
        `${sketch.product}  ${sketch.target}${extra.length > 0 ? ` (+ ${extra.join(', ')})` : ''}  ${sketch.status}  ${sketch.variants.join(', ')}${decided}${rejected.length > 0 ? `, rejected ${rejected.join(', ')}` : ''}${withdrawnKeys.length > 0 ? `, withdrawn ${withdrawnKeys.join(', ')}` : ''}${sketch.hold ? `, held until: ${sketch.hold.until}` : ''}`,
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
        `usage: sketch report <layer>/<name> --variant <key> --by <model id> (<text> | --done) [--reopen] [--product <name>] - --product is needed when config.json declares more than one product`,
      );

    if (done) {
      const notReady = roundNoteRefusalOf(sketch) === null ? roundNotReadyProblemOf(sketch) : null;

      if (notReady !== null) return fail(notReady);

      finishSketchReport({ checkout: context.target, sketch, variant });
      console.log(`${sketch.target} variant ${variant} marked done`);

      return 0;
    }

    const reported = reportSketch({
      checkout: context.target,
      sketch,
      variant,
      author,
      message,
      reopen: context.args.flags.has('--reopen'),
    });

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

const noteEdited = (context: Context) =>
  withSketch(context, ({ sketch }) => {
    const round = context.args.values['--round'];

    if (round !== undefined) {
      const roundNote = context.args.positional.slice(1).join(' ').trim();

      if (roundNote === '') return fail('usage: sketch note <layer>/<name> --round <round> <text> --by <model id>');

      const reworded = editRound({ sketch, round, note: roundNote });

      if (typeof reworded === 'string') return fail(reworded);

      console.log(`${reworded.target} round ${round}: ${roundNote}`);

      return 0;
    }

    const [, variant, ...words] = context.args.positional;
    const note = words.join(' ').trim();

    if (!variant || note === '') return fail(`usage: ${SKETCH_USAGE.find((line) => line.startsWith('sketch note '))}`);

    const edited = editVariantNote({ sketch, variant, note });

    if (typeof edited === 'string') return fail(edited);

    console.log(`${edited.target} variant ${variant}: ${note}`);

    return 0;
  });

const coversEdited = (context: Context) =>
  withSketch(context, ({ sketch }) => {
    const covers = context.args.positional.slice(1);
    const partProblem = coverPartProblemOf({ sketch, covers });

    if (partProblem !== null) {
      console.error(partProblem);

      return 2;
    }

    const edited = editCovers({ sketch, covers });

    if (typeof edited === 'string') return fail(edited);

    console.log(
      (edited.covers ?? []).length === 0
        ? `${edited.target} covers no compare DIFF`
        : `${edited.target} covers the compare DIFFs of ${(edited.covers ?? []).join(', ')} while it is open (ADR 0222)`,
    );

    return 0;
  });

const targetRemoved = (context: Context) => {
  const usage = `usage: ${SKETCH_USAGE.find((line) => line.startsWith('sketch target remove'))}`;
  const rest = context.args.positional.slice(1);
  const [, part] = rest;

  if (rest.length !== 2 || !part) return fail(usage);

  const parsed = parseTarget(part);

  if (typeof parsed === 'string') return fail(parsed);

  return withSketch({ ...context, args: { ...context.args, positional: rest } }, ({ sketch }) => {
    const removed = removeTarget({ sketch, part: parsed });

    if (typeof removed === 'string') return fail(removed);

    formatSketch({ target: context.target, sketch: removed, variants: removed.variants });
    console.log(`${removed.target} now targets ${removed.targets.join(', ')}`);

    return 0;
  });
};

const targetAdded = (context: Context) => {
  const [action, ...rest] = context.args.positional;
  const [, part] = rest;
  const usage = `usage: ${SKETCH_USAGE.find((line) => line.startsWith('sketch target '))}`;

  if (action === 'remove') return targetRemoved(context);
  if (action !== 'add' || rest.length !== 2 || !part) return fail(usage);

  const parsed = parseTarget(part);

  if (typeof parsed === 'string') return fail(parsed);

  return withSketch({ ...context, args: { ...context.args, positional: rest } }, ({ product, sketch }) => {
    const added = addTarget({ product, sketch, part: parsed, author: authorOf(context.args) ?? undefined });

    if (typeof added === 'string') return fail(added);

    formatSketch({ target: context.target, sketch: added, variants: added.variants });
    console.log(`${added.target} now targets ${added.targets.join(', ')}`);

    return 0;
  });
};

const readyLockOf = (sketch: Sketch) =>
  resolve(tmpdir(), `et-sketch-ready-${createHash('sha256').update(sketch.dir).digest('hex').slice(0, 16)}.lock`);

const isRunning = (pid: number) => {
  try {
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
};

const lockedReady = (sketch: Sketch) => {
  const lock = readyLockOf(sketch);
  const holder = Number(contentOf(lock));

  if (holder > 0 && isRunning(holder)) return null;

  writeFileSync(lock, String(process.pid));

  return () => rmSync(lock, { force: true });
};

const reportedReopen = (sketch: Sketch) => {
  const reopened = reopenChangedReady(sketch);

  if (!reopened) return sketch;

  console.log(`${sketch.target} was ready; ${reopened.changed.join(', ')} changed since - back to in progress`);

  return reopened.sketch;
};

const readied = (context: Context) => {
  const found = productAndSketchOf(context);

  if (typeof found === 'string') return fail(found);

  const hold = heldProblemOf(found.sketch);

  if (hold !== null) return fail(hold);

  const reopened = reportedReopen(found.sketch);
  const current = { product: found.product, sketch: reopened };
  const refused = timedPhase('gates', () => readyRefusalOf(context, current));

  if (refused !== null) return refused;

  const unlinted = timedPhase('lint', () =>
    lintGateLinesOf({
      target: context.target,
      productDir: current.product.dir,
      files: variantLintFilesOf(
        reopened,
        reopened.variants.filter((variant) => !rejectionOf(reopened, variant)),
      ),
    }),
  );

  if (unlinted.length > 0)
    return fail(`${unlinted.join('\n')}\n${reopened.target} adds lint warnings - fix them before ready`);

  const unlock = lockedReady(reopened);

  if (!unlock) return fail(`another sketch ready run on ${reopened.target} is going - wait for it`);

  const run = context.warm
    ? { warm: { ...context.warm, perRun: true }, close: async () => undefined }
    : createRunDraw(context.target);

  return renderedAndReady({ ...context, warm: run.warm }, current).finally(async () => {
    unlock();
    await run.close();
  });
};

const renderedAndReady = async (context: Context, found: { product: ResolvedProduct; sketch: Sketch }) => {
  const { product, sketch } = found;
  const rendered = await timedPhase('render-check', () =>
    renderedVariantsOf({
      target: context.target,
      config: context.config,
      product,
      entries: sketch.variants
        .filter((variant) => !rejectionOf(sketch, variant))
        .map((variant) => ({ sketch, variant })),
      drawn: false,
      warm: context.warm,
    }),
  );

  if ('issues' in rendered && rendered.noVerdict) return 1;

  if ('issues' in rendered && rendered.issues.length > 0)
    return fail(`${sketch.target} has problems - fix them before ready`);

  const busyAdded = 'issues' in rendered ? openPointLinesOf({ product, sketch, busy: rendered.busy ?? [] }).added : [];

  if (busyAdded.length > 0)
    return fail(`${busyAdded.join('\n')}\n${sketch.target} adds open points - close them before ready`);

  return loadedAndReady(context, found);
};

const loadedAndReady = async (context: Context, { product, sketch }: { product: ResolvedProduct; sketch: Sketch }) => {
  const unloaded = await timedPhase('load', () =>
    unloadedLinesOf({ target: context.target, config: context.config, product, sketch, warm: context.warm }),
  );

  if (unloaded.length > 0) return fail(`${unloaded.join('\n')}\n${sketch.target} does not load - fix it before ready`);

  const drifts = await timedPhase('mark-drift', () =>
    sampleMarkDriftLines({ target: context.target, config: context.config, product, sketch, warm: context.warm }),
  );

  if (drifts.length > 0)
    return fail(
      `${drifts.join('\n')}\n${sketch.target} draws one sample with different marks - align them before ready`,
    );

  const identical = await timedPhase('identical', () =>
    identicalRenderLines({ target: context.target, config: context.config, product, sketch, warm: context.warm }),
  );

  if (identical.length > 0)
    return fail(`${identical.join('\n')}\n${sketch.target} draws variants alike - fix them before ready`);

  const undeclared = await timedPhase('undeclared', () =>
    undeclaredLinesOf({ target: context.target, config: context.config, product, sketch, warm: context.warm }),
  );

  if (typeof undeclared === 'string') return fail(undeclared);
  if (undeclared.length > 0)
    return fail(
      `${undeclared.join('\n')}\n${sketch.target} draws controls no controls entry declares - declare them before ready`,
    );

  const changes = targetsInProduct({ product, sketch })
    ? await timedPhase('changes-shot', () =>
        variantChangesShown({ target: context.target, config: context.config, product, sketch, warm: context.warm }),
      )
    : null;
  const unchangedVariants = Array.isArray(changes)
    ? noChangedStateLinesOf({ sketch, changes, noVisibleChange: context.args.flags.has('--no-visible-change') })
    : [];

  if (unchangedVariants.length > 0)
    return fail(
      `${unchangedVariants.join('\n')}\n${sketch.target} draws a variant with no changed state - draw it before ready`,
    );

  const unviewed = Array.isArray(changes)
    ? unviewedShotLinesOf({
        target: context.target,
        invocation: context.invocation ?? repoInvocation({ root: context.target, subcommand: 'design' }),
        sketch,
        changes,
      })
    : [];

  if (unviewed.length > 0)
    return fail(`${unviewed.join('\n')}\n${sketch.target} draws a pixel diff - view its shot before ready`);

  if (!existsSync(resolve(sketch.dir, SKETCH_FILE)))
    return fail(`${sketch.target} is gone: another run merged or discarded it while this one checked it`);

  const ready =
    sketch.status === 'ready'
      ? sketch
      : markSketchReady({ checkout: context.target, sketch, author: authorOf(context.args) ?? undefined });

  if (typeof ready === 'string') return fail(ready);

  return timedPhase('auto-merge', () =>
    autoMerged({ context, product, sketch: ready, again: sketch.status === 'ready', changes }),
  );
};

const targetsInProduct = ({ product, sketch }: { product: ResolvedProduct; sketch: Sketch }) =>
  sketch.targets.every((key) => product.parts.some((part) => partKeyOf(part) === key));

const stillReady = (options: { sketch: Sketch; again: boolean; reason: string }) => {
  writeSketchFile({ ...options.sketch, mergeHold: { reason: options.reason, at: new Date().toISOString() } });

  if (options.again) console.log(`${options.sketch.target} is still ready`);

  return 0;
};

const gitIn = (target: string, ...args: string[]) => spawnPlain(['git', ...args], { cwd: target });

const mergeDirsOf = (product: ResolvedProduct) => [product.dir, ...(product.base ? [product.base.dir] : [])];

const cleanBesideSketch = (options: { target: string; product: ResolvedProduct; sketch: Sketch }) => {
  const status = gitIn(
    options.target,
    'status',
    '--porcelain',
    '-z',
    '--untracked-files=all',
    '--',
    ...mergeDirsOf(options.product),
  );
  const root = gitIn(options.target, 'rev-parse', '--show-toplevel');

  if (status.status !== 0 || root.status !== 0) return false;

  const top = root.stdout.trim();
  const sketchDir = realpathSync(options.sketch.dir);

  return status.stdout
    .split('\0')
    .filter((entry) => /^.. /.test(entry))
    .every((entry) => resolve(top, entry.slice(3)).startsWith(`${sketchDir}/`));
};

const committedMerge = (options: { target: string; product: ResolvedProduct; sketch: Sketch }) => {
  const dirs = mergeDirsOf(options.product);
  const added = gitIn(options.target, 'add', '--all', '--', ...dirs);
  const committed =
    added.status === 0
      ? gitIn(
          options.target,
          'commit',
          '-m',
          `feat(repo): Merge ${options.sketch.target}, no visible change`,
          '--',
          ...dirs,
        )
      : added;

  if (committed.status !== 0)
    console.warn(`Could not commit the merge: ${(committed.stderr || committed.stdout).trim()}`);

  return committed.status === 0;
};

const autoMerged = (options: {
  context: Context;
  product: ResolvedProduct;
  sketch: Sketch;
  again: boolean;
  changes: VariantChange[] | string | null;
}) => {
  const { context, product, sketch, again, changes } = options;

  if (!again) console.log(`${sketch.target} is ready`);

  for (const variant of sketch.variants.filter((candidate) => !rejectionOf(sketch, candidate))) {
    const { shared } = mergePreviewOf({ product, sketch, variant });

    if (shared.length > 0) console.log(`variant ${variant}: a shared/ edit reaches ${shared.join(', ')}`);
  }

  const noChange =
    changes === null ? 'new part, the user merges' : typeof changes === 'string' ? changes : noChangeOf(changes);

  if (noChange !== true) {
    console.log(`auto-merge skipped: ${noChange}`);

    return stillReady({ sketch, again, reason: noChange });
  }

  return mergedUnchanged({
    target: context.target,
    config: context.config,
    author: authorOf(context.args) ?? undefined,
    product,
    sketch,
  });
};

const mergedUnchanged = (options: {
  target: string;
  config: DesignConfig;
  author?: string;
  product: ResolvedProduct;
  sketch: Sketch;
}) => {
  const { target, config, author, product, sketch } = options;
  const variant = sketch.variants.find((candidate) => !rejectionOf(sketch, candidate)) ?? '';
  const commit = cleanBesideSketch({ target, product, sketch });
  const decided = decideSketch({ sketch, decision: { kind: 'pick', variant, ...originOf(author ?? '') } });

  if (typeof decided === 'string') return fail(decided);

  const written = sharedFilesOf(product);
  const before = written.map((file) => contentOf(file));
  const result = mergeSketch({
    target,
    config,
    product,
    sketch: decided,
    author,
    decidedBy: 'auto: no visible change',
  });

  if (!Array.isArray(result)) {
    writeSketchFile({
      ...sketch,
      mergeHold: {
        reason: result.reason,
        at: new Date().toISOString(),
        ...(result.dirty ? { dirty: result.dirty } : {}),
      },
    });
    console.warn(`${sketch.target} shows no visible change but did not merge: ${result.reason}`);

    return 0;
  }

  console.log(`No visible change in any state: merged ${sketch.targets.join(', ')} automatically.`);

  if (commit && committedMerge({ target, product, sketch })) {
    console.log(`Committed: feat(repo): Merge ${sketch.target}, no visible change`);

    return 0;
  }

  commitHunksLines({
    target,
    files: written.filter((file, index) => contentOf(file) !== before[index]),
    parts: sketch.targets,
  }).forEach((line) => console.log(line));

  return 0;
};

const stillDirtyOf = (options: { target: string; dirty: string[] }) => {
  const status = gitIn(options.target, 'status', '--porcelain', '--untracked-files=all', '--', ...options.dirty);

  return status.status !== 0 || status.stdout.trim() !== '';
};

/**
 * Merges every ready sketch whose automatic merge uncommitted files refused, once those files are committed or
 * reverted; `except` is a sketch target to leave alone.
 */
export const retriedHeldMerges = (options: {
  target: string;
  config: DesignConfig;
  author?: string;
  except?: string;
}) => {
  const { target, config, author, except } = options;

  for (const name of Object.keys(config.products ?? {})) {
    const productDir = productDirOf({ target, product: name });
    const held = listSketches({ productDir, product: name }).filter(
      (sketch): sketch is Sketch =>
        typeof sketch !== 'string' &&
        sketch.status === 'ready' &&
        !!sketch.mergeHold?.dirty &&
        sketch.target !== except &&
        !stillDirtyOf({ target, dirty: sketch.mergeHold.dirty }),
    );

    if (held.length === 0) continue;

    const product = oneProductOf({ target, config, asked: name });

    if (typeof product === 'string') continue;

    for (const sketch of held) {
      console.log(`${sketch.target}: the uncommitted edits that held its automatic merge are gone - merging it now`);
      mergedUnchanged({ target, config, author, product, sketch });
    }
  }
};

const contentOf = (file: string) => (existsSync(file) ? readFileSync(file, 'utf8') : null);

const sharedFilesOf = (product: ResolvedProduct) => [
  resolve(product.dir, MERGED_FILE),
  ...(product.base ? [resolve(product.base.dir, MERGED_FILE)] : []),
];

const commitHunksLines = ({ target, files, parts }: { target: string; files: string[]; parts: string[] }) =>
  files.length === 0
    ? []
    : [
        'Shared files written; commit only the hunks of this sketch, never the whole file another session also edits:',
        ...files.map(
          (file) =>
            `  et design commit-hunks ${relative(target, file)} ${parts.map((part) => `--part ${part}`).join(' ')}`,
        ),
      ];

const noteProblemsBefore = ({
  target,
  sketch,
  variant,
  before,
}: {
  target: string;
  sketch: Sketch;
  variant: string;
  before: Problem[];
}) =>
  before.forEach((problem) =>
    console.warn(
      `NOTE ${sketch.target} ${variant}: ${problem.rule} ${relative(target, problem.file)}: ${problem.message} (there before)`,
    ),
  );

const variantGateProblemsOf = (options: {
  target: string;
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
  problems: Problem[];
}): Problem[] => [...options.problems, ...formatProblemsOf(options), ...unusedInVariantOf(options)];

const busyOfVariant = (busy: BusyState[], sketch: SketchVariant) =>
  busy
    .filter((entry) => entry.sketch?.target === sketch.target && entry.sketch.variant === sketch.variant)
    .map(({ part, state }) => ({ part, state }));

const openPointLinesOf = ({
  product,
  sketch,
  busy = [],
}: {
  product: ResolvedProduct;
  sketch: Sketch;
  busy?: BusyState[];
}) => {
  const pointLinesOf = (variant: string, list: PartOpenPoints[]) =>
    openPointsText(product.name, list)
      .slice(1)
      .map((line) => `${sketch.target} ${variant}: ${line.trim()}`);
  const points = sketch.variants
    .filter((variant) => !rejectionOf(sketch, variant))
    .map((variant) => ({
      variant,
      ...sketchOpenPointsOf({
        merged: product,
        variant: overlaySketch({ product, sketch, variant }),
        targets: sketch.targets,
        busy: { merged: [], variant: busyOfVariant(busy, { target: sketch.target, variant }) },
      }),
    }));

  return {
    added: points.flatMap(({ variant, added }) => pointLinesOf(variant, added)),
    inherited: points.flatMap(({ variant, inherited }) => pointLinesOf(variant, inherited)),
  };
};

const roundNoteRefusalOf = (sketch: Sketch): string | null => {
  const running = runningRoundOf(sketch);

  return running.note.trim() === ''
    ? `${sketch.target} round ${running.key} has no note - set it with: sketch round ${sketch.target} ${running.key} --note "<what the round shows>" --by <model id>`
    : null;
};

const roundNotReadyProblemOf = (sketch: Sketch): string | null =>
  sketch.status === 'ready' || sketch.hold
    ? null
    : `ROUND-NOT-READY ${sketch.target}: round ${runningRoundOf(sketch).key} is drawn but still in progress - run \`design sketch ready ${sketch.target}\``;

const unloadedLinesOf = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  sketch: Sketch;
  warm?: WarmDraw;
}) => (await variantsThatDoNotLoad(options)).map((line) => `${options.sketch.target} ${line}`);

const undeclaredLinesOf = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  sketch: Sketch;
  warm?: WarmDraw;
}) => {
  const { sketch } = options;
  const lines: string[] = [];

  for (const variant of sketch.variants.filter((name) => !rejectionOf(sketch, name))) {
    const { changed } = mergePreviewOf({ product: options.product, sketch, variant });
    const added = await addedUndeclaredControlsOf({
      ...options,
      sketch: { target: sketch.target, variant },
      parts: changed,
    });

    if ('unavailable' in added) return added.unavailable;

    lines.push(...added.lines);
  }

  return lines;
};

const baseCommitOf = (options: { context: Context; product: ResolvedProduct; sketch: Sketch }) => {
  const { context, product, sketch } = options;
  const dirs = (staleBaseOf({ product, sketch }) ?? []).flatMap((key) => {
    const part = product.parts.find((candidate) => partKeyOf(candidate) === key);

    return part ? [dirname(part.file)] : [];
  });

  if (dirs.length === 0) return null;

  const log = spawnPlain(['git', 'log', '-1', '--format=%h', '--', ...dirs], { cwd: context.target });

  return log.status === 0 && log.stdout.trim() ? log.stdout.trim() : null;
};

const readyRefusalOf = (
  context: Context,
  { product, sketch }: { product: ResolvedProduct; sketch: Sketch },
): number | null => {
  const lineOf = (variant: string, problem: Problem) =>
    `${sketch.target} ${variant}: ${problem.rule} ${relative(context.target, problem.file)}: ${problem.message}`;
  const stale = staleBasesOf(context, { product, targets: new Set([sketch.target]) });

  if (stale.length > 0) {
    const commit = baseCommitOf({ context, product, sketch });

    return fail(
      `${stale.map((problem) => problem.line).join('\n')}\n${sketch.target} is stale${commit ? ` (base changed in ${commit})` : ''} - rebase it before ready`,
    );
  }

  const found = variantProblemsOf({ product, sketch });

  found.forEach((entry) => noteProblemsBefore({ target: context.target, ...entry }));

  const problems = found
    .filter(({ variant }) => !rejectionOf(sketch, variant))
    .flatMap(({ variant, problems }) =>
      variantGateProblemsOf({ target: context.target, product, sketch, variant, problems }).map((problem) =>
        lineOf(variant, problem),
      ),
    );

  sketch.variants.forEach((variant) =>
    variantWarningsOf({ target: context.target, product, sketch, variant }).forEach((warning) =>
      console.warn(`${sketch.target} ${variant}: ${warning}`),
    ),
  );

  if (problems.length > 0) return fail(`${problems.join('\n')}\n${sketch.target} has problems - fix them before ready`);

  const { added, inherited } = openPointLinesOf({ product, sketch });

  inherited.forEach((line) => console.log(`NOTE ${line} (inherited from the merged part)`));

  sketch.variants
    .filter((variant) => !rejectionOf(sketch, variant))
    .forEach((variant) =>
      instantLinesOf(overlaySketch({ product, sketch, variant }), sketch.targets).forEach((line) =>
        console.log(`NOTE ${sketch.target} ${variant}: ${line}`),
      ),
    );

  if (added.length > 0) return fail(`${added.join('\n')}\n${sketch.target} adds open points - close them before ready`);

  const noNote = roundNoteRefusalOf(sketch);

  return noNote === null ? null : fail(noNote);
};

const rebased = (context: Context) =>
  withSketch(context, ({ product, sketch }) => {
    const kept = context.args.flags.has('--ported');
    const { ported, conflicts } = portBaseChanges({ target: context.target, product, sketch, keepConflicts: kept });

    if (kept) conflicts.forEach((line) => console.log(`KEPT ${line} (ported by hand)`));
    else if (conflicts.length > 0)
      return fail(
        `${conflicts.join('\n')}\n${sketch.target} not rebased - port these by hand, then run sketch rebase again`,
      );

    ported.forEach(({ variant, file, how }) => console.log(`PORTED ${variant}: ${file} (${how})`));
    rebaseSketch({ product, sketch });
    console.log(`${sketch.target} now compares with the product as it is`);

    if (ported.length > 0 && sketch.status === 'ready')
      console.log(`variants changed - run sketch ready ${sketch.target} to check them again`);

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

export const beforeLinesOf = ({ sketches, before }: { sketches: Sketch[]; before: RenderIssue[] }) =>
  [...new Set(sketches)].flatMap((sketch) =>
    groupedIssueLinesOf(
      before
        .filter((issue) => sketch.targets.includes(issue.part))
        .map((issue) => ({ ...issue, sketch: { target: sketch.target, variant: 'before' } })),
    ),
  );

const unchangedAffectedOf = (options: {
  target: string;
  config: DesignConfig;
  warm: WarmDraw;
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
  affected: string[];
}) =>
  loadingOn(options, async (server) =>
    Object.fromEntries(
      await Promise.all(
        options.affected.map(
          async (part) =>
            [
              part,
              await unchangedStatesOf({
                ...options,
                part,
                load: ({ file, product, sketch }) => server.ssrLoadModule(productModuleIdOf({ file, product, sketch })),
              }),
            ] as const,
        ),
      ),
    ),
  );

const renderedVariantsOf = async ({
  target,
  config,
  product,
  entries,
  drawn,
  warm,
}: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  entries: { sketch: Sketch; variant: string }[];
  drawn: boolean;
  warm?: WarmDraw;
}) => {
  const jobs = await Promise.all(
    entries.map(async ({ sketch, variant }) => {
      const preview = mergePreviewOf({ product, sketch, variant });

      return {
        product: product.name,
        sketch: { target: sketch.target, variant },
        parts: [...preview.changed, ...preview.affected],
        unchanged: warm
          ? await unchangedAffectedOf({ target, config, warm, product, sketch, variant, affected: preview.affected })
          : {},
      };
    }),
  );
  for (const { sketch, unchanged } of jobs)
    for (const [part, states] of Object.entries(unchanged).filter(([, states]) => states.length > 0))
      console.log(
        `NOTE ${sketch.target} ${sketch.variant}: ${part} draws ${states.length} state${states.length === 1 ? '' : 's'} as merged, not inspected`,
      );

  const rendered = await renderIssuesOf({
    target,
    config,
    warm,
    jobs,
    onProgress: (line) => console.error(line),
    before: [...new Set(entries.flatMap(({ sketch }) => sketch.targets))].map((part) => ({
      product: product.name,
      part,
    })),
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
    const { noVerdict } = rendered;

    if (noVerdict)
      [...new Set(entries.map((entry) => entry.sketch.target))].forEach((sketchTarget) =>
        console.error(noVerdictLineOf(sketchTarget, noVerdict)),
      );
    else groupedIssueLinesOf(rendered.issues).forEach((line) => console.error(line));

    beforeLinesOf({ sketches: entries.map((entry) => entry.sketch), before: rendered.before ?? [] }).forEach((line) =>
      console.log(line),
    );
  }

  return rendered;
};

const noChangedStateLines = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  sketch: Sketch;
  warm?: WarmDraw;
  args: Args;
}) => {
  const { args, ...shots } = options;

  if (!targetsInProduct(shots)) return [];

  const changes = await variantChangesShown(shots);

  return Array.isArray(changes)
    ? noChangedStateLinesOf({ sketch: shots.sketch, changes, noVisibleChange: args.flags.has('--no-visible-change') })
    : [];
};

const checked = async (context: Context) => {
  const { target, config, args } = context;
  const product = sketchProductOf(context);

  if (typeof product === 'string') return fail(product);

  const asked = args.positional[0];
  const { unreadable, variants } = timedPhase('gates', () => openSketchProblemsOf(product));
  const named = asked === undefined ? variants : variants.filter((entry) => entry.sketch.target === asked);

  if (asked !== undefined && named.length === 0) return fail(`NO SKETCH on ${asked} in ${product.name}`);

  const isSkipped = ({ sketch, variant }: { sketch: Sketch; variant: string }) => Boolean(rejectionOf(sketch, variant));
  const chosen = named.filter((entry) => !isSkipped(entry));

  named
    .filter(isSkipped)
    .forEach(({ sketch, variant }) =>
      console.log(
        `NOTE ${sketch.target} ${variant}: ${rejectionOf(sketch, variant)?.status === 'withdrawn' ? 'withdrawn' : 'rejected'}, not checked`,
      ),
    );

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
    reportedReopen(sketch);

    if (product.config.noteLanguage)
      noteLanguageWarningsOf(sketch, product.config.noteLanguage).forEach((warning) => console.warn(warning));

    if (sketch.hold) console.warn(`HELD ${sketch.target}: until ${sketch.hold.until}`);
  });

  const stale = staleBasesOf(context, { product, targets: new Set(chosen.map((entry) => entry.sketch.target)) });

  stale.forEach((problem) => console.error(problem.line));
  failed ||= stale.length > 0;

  for (const { sketch, variant, problems, before } of chosen) {
    const typed = timedPhase(`tsc ${variant}`, () => typecheckVariant({ target, product, sketch, variant }));

    noteProblemsBefore({ target, sketch, variant, before });

    variantWarningsOf({ target, product, sketch, variant }).forEach((warning) =>
      console.warn(`${sketch.target} ${variant}: ${warning}`),
    );

    const all = [
      ...variantGateProblemsOf({ target, product, sketch, variant, problems }),
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

  if (!failed)
    for (const sketch of new Set(chosen.map((entry) => entry.sketch)))
      (
        await timedPhase('aktuell', () =>
          aktuellPlaceholderWarnings({ target, config, product, sketch, warm: context.warm }),
        )
      ).forEach((warning) => console.warn(warning));

  const rendered = failed
    ? null
    : await timedPhase('render-check', () =>
        renderedVariantsOf({
          target,
          config,
          product,
          entries: chosen,
          drawn: true,
          warm: context.warm,
        }),
      );
  const busy = rendered !== null && 'issues' in rendered ? (rendered.busy ?? []) : [];

  if (rendered !== null && 'issues' in rendered)
    frameBudgetWarningsOf({
      drawn: rendered.drawn,
      targets: [...new Set(chosen.map((entry) => entry.sketch))].map((sketch) => ({
        target: sketch.target,
        part: sketch.targets[0] ?? sketch.target,
      })),
    }).forEach((warning) => console.warn(warning));

  let refused = 0;
  let notReady = false;
  const refuse = (lines: string[]) => {
    lines.forEach((line) => console.warn(`ready will refuse: ${line}`));
    refused += lines.length;
  };

  for (const sketch of new Set(chosen.map((entry) => entry.sketch))) {
    const unloaded = await timedPhase('load', () =>
      unloadedLinesOf({ target, config, product, sketch, warm: context.warm }),
    );

    const before = refused;

    refuse([
      ...unloaded,
      ...openPointLinesOf({ product, sketch, busy }).added,
      ...[roundNoteRefusalOf(sketch) ?? []].flat(),
    ]);

    if (!failed && unloaded.length === 0) {
      refuse(
        await timedPhase('mark-drift', () =>
          sampleMarkDriftLines({ target, config, product, sketch, warm: context.warm }),
        ),
      );
      refuse(
        await timedPhase('identical', () =>
          identicalRenderLines({ target, config, product, sketch, warm: context.warm }),
        ),
      );
      refuse(
        await timedPhase('changes-shot', () =>
          noChangedStateLines({ product, sketch, target, config, warm: context.warm, args: context.args }),
        ),
      );
    }

    if (!failed && refused === before) {
      const problem = roundNotReadyProblemOf(sketch);

      if (problem !== null) {
        console.error(problem);
        notReady = true;
      }
    }
  }

  const staleSince =
    rendered === null
      ? []
      : staleBasesOf(context, { product, targets: new Set(chosen.map((entry) => entry.sketch.target)) }).filter(
          (problem) => !stale.some((before) => before.line === problem.line),
        );

  staleSince.forEach((problem) => console.error(problem.line));

  if (failed || staleSince.length > 0) return 1;

  if (rendered !== null && 'issues' in rendered && (rendered.noVerdict || rendered.issues.length > 0)) return 1;

  if (notReady) return 1;

  console.log(refused > 0 ? `check ok - ready will refuse ${refused} (see above)` : 'ok');

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

const merged = (context: Context) =>
  withSketch(context, ({ product, sketch }) => {
    const {
      '--note': note,
      '--variant': flagVariant,
      '--allowed-by': planRef,
      '--decided-by': decidedBy,
    } = context.args.values;

    const replaceNote = context.args.flags.has('--replace-note');

    if (context.args.positional.length > 1)
      return fail(`usage: sketch merge <layer>/<name> [--note <reason>] - it merges the variant the user picked`);
    if (replaceNote && (note ?? '').trim() === '') return fail('--replace-note needs --note <the new part note>');
    if ((flagVariant === undefined) !== (planRef === undefined))
      return fail(
        '--variant and --allowed-by go together: name the only live variant and the plan that allows the merge',
      );

    if (decidedBy !== undefined && (decidedBy.trim() === '' || planRef !== undefined))
      return fail('--decided-by needs a name and does not go with --allowed-by, which records the plan');

    const by = authorOf(context.args) ?? undefined;
    const allowed =
      flagVariant !== undefined && planRef !== undefined && sketch.decision?.kind !== 'pick'
        ? { variant: flagVariant, planRef, editRef: editRefOf({ target: context.target, sketch, planRef }) }
        : undefined;
    const result = timedPhase('merge', () =>
      mergeAndRecord({
        target: context.target,
        config: context.config,
        product,
        sketch,
        note,
        replaceNote,
        by,
        decidedBy: decidedBy?.trim(),
        allowed,
      }),
    );

    if (typeof result === 'string') return fail(result);

    console.log(`merged ${sketch.target} variant ${result.variant} into ${product.name}: ${result.parts.join(', ')}`);

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
    `  ${rejection.status === 'withdrawn' ? `withdrawn by ${rejection.withdrawnBy ?? 'the agent'}` : `rejected by the ${rejection.by}`} at ${rejection.decidedAt}${verdictOriginOf(rejection.by, rejection.reasonBy)}${rejection.reason ? `: ${rejection.reason}` : ''}`,
    ...(rejection.reopened
      ? [
          `  reopened by the ${rejection.reopened.by} at ${rejection.reopened.decidedAt}${rejection.reopened.reason ? `: ${rejection.reopened.reason}` : ''}`,
        ]
      : []),
  ]);

  return [
    `${sketch.target} variant ${variant}: ${rejectionOf(sketch, variant) ? (rejectionOf(sketch, variant)?.status === 'withdrawn' ? 'withdrawn' : 'rejected') : 'live'}`,
    ...lines,
  ];
};

const judged = (kind: 'reject' | 'reopen') => (context: Context) =>
  withSketch(context, ({ sketch }) => {
    const { positional, values } = context.args;
    const variant = values['--variant'];
    const reason = values['--reason']?.trim() || undefined;
    const author = authorOf(context.args) ?? '';
    const by: SketchVerdictBy = author === 'designer' ? 'designer' : 'agent';

    if (positional.length !== 1 || !variant)
      return fail(
        `usage: sketch ${kind} <layer>/<name> --variant <key> [--reason <text>] --by <model id | designer> [--product <name>]`,
      );

    const invalid = verdictByProblemOf(author);

    if (invalid) return fail(invalid);

    const decision: SketchVariantVerdict =
      kind === 'reject' && reason && rejectionOf(sketch, variant)
        ? { kind: 'reason', variant, reason, by }
        : { kind, variant, ...(reason ? { reason } : {}), by };
    const decided = decideSketch({ sketch, decision });

    if (typeof decided === 'string') return fail(decided);

    verdictLinesOf(decided, variant).forEach((line) => console.log(line));

    return 0;
  });

const withdrawn = (context: Context) => {
  const found = productAndSketchOf(context);

  if (typeof found === 'string') return fail(found);

  return withdrawnVariant(context, found);
};

const withdrawnVariant = async (
  context: Context,
  { product, sketch }: { product: ResolvedProduct; sketch: Sketch },
) => {
  const { positional, values } = context.args;
  const variant = values['--variant'];
  const by = authorOf(context.args) ?? '';

  if (positional.length !== 1 || !variant)
    return fail('usage: sketch withdraw <layer>/<name> --variant <key> --by <model id> [--product <name>]');
  if (by === 'designer')
    return fail('sketch withdraw is for the agent that drew the variant: --by must be a model id, not designer');

  const invalid = verdictByProblemOf(by);

  if (invalid) return fail(invalid);
  if (!sketch.variants.includes(variant))
    return fail(`${sketch.target} has no variant "${variant}" - it has ${sketch.variants.join(', ')}`);
  if (!authorsOf(sketch, variant).includes(by))
    return fail(
      `${sketch.target} variant ${variant} was not drawn by ${by} - only the agent that drew it withdraws it`,
    );

  const identical = await identicalRenders({
    target: context.target,
    config: context.config,
    product,
    sketch,
    warm: context.warm,
  });
  const twin = identical.find((render) => render.variant === variant && render.sibling !== null);

  if (!twin)
    return fail(
      `${sketch.target} variant ${variant} does not draw the same pixels as a sibling variant in its first changed state - redraw it or ask for a reject`,
    );

  const result = withdrawVariant({ sketch, variant, by, reason: `identisch mit ${twin.sibling}` });

  if (typeof result === 'string') return fail(result);

  console.log(`withdrew ${sketch.target} variant ${variant} (identisch mit ${twin.sibling})`);

  return 0;
};

const COMMANDS: Record<string, (context: Context) => number | Promise<number>> = {
  new: created,
  variant: varied,
  round: roundEdited,
  note: noteEdited,
  covers: coversEdited,
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
  target: targetAdded,
  reject: judged('reject'),
  reopen: judged('reopen'),
  withdraw: withdrawn,
};

/** The value flags and switches the usage line of a sketch command names. */
const flagsOf = (command: string) => {
  const line = SKETCH_USAGE.find((usage) => usage.startsWith(`sketch ${command} `)) ?? '';
  const named = [...line.matchAll(/(--[a-z-]+)( (?=[<a-z0-9]))?/gu)];
  const unique = (flags: string[]) => [...new Set(flags)];

  return {
    values: unique(named.filter(([, , value]) => value).map(([, flag]) => flag ?? '')),
    switches: unique(named.filter(([, , value]) => !value).map(([, flag]) => flag ?? '')),
  };
};

/**
 * `et design sketch <command> …` opens, adds variants to, reports on, readies, checks, previews, rebases, merges and
 * discards sketches, and rejects, reopens and withdraws their variants.
 */
export const designSketch = (options: { target: string; argv: string[]; invocation: string; warm?: WarmDraw }) => {
  const { target, argv, invocation, warm } = options;
  const [command = '', ...rest] = argv;
  const run = COMMANDS[command];
  const args = argsOf(rest, flagsOf(command));
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

  if (RETRIES.has(command)) {
    const named = parseTarget(args.positional[0] ?? '');

    retriedHeldMerges({
      target,
      config,
      author: authorOf(args) ?? undefined,
      except: typeof named === 'string' ? undefined : partKeyOf(named),
    });
  }

  return run({ target, config, args, invocation, warm });
};
