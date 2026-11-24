import { TypecheckResult } from '../../typecheck';
import { isEditOldBaseFile } from './edit-old-base-folder';
import { ruleProblemsOf } from '../check-system';
import { Problem } from '../problem';
import { dirname, relative } from 'path';
import { partDependenciesOf } from '../imports';
import { LAYERS } from '../layers';
import { partFilesOf } from '../product';
import { existsSync, readFileSync } from 'fs';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { goneSketchCommentWarningsOf } from '../rules/stale-comment';
import { typecheckProduct, typecheckProductAsync } from '../system-tsconfig';
import { duplicateClassWarningsOf } from './duplicate-class';
import { mergedLayoutProblemsOf } from './merged-layout';
import { lentVariantOf, openSketchesDrawingOf, overlaySketch, SketchedProduct } from './overlay';
import { sharedClassWarningsOf } from './shared-class';
import { unusedFileWarningsOf } from './unused-files';
import { stateNamesOf, stateSourcesOf, withMadeBy, withNote } from './part-definition';
import { EDIT_OLD } from './edit-sketch';
import { isEditSketch } from './merged-parts';
import {
  leftoverSketchFoldersOf,
  listSketches,
  rejectionOf,
  Sketch,
  sketchFolderOf,
  SketchRound,
  variantDirOf,
} from './sketch';

/** `problems` are the ones a variant brings in; `before` are the ones the product already has, which do not fail the variant. */
export type VariantProblems = { sketch: Sketch; variant: string; problems: Problem[]; before: Problem[] };

const droppedStatesOf = (options: {
  product: ResolvedProduct;
  overlaid: SketchedProduct;
  allowed: string[];
}): Problem[] => {
  const { product, overlaid, allowed } = options;

  return overlaid.parts
    .filter((part) => overlaid.sketched.includes(partKeyOf(part)))
    .flatMap((part) => {
      const own = product.parts.find((candidate) => partKeyOf(candidate) === partKeyOf(part));
      const before = own ? stateNamesOf(own.source) : null;
      const after = stateNamesOf(part.source);

      if (before === null || after === null) return [];

      const dropped = before.filter((state) => !after.includes(state) && !allowed.includes(state));

      return dropped.length === 0
        ? []
        : [
            {
              rule: 'STATES',
              file: part.file,
              message: `drops the state${dropped.length === 1 ? '' : 's'} ${dropped.join(', ')} that ${partKeyOf(part)} has in ${product.name} - a variant keeps every state of the part`,
            },
          ];
    });
};

const changedUntouchedStatesOf = (options: {
  product: ResolvedProduct;
  overlaid: SketchedProduct;
  round: SketchRound | undefined;
}): Problem[] => {
  const { product, overlaid, round } = options;

  if (!round?.asks || round.asks.length === 0) return [];

  const named = new Set(round.note.match(/[\w-]+/gu) ?? []);
  const touched = [...round.asks, ...(round.drops ?? [])];

  return overlaid.parts
    .filter((part) => overlaid.sketched.includes(partKeyOf(part)))
    .flatMap((part) => {
      const own = product.parts.find((candidate) => partKeyOf(candidate) === partKeyOf(part));
      const before = own ? stateSourcesOf(own.source) : null;
      const after = stateSourcesOf(part.source);

      if (before === null || after === null) return [];

      const changed = Object.keys(before).filter(
        (state) => state in after && after[state] !== before[state] && !touched.includes(state) && !named.has(state),
      );

      return changed.length === 0
        ? []
        : [
            {
              rule: 'STATES',
              file: part.file,
              message: `changes the state${changed.length === 1 ? '' : 's'} ${changed.join(', ')} of ${partKeyOf(part)} that round ${round.key} does not ask in - restore ${changed.length === 1 ? 'it' : 'them'}, add ${changed.length === 1 ? 'it' : 'them'} to --asks, or name ${changed.length === 1 ? 'it' : 'them'} in the round note`,
            },
          ];
    });
};

const COMPOSITIONS = new Set<string>(LAYERS.filter((layer) => layer === 'elements' || layer === 'pages'));

const contentOf = (part: { file: string; css?: string | null }) =>
  [part.file, part.css].map((file) => (file && existsSync(file) ? readFileSync(file, 'utf8') : '')).join('\0');

const differingSubPartsOf = (sketch: Sketch): Map<string, Problem[]> => {
  const problems = new Map<string, Problem[]>();

  if (isEditSketch(sketch) || !sketch.targets.every((key) => COMPOSITIONS.has(key.split('/')[0] ?? '')))
    return problems;

  const live = sketch.variants.filter((variant) => !rejectionOf(sketch, variant));
  const held = new Map(
    live.map((variant) => [
      variant,
      new Map(
        partFilesOf(variantDirOf(sketch, variant))
          .parts.filter((part) => !sketch.targets.includes(partKeyOf(part)))
          .map((part) => [partKeyOf(part), part] as const),
      ),
    ]),
  );
  const used = new Set(
    live.flatMap((variant) =>
      partFilesOf(variantDirOf(sketch, variant))
        .parts.filter((part) => sketch.targets.includes(partKeyOf(part)))
        .flatMap((part) =>
          partDependenciesOf({ ...part, origin: 'product', source: readFileSync(part.file, 'utf8'), cssSource: null }),
        )
        .map(partKeyOf),
    ),
  );
  const keys = new Set([...held.values()].flatMap((parts) => [...parts.keys()]).filter((key) => used.has(key)));

  for (const key of keys) {
    const contents = new Set(
      live.map((variant) => {
        const part = held.get(variant)?.get(key);

        return part ? contentOf(part) : null;
      }),
    );

    if (contents.size < 2) continue;

    for (const variant of live)
      problems.set(variant, [
        ...(problems.get(variant) ?? []),
        {
          rule: 'SKETCH',
          file: held.get(variant)?.get(key)?.file ?? variantDirOf(sketch, variant),
          message: `the variants of ${sketch.target} differ in ${key} - a composition's variants differ only in arrangement: change ${key} in a sketch of its own and import it as @system/${key}`,
        },
      ]);
  }

  return problems;
};

const unlentPartsOf = (sketch: Sketch, overlaid: SketchedProduct): Problem[] => {
  const has = new Set(overlaid.parts.map(partKeyOf));
  const held = overlaid.parts.filter((part) => overlaid.sketched.includes(partKeyOf(part)));
  const missing = new Set(
    held
      .flatMap((part) => partDependenciesOf(part))
      .map(partKeyOf)
      .filter((key) => !has.has(key)),
  );

  return openSketchesDrawingOf(sketch, missing).flatMap(({ part, sketch: other }) =>
    lentVariantOf(other)
      ? []
      : [
          {
            rule: 'SKETCH',
            file: sketch.dir,
            message: `${part} is new in the open sketch on ${other.target}, which recommends no variant - run design sketch recommend ${other.target} --variant <key> --by <model id>`,
          },
        ],
  );
};

/** The rule problems of each variant of a sketch laid over the product, and the states it drops from a part. */
export const variantProblemsOf = (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  productProblems?: Problem[];
}): VariantProblems[] => {
  const keyOf = (dir: string, problem: Problem) => `${problem.rule} ${relative(dir, problem.file)}: ${problem.message}`;
  const had = new Set(
    (options.productProblems ?? ruleProblemsOf(options.product)).map((problem) => keyOf(options.product.dir, problem)),
  );

  const differing = differingSubPartsOf(options.sketch);

  return options.sketch.variants.map((variant) => {
    const overlaid = overlaySketch({ ...options, variant });
    const lentDirs = overlaid.parts
      .filter((part) => overlaid.borrowed.some((entry) => entry.part === partKeyOf(part)))
      .map((part) => dirname(part.file));
    const isLent = (problem: Problem) => lentDirs.some((dir) => !relative(dir, problem.file).startsWith('..'));
    const round = options.sketch.rounds.find((entry) => entry.key === options.sketch.variantInfo[variant]?.round);
    const variantDir = variantDirOf(options.sketch, variant);
    const laidOver = ruleProblemsOf(overlaid);
    const seen = new Set(laidOver.map((problem) => keyOf(options.product.dir, problem)));
    const carried = mergedLayoutProblemsOf({ ...options, variant, overlaid }).filter(
      ({ problem }) => !seen.has(keyOf(options.product.dir, problem)),
    );
    const carriedWasThere = new Set(
      carried.flatMap(({ problem, mergedFile }) =>
        had.has(keyOf(options.product.dir, { ...problem, file: mergedFile })) ? [problem] : [],
      ),
    );
    const wasThere = (problem: Problem) =>
      carriedWasThere.has(problem) ||
      isEditOldBaseFile(problem.file) ||
      had.has(keyOf(relative(variantDir, problem.file).startsWith('..') ? options.product.dir : variantDir, problem));
    const found = [...laidOver, ...carried.map(({ problem }) => problem)].filter((problem) => !isLent(problem));
    const target = overlaid.parts.find((part) => partKeyOf(part) === partKeyOf(options.sketch));
    const metadataProblem: Problem[] =
      target && (withNote(target.source, '') === null || withMadeBy(target.source, ['author']) === null)
        ? [
            {
              rule: 'SKETCH',
              file: target.file,
              message: `merge cannot write metadata to ${options.sketch.target} - define it with definePart({ ..., note: '...' }) in this file`,
            },
          ]
        : [];

    return {
      sketch: options.sketch,
      variant,
      problems: [
        ...found.filter((problem) => !wasThere(problem)),
        ...metadataProblem,
        ...(differing.get(variant) ?? []),
        ...unlentPartsOf(options.sketch, overlaid),
        ...(isEditSketch(options.sketch) && variant === EDIT_OLD
          ? []
          : [
              ...droppedStatesOf({ product: options.product, overlaid, allowed: round?.drops ?? [] }),
              ...changedUntouchedStatesOf({ product: options.product, overlaid, round }),
            ]),
      ],
      before: found.filter(wasThere),
    };
  });
};

/** Warnings that do not fail a variant: a class two stylesheets of one part both define, a class of `shared/` the variant restyles, a file nothing imports. */
export const variantWarningsOf = (options: {
  target: string;
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
}): string[] => {
  const overlaid = overlaySketch(options);

  return [
    ...duplicateClassWarningsOf({ target: options.target, product: overlaid }),
    ...sharedClassWarningsOf({ target: options.target, product: overlaid }),
    ...unusedFileWarningsOf(options),
    ...goneSketchCommentWarningsOf(options.product),
  ];
};

/**
 * The rule problems of every variant of every open sketch of a product, or only of the sketch on `target`. A sketch
 * folder that cannot be read is a `SKETCH` problem of its own; `leftovers` names the folders that hold no sketch at all.
 */
export const openSketchProblemsOf = (product: ResolvedProduct, { target }: { target?: string } = {}) => {
  const sketches = listSketches({ productDir: product.dir, product: product.name });
  const productProblems = ruleProblemsOf(product);

  return {
    unreadable: sketches.flatMap((sketch): Problem[] =>
      typeof sketch === 'string' ? [{ rule: 'SKETCH', file: product.dir, message: sketch }] : [],
    ),
    variants: sketches.flatMap((sketch) =>
      typeof sketch === 'string' || (target !== undefined && sketch.target !== target)
        ? []
        : variantProblemsOf({ product, sketch, productProblems }),
    ),
    leftovers: leftoverSketchFoldersOf(product.dir),
  };
};

export type OpenSketchListing = {
  unreadable: Problem[];
  variants: { target: string; variant: string; problems: Problem[] }[];
};

/** `openSketchProblemsOf` as plain data a worker can post: each variant names its sketch by target. */
export const openSketchListingOf = (product: ResolvedProduct): OpenSketchListing => {
  const { unreadable, variants } = openSketchProblemsOf(product);

  return {
    unreadable,
    variants: variants.map(({ sketch, variant, problems }) => ({ target: sketch.target, variant, problems })),
  };
};

type VariantOptions = { target: string; product: ResolvedProduct; sketch: Sketch; variant: string };

const variantTypecheckOf = ({ target, product, sketch, variant }: VariantOptions) => ({
  target,
  product: {
    ...overlaySketch({ product, sketch, variant }),
    name: `${product.name}.sketch.${sketchFolderOf(sketch)}.${variant}`,
  },
});

/** Runs `tsc` over one variant laid over the product, with a tsconfig of its own. */
export const typecheckVariant = (options: VariantOptions): TypecheckResult =>
  typecheckProduct(variantTypecheckOf(options));

/** `typecheckVariant` in a child process that does not block the event loop. */
export const typecheckVariantAsync = (options: VariantOptions): Promise<TypecheckResult> =>
  typecheckProductAsync(variantTypecheckOf(options));

/**
 * Starts a `tsc` run for each variant, at most `limit` at a time, so they run on other cores while the caller keeps
 * working. The first `limit` runs start before it returns, so synchronous work right after it does not hold them back.
 * The map is keyed by `variantKeyOf`.
 */
export const startVariantTypechecks = (options: {
  entries: readonly { sketch: Sketch; variant: string }[];
  limit: number;
  run: (entry: { sketch: Sketch; variant: string }) => Promise<TypecheckResult>;
}): Map<string, Promise<TypecheckResult>> => {
  const { entries, limit, run } = options;
  const waiting: (() => void)[] = [];
  let running = 0;
  const release = () => {
    const next = waiting.shift();

    if (next) next();
    else running -= 1;
  };
  const go = (entry: { sketch: Sketch; variant: string }) => {
    try {
      return run(entry).finally(release);
    } catch (error) {
      release();

      return Promise.reject(error);
    }
  };
  const started = (entry: { sketch: Sketch; variant: string }) => {
    if (running >= limit) return new Promise<void>((resolve) => waiting.push(resolve)).then(() => go(entry));

    running += 1;

    return go(entry);
  };

  return new Map(
    entries.map((entry) => {
      const result = started(entry);

      result.catch(() => undefined);

      return [variantKeyOf(entry.sketch.target, entry.variant), result];
    }),
  );
};

export const variantKeyOf = (target: string, variant: string) => `${target}\0${variant}`;
