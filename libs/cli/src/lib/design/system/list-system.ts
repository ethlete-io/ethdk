import { dirname, relative, sep } from 'path';
import { Interaction, INTERACTIONS } from '../force-interactions';
import { DesignColorScheme, DesignPreset } from '../paths';
import { ruleProblemsOf } from './check-system';
import { partsReachedFrom } from './imports';
import { kitUsesOf } from './kit';
import { Problem } from './problem';
import { partKeyOf, PartOrigin, ResolvedPart } from './resolve-product';
import { changedOutsideSketchOf } from './sketch/merged-parts';
import { SystemModules } from './system-modules';
import { unusedBasePartsOf } from './unused-base-parts';

export const SYSTEM_PATH = '/__design/system';

export type ListedPart = {
  layer: string;
  name: string;
  origin: PartOrigin;
  /** The part's module file, relative to the workspace. */
  file: string;
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

const countOf = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

/**
 * The summary line of a part's `grid` and the problems that fail it: a state in two cells, a cell
 * naming no state. `null` when the part declares no grid.
 */
const isInteractionColumn = (column: string) =>
  column === 'rest' || INTERACTIONS.some((interaction) => interaction === column);

const coverageWarningsOf = (columns: string[], rows: [string, unknown][]) => {
  const interactions = columns.filter(isInteractionColumn);

  if (interactions.length < 2) return [];

  const filled = rows.map(([row, cells]) => {
    const has = (column: string) => isRecord(cells) && typeof cells[column] === 'string';

    return {
      row,
      missing: interactions.filter((column) => !has(column)),
      interactive: interactions.some((column) => column !== 'rest' && has(column)),
    };
  });
  const full = filled.filter(({ missing }) => missing.length === 0).map(({ row }) => row);
  const partial = filled.filter(({ missing, interactive }) => interactive && missing.length > 0);

  if (full.length === 0 || partial.length === 0) return [];

  const byMissing = new Map<string, string[]>();

  for (const { row, missing } of partial)
    byMissing.set(missing.join(', '), [...(byMissing.get(missing.join(', ')) ?? []), row]);

  const skips = [...byMissing].map(([missing, skipping]) =>
    skipping.length === 1
      ? `row ${skipping[0]} leaves out ${missing}`
      : `rows ${skipping.join(', ')} leave out ${missing}`,
  );

  return [
    `grid ${skips.join('; ')}, which ${full.join(', ')} ${full.length === 1 ? 'fills' : 'fill'} - a state can break there unseen`,
  ];
};

export const gridReportOf = (
  grid: unknown,
  states: string[],
): { line: string; problems: string[]; warnings: string[] } | null => {
  if (!isRecord(grid) || !Array.isArray(grid['columns']) || !isRecord(grid['rows'])) return null;

  const columns = grid['columns'].filter((column): column is string => typeof column === 'string');
  const rows = Object.entries(grid['rows']);
  const cellsOf = new Map<string, string[]>();
  const problems: string[] = [];

  for (const [row, cells] of rows)
    for (const column of columns) {
      const state = isRecord(cells) ? cells[column] : undefined;

      if (typeof state !== 'string') continue;
      if (!states.includes(state)) problems.push(`grid cell ${row} ${column} names ${state}, which is no state`);
      else cellsOf.set(state, [...(cellsOf.get(state) ?? []), `${row} ${column}`]);
    }

  const twice = [...cellsOf].flatMap(([state, cells]) =>
    cells.length > 1
      ? [
          `grid names the state ${state} ${cells.length === 2 ? 'twice' : `${cells.length} times`} (${cells.join(', ')})`,
        ]
      : [],
  );
  const left = states.filter((state) => !cellsOf.has(state));
  const size = `grid ${countOf(rows.length, 'row')} x ${countOf(columns.length, 'column')}`;
  const empty = rows.flatMap(([row, cells]) =>
    isRecord(cells) && columns.some((column) => typeof cells[column] === 'string')
      ? columns.filter((column) => typeof cells[column] !== 'string').map((column) => `${row} ${column}`)
      : [],
  );
  const gaps = [
    ...(left.length > 0 ? [`leaves out ${left.join(', ')}`] : []),
    ...(empty.length > 0 ? [`draws no ${empty.join(', ')}`] : []),
  ];

  return {
    line: gaps.length === 0 ? `${size} ok` : `${size}, ${gaps.join('; ')}`,
    problems: [...twice, ...problems],
    warnings: coverageWarningsOf(columns, rows),
  };
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

const belongsTo = (part: ResolvedPart, problem: Problem) =>
  problem.file === part.file || problem.file.startsWith(`${dirname(part.file)}${sep}`);

/** The note, state names, widths, interactions and grid a part module declares, or the problem that kept it from loading. */
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

    const names = Object.keys(states);

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
      const changedOutsideSketch = new Set(changedOutsideSketchOf(product));
      const unused = unusedBasePartsOf(product);

      return [
        (async (): Promise<ListedProduct> => ({
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
                note,
                madeBy,
                states,
                ...layout,
                interactions,
                kitUses: part.layer === 'pages' ? kitUsesOf(part.source) : 0,
                usedIn: usedInOf(part),
                ...(unused.has(partKeyOf(part)) ? { unusedInProduct: true as const } : {}),
                changedOutsideSketch: changedOutsideSketch.has(partKeyOf(part)),
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
