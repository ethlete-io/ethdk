import { dirname, relative, resolve, sep } from 'path';
import { Interaction, INTERACTIONS } from '../force-interactions';
import { DesignColorScheme, DesignPreset } from '../design-config';
import { ruleProblemsOf } from './check-system';
import { partsReachedFrom, partUsersOf } from './imports';
import { kitUsesOf } from './kit';
import { Problem } from './problem';
import { partKeyOf, PartOrigin, ResolvedPart, ResolvedProduct } from './resolve-product';
import { openDirectEditPartsOf } from './sketch/merged-parts';
import { partLinkOf } from './sketch/part-definition';
import { SystemModules } from './system-modules';
import { drawnStateNamesOf, ownStylesheetOf } from './unchanged-rows';
import { unusedBasePartsOf } from './unused-base-parts';

export const SYSTEM_PATH = '/__design/system';

export type ListedPart = {
  layer: string;
  name: string;
  origin: PartOrigin;
  /** The part's module file, relative to the workspace. */
  file: string;
  /** The app component file the part's `implements` names, relative to the workspace. */
  implements?: string;
  note: string | null;
  /** The model ids that drew the part, written by the last sketch merge; empty when none is known. */
  madeBy: string[];
  states: string[];
  /** The container widths the part is drawn at, when it declares valid ones. */
  widths?: number[];
  /** The interactions the part is drawn in besides rest, in the order it declares them. */
  interactions: Interaction[];
  /** The motions the part declares between its states, without their `play`. */
  motions?: Record<string, ListedMotion>;
  /** The states the part draws as one table in rest, when it declares a `grid` that places any. */
  grid?: ListedGrid;
  /** The calls of wireframe kit parts in a page's source; a page with any is a wireframe. */
  kitUses: number;
  /** The pages that import the part, directly or through another part: of its own product, and of each product that draws it as its base part. */
  usedIn: PageUse[];
  /** The keys of the product's parts that import the part directly. */
  usedBy: string[];
  /** Set on a base part that no part of the product imports, directly, through other parts, or through its `@ethlete/<lib>/design` module. */
  unusedInProduct?: true;
  /** Whether the part changed since its last sketch merge while no open sketch holds it. */
  changedOutsideSketch: boolean;
  problems: Problem[];
};

export type ListedMotion = { from: string; to: string; at?: number[]; interrupt?: number; viewTransition?: boolean };

export type ListedGrid = { columns: string[]; rows: string[]; cells: { row: string; column: string; state: string }[] };

export type PageUse = { product: string; part: string };

export type ListedProduct = {
  name: string;
  base: string | null;
  presets: Record<string, DesignPreset>;
  schemes: DesignColorScheme[];
  themes: { surface: string[]; color: string[] };
  parts: ListedPart[];
  problems: Problem[];
};

/** Answers with the module of a part file as one product draws it. */
export type PartLoader = (options: { file: string; product: string }) => Promise<unknown>;

type PartModule = {
  default?: {
    note?: unknown;
    madeBy?: unknown;
    states?: unknown;
    widths?: unknown;
    interactions?: unknown;
    grid?: unknown;
    motions?: unknown;
  };
};

const motionsOf = (motions: unknown): Pick<ListedPart, 'motions'> => {
  if (!isRecord(motions)) return {};

  const listed = Object.entries(motions).flatMap(([name, motion]): [string, ListedMotion][] => {
    if (!isRecord(motion) || typeof motion['from'] !== 'string' || typeof motion['to'] !== 'string') return [];

    const { at, interrupt, viewTransition } = motion;

    return [
      [
        name,
        {
          from: motion['from'],
          to: motion['to'],
          ...(Array.isArray(at) ? { at: at.filter((time): time is number => typeof time === 'number') } : {}),
          ...(typeof interrupt === 'number' ? { interrupt } : {}),
          ...(typeof viewTransition === 'boolean' ? { viewTransition } : {}),
        },
      ],
    ];
  });

  return listed.length > 0 ? { motions: Object.fromEntries(listed) } : {};
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

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** The cells of a declared grid that name a listed column and a known state, each state in its first cell only. */
export const gridOf = (grid: unknown, states: string[]): Pick<ListedPart, 'grid'> => {
  if (!isRecord(grid) || !Array.isArray(grid['columns']) || !isRecord(grid['rows'])) return {};

  const columns = [...new Set(grid['columns'].filter((column): column is string => typeof column === 'string'))];
  const placed = new Set<string>();
  const cells = Object.entries(grid['rows']).flatMap(([row, cellsOfRow]) =>
    isRecord(cellsOfRow)
      ? columns.flatMap((column) => {
          const state = cellsOfRow[column];

          if (typeof state !== 'string' || !states.includes(state) || placed.has(state)) return [];

          placed.add(state);

          return [{ row, column, state }];
        })
      : [],
  );

  if (cells.length === 0) return {};

  return { grid: { columns, rows: [...new Set(cells.map((cell) => cell.row))], cells } };
};

const pageReachOf = (system: SystemModules) =>
  system.products().flatMap((name) => {
    const product = system.productOf(name);

    if (!product) return [];

    const tokenParts = new Set(product.tokens);
    const tokens = product.parts.filter((part) => tokenParts.has(partKeyOf(part)));

    return product.parts
      .filter((part) => part.layer === 'pages')
      .map((page) => ({
        use: { product: name, part: partKeyOf(page) },
        files: new Set([...partsReachedFrom({ product, from: page }), ...tokens].map((part) => part.file)),
      }));
  });

const implementsOf = (options: { target: string; source: string }) => {
  const link = partLinkOf(options.source);
  const path = link.kind === 'component' ? link.path : link.kind === 'route' ? link.component : null;

  return path === null ? {} : { implements: relative(options.target, resolve(options.target, path)) };
};

const belongsTo = (part: ResolvedPart, problem: Problem) =>
  problem.file === part.file || problem.file.startsWith(`${dirname(part.file)}${sep}`);

/** The note, state names, widths, interactions and grid a part module declares, or the problem that kept it from loading. */
export const readPartModule = async (options: {
  part: Pick<ResolvedPart, 'file'> & Partial<Pick<ResolvedPart, 'cssSource'>>;
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

    const names = await drawnStateNamesOf(loaded, part.cssSource ?? ownStylesheetOf(part.file));

    return {
      note: typeof loaded.note === 'string' ? loaded.note : null,
      madeBy: madeByOf(loaded.madeBy),
      states: names,
      ...widthsOf(loaded.widths),
      interactions: interactionsOf(loaded.interactions),
      ...gridOf(loaded.grid, names),
      ...motionsOf(loaded.motions),

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
  problemsOf?: (name: string, product: ResolvedProduct) => Problem[] | Promise<Problem[]>;
}): Promise<ListedProduct[]> => {
  const { target, system, products, load, problemsOf = (_name, product) => ruleProblemsOf(product) } = options;
  const relativeTo = (problem: Problem) => ({ ...problem, file: relative(target, problem.file) });
  const pages = pageReachOf(system);
  const usedInOf = (part: ResolvedPart) => pages.filter(({ files }) => files.has(part.file)).map(({ use }) => use);

  return Promise.all(
    products.flatMap((name) => {
      const product = system.productOf(name);

      if (!product) return [];

      const ruled = problemsOf(name, product);
      const changedOutsideSketch = new Set(openDirectEditPartsOf(product));
      const unused = unusedBasePartsOf(product);
      const users = partUsersOf(product);

      return [
        (async (): Promise<ListedProduct> => {
          const problems = await ruled;

          return {
            name,
            base: product.config.base ?? null,
            presets: product.presets,
            schemes: product.schemes,
            themes: { surface: product.config.themes?.surface ?? [], color: product.config.themes?.color ?? [] },
            parts: await Promise.all(
              product.parts.map(async (part) => {
                const { note, madeBy, states, interactions, problem, ...layout } = await readPartModule({
                  part,
                  product: name,
                  load,
                });
                const own = problems.filter((found) => belongsTo(part, found));

                return {
                  layer: part.layer,
                  name: part.name,
                  origin: part.origin,
                  file: relative(target, part.file),
                  ...implementsOf({ target, source: part.source }),
                  note,
                  madeBy,
                  states,
                  ...layout,
                  interactions,
                  kitUses: part.layer === 'pages' ? kitUsesOf(part.source) : 0,
                  usedIn: usedInOf(part),
                  usedBy: [...(users.get(partKeyOf(part)) ?? [])],
                  ...(unused.has(partKeyOf(part)) ? { unusedInProduct: true as const } : {}),
                  changedOutsideSketch: changedOutsideSketch.has(partKeyOf(part)),
                  problems: [...own, ...(problem ? [{ rule: 'LOAD', file: part.file, message: problem }] : [])].map(
                    relativeTo,
                  ),
                };
              }),
            ),
            problems: problems.filter((found) => !product.parts.some((part) => belongsTo(part, found))).map(relativeTo),
          };
        })(),
      ];
    }),
  );
};
