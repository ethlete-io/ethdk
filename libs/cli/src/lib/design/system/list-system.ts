import { dirname, relative, sep } from 'path';
import { Interaction, INTERACTIONS } from '../force-interactions';
import { DesignPreset } from '../paths';
import { ruleProblemsOf } from './check-system';
import { partsReachedFrom } from './imports';
import { kitUsesOf } from './kit';
import { Problem } from './problem';
import { partKeyOf, PartOrigin, ResolvedPart } from './resolve-product';
import { SystemModules } from './system-modules';

export const SYSTEM_PATH = '/__design/system';

export type ListedPart = {
  layer: string;
  name: string;
  origin: PartOrigin;
  note: string | null;
  /** The model ids that drew the part, written by the last sketch merge; empty when none is known. */
  madeBy: string[];
  states: string[];
  /** The container widths the part is drawn at, when it declares valid ones. */
  widths?: number[];
  /** The interactions the part is drawn in besides rest, in the order it declares them. */
  interactions: Interaction[];
  /** The calls of wireframe kit parts in a page's source; a page with any is a wireframe. */
  kitUses: number;
  /** The pages that import the part, directly or through another part: of its own product, and of each product that draws it as its base part. */
  usedIn: PageUse[];
  problems: Problem[];
};

export type PageUse = { product: string; part: string };

export type ListedProduct = {
  name: string;
  base: string | null;
  presets: Record<string, DesignPreset>;
  themes: { surface: string[]; color: string[] };
  parts: ListedPart[];
  problems: Problem[];
};

/** Answers with the module of a part file as one product draws it. */
export type PartLoader = (options: { file: string; product: string }) => Promise<unknown>;

type PartModule = {
  default?: { note?: unknown; madeBy?: unknown; states?: unknown; widths?: unknown; interactions?: unknown };
};

const madeByOf = (madeBy: unknown) =>
  Array.isArray(madeBy) ? madeBy.filter((author): author is string => typeof author === 'string' && author !== '') : [];

const widthsOf = (widths: unknown) =>
  Array.isArray(widths) &&
  widths.length > 0 &&
  widths.every((width) => typeof width === 'number' && Number.isFinite(width) && width > 0)
    ? { widths: widths as number[] }
    : {};

const isInteraction = (name: unknown): name is Interaction => INTERACTIONS.some((known) => known === name);

const interactionsOf = (interactions: unknown): Interaction[] =>
  Array.isArray(interactions) ? [...new Set(interactions.filter(isInteraction))] : [];

const pageReachOf = (system: SystemModules) =>
  system.products().flatMap((name) => {
    const product = system.productOf(name);

    if (!product) return [];

    return product.parts
      .filter((part) => part.layer === 'pages')
      .map((page) => ({
        use: { product: name, part: partKeyOf(page) },
        files: new Set(partsReachedFrom({ product, from: page }).map((part) => part.file)),
      }));
  });

const belongsTo = (part: ResolvedPart, problem: Problem) =>
  problem.file === part.file || problem.file.startsWith(`${dirname(part.file)}${sep}`);

/** The note, state names, widths and interactions a part module declares, or the problem that kept it from loading. */
export const readPartModule = async (options: {
  part: Pick<ResolvedPart, 'file'>;
  product: string;
  load: PartLoader;
}) => {
  const { part, product, load } = options;

  try {
    const loaded = ((await load({ file: part.file, product })) as PartModule).default;
    const states = loaded?.states;

    if (!states || typeof states !== 'object') {
      return {
        note: null,
        madeBy: [],
        states: [],
        interactions: [],
        problem: 'default-exports no definePart({ note, states, render })',
      };
    }

    return {
      note: typeof loaded.note === 'string' ? loaded.note : null,
      madeBy: madeByOf(loaded.madeBy),
      states: Object.keys(states),
      ...widthsOf(loaded.widths),
      interactions: interactionsOf(loaded.interactions),
      problem: null,
    };
  } catch (error) {
    return {
      note: null,
      madeBy: [],
      states: [],
      interactions: [],
      problem: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * Each named product of a workspace with its own theme names and its resolved parts: where each
 * comes from, its note, the names of its states, and the problems the rules and the loading of its
 * module find in it. Base parts draw under the product's themes, so a base's themes are not inherited.
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
  const pages = pageReachOf(system);
  const usedInOf = (part: ResolvedPart) => pages.filter(({ files }) => files.has(part.file)).map(({ use }) => use);

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
          themes: { surface: product.config.themes?.surface ?? [], color: product.config.themes?.color ?? [] },
          parts: await Promise.all(
            product.parts.map(async (part) => {
              const { note, madeBy, states, interactions, problem, ...widths } = await readPartModule({
                part,
                product: name,
                load,
              });
              const own = problems.filter((found) => belongsTo(part, found));

              return {
                layer: part.layer,
                name: part.name,
                origin: part.origin,
                note,
                madeBy,
                states,
                ...widths,
                interactions,
                kitUses: part.layer === 'pages' ? kitUsesOf(part.source) : 0,
                usedIn: usedInOf(part),
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
