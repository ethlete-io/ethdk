import { dirname, relative, sep } from 'path';
import { DesignPreset } from '../paths';
import { ruleProblemsOf } from './check-system';
import { Problem } from './problem';
import { PartOrigin, ResolvedPart } from './resolve-product';
import { SystemModules } from './system-modules';

export const SYSTEM_PATH = '/__design/system';

export type ListedPart = {
  layer: string;
  name: string;
  origin: PartOrigin;
  note: string | null;
  states: string[];
  problems: Problem[];
};

export type ListedProduct = {
  name: string;
  base: string | null;
  presets: Record<string, DesignPreset>;
  parts: ListedPart[];
  problems: Problem[];
};

/** Answers with the module of a part file as one product draws it. */
export type PartLoader = (options: { file: string; product: string }) => Promise<unknown>;

type PartModule = { default?: { note?: unknown; states?: unknown } };

const belongsTo = (part: ResolvedPart, problem: Problem) =>
  problem.file === part.file || problem.file.startsWith(`${dirname(part.file)}${sep}`);

const read = async (options: { part: ResolvedPart; product: string; load: PartLoader }) => {
  const { part, product, load } = options;

  try {
    const loaded = ((await load({ file: part.file, product })) as PartModule).default;
    const states = loaded?.states;

    if (!states || typeof states !== 'object') {
      return { note: null, states: [], problem: 'default-exports no definePart({ note, states, render })' };
    }

    return { note: typeof loaded.note === 'string' ? loaded.note : null, states: Object.keys(states), problem: null };
  } catch (error) {
    return { note: null, states: [], problem: error instanceof Error ? error.message : String(error) };
  }
};

/**
 * Each named product of a workspace with its resolved parts: where each comes from, its note, the
 * names of its states, and the problems the rules and the loading of its module find in it.
 * Problem files are relative to the workspace.
 */
export const listSystem = async (options: {
  target: string;
  system: SystemModules;
  products: string[];
  load: PartLoader;
}): Promise<ListedProduct[]> => {
  const { target, system, products, load } = options;
  const relativeTo = (problem: Problem) => ({ ...problem, file: relative(target, problem.file) });

  return Promise.all(
    products.flatMap((name) => {
      const product = system.productOf(name);

      if (!product) return [];

      const problems = ruleProblemsOf(product);

      return [
        (async (): Promise<ListedProduct> => ({
          name,
          base: product.config.base ?? null,
          presets: product.presets,
          parts: await Promise.all(
            product.parts.map(async (part) => {
              const { note, states, problem } = await read({ part, product: name, load });
              const own = problems.filter((found) => belongsTo(part, found));

              return {
                layer: part.layer,
                name: part.name,
                origin: part.origin,
                note,
                states,
                problems: [...own, ...(problem ? [{ rule: 'LOAD', file: part.file, message: problem }] : [])].map(
                  relativeTo,
                ),
              };
            }),
          ),
          problems: problems.filter((found) => !product.parts.some((part) => belongsTo(part, found))).map(relativeTo),
        }))(),
      ];
    }),
  );
};
