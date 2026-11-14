import { dirname, relative, resolve } from 'path';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { baselineOf, FIXTURES_KEY, partInputsOf } from './baseline';
import { variantProblemsOf } from './check-sketches';
import { journaledRebaseOf } from './rebase-port';
import { listSketches, rejectionOf, Sketch, writeSketchFile } from './sketch';
import { staleBaseOf } from './stale-base';

const changedKeysOf = (before: Record<string, string>, now: Record<string, string>) =>
  new Set([...Object.keys(before), ...Object.keys(now)].filter((key) => before[key] !== now[key]));

const recheckOf = (options: { target: string; product: ResolvedProduct; sketch: Sketch }) =>
  variantProblemsOf(options).flatMap(({ variant, problems }) =>
    rejectionOf(options.sketch, variant)
      ? []
      : problems.map(
          (problem) => `${variant}: ${problem.rule} ${relative(options.target, problem.file)}: ${problem.message}`,
        ),
  );

const rebaseStaleSketches = (options: {
  target: string;
  product: ResolvedProduct;
  merged?: string[];
  after: string;
  hitsOf: (parts: string[]) => string[];
}): string[] => {
  const { target, product, after, hitsOf } = options;
  const lines: string[] = [];

  for (const sketch of listSketches({ productDir: product.dir, product: product.name })) {
    if (typeof sketch === 'string' || sketch.decision?.kind === 'discard') continue;

    const parts = staleBaseOf({ product, sketch });

    const hits = parts ? hitsOf(parts) : [];

    if (!parts || hits.length === 0) continue;

    const merged = options.merged ?? hits;

    const id = `${product.name} ${sketch.target}`;
    const rebase = `sketch rebase ${sketch.target} --product ${product.name} --by <model id>`;
    const mark = (marked: Sketch, reasons: string[]) =>
      writeSketchFile(
        {
          ...marked,
          portAfterMerge: { merged, parts, reasons, at: new Date().toISOString() },
        },
        { base: marked },
      );
    const { ported, conflicts, rebased } = journaledRebaseOf({ target, product, sketch });

    if (!rebased) {
      mark(sketch, conflicts);
      lines.push(`AGENT PORTS ${id} ${after}: ${conflicts.join('; ')} - port it by hand, then run ${rebase}`);
      continue;
    }

    const problems = ported.length > 0 ? recheckOf({ target, product, sketch: rebased }) : [];

    if (problems.length > 0) {
      mark(rebased, problems);
      lines.push(
        `AGENT PORTS ${id} ${after}: rebased, but the check fails: ${problems.join('; ')} - fix it, then run sketch check ${sketch.target} --product ${product.name}`,
      );
      continue;
    }

    lines.push(`REBASED ${id} ${after}`);
  }

  return lines;
};

/**
 * Rebases each undiscarded sketch whose base the merge of `merged` changed, re-checks it and keeps its status; one that
 * conflicts or fails the check gets a `portAfterMerge` mark instead. `product` must resolve the product after the merge.
 */
export const rebaseAfterMerge = (options: {
  target: string;
  product: ResolvedProduct;
  merged: string[];
  before: Record<string, string>;
}): string[] => {
  const changed = changedKeysOf(options.before, baselineOf(options.product));

  return rebaseStaleSketches({
    ...options,
    after: `after the merge of ${options.merged.join(', ')}`,
    hitsOf: (parts) => parts.filter((part) => changed.has(part)),
  });
};

const inputFilesOf = (product: ResolvedProduct, key: string) => {
  if (key === FIXTURES_KEY) return product.fixtures ? [product.fixtures] : [];

  const part = product.parts.find((candidate) => partKeyOf(candidate) === key);

  if (!part) return [];

  const { files, shared, assets } = partInputsOf({ product, dir: dirname(part.file) });

  return [...files, ...shared.map(({ file }) => file), ...assets.map(({ file }) => file)];
};

/**
 * `rebaseAfterMerge` for a commit that changed `files` (paths relative to `target`): rebases each undiscarded sketch
 * whose stale base holds a part that reads one of them, directly or as a part its variants embed.
 */
export const rebaseAfterCommit = (options: {
  target: string;
  product: ResolvedProduct;
  commit: string;
  files: string[];
}): string[] => {
  const { target, product, commit } = options;
  const files = new Set(options.files.map((file) => resolve(target, file)));
  const touched = new Map<string, boolean>();
  const reads = (key: string) => {
    if (!touched.has(key))
      touched.set(
        key,
        inputFilesOf(product, key).some((file) => files.has(file)),
      );

    return touched.get(key) === true;
  };

  return rebaseStaleSketches({
    target,
    product,
    after: `after the commit ${commit}`,
    hitsOf: (parts) => parts.filter(reads),
  });
};
