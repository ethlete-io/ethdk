import { relative } from 'path';
import { ResolvedProduct } from '../resolve-product';
import { baselineOf } from './baseline';
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
  const { target, product, merged, before } = options;
  const changed = changedKeysOf(before, baselineOf(product));
  const after = `after the merge of ${merged.join(', ')}`;
  const lines: string[] = [];

  for (const sketch of listSketches({ productDir: product.dir, product: product.name })) {
    if (typeof sketch === 'string' || sketch.decision?.kind === 'discard') continue;

    const parts = staleBaseOf({ product, sketch });

    if (!parts?.some((part) => changed.has(part))) continue;

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
