import { mkdirSync, writeFileSync } from 'fs';
import { AddressInfo } from 'net';
import { dirname, resolve } from 'path';
import { contactSheetOf, SheetCell } from './contact-sheet';
import { configOf, argsOf, oneProductOf } from './system/sketch/cli-args';
import { createDesignServer } from './serve';
import { DesignConfig, workRootOf } from './paths';
import { extractSketchAt } from './sketch-at';
import { productDirOf } from './system/product';
import { ResolvedProduct } from './system/resolve-product';
import { findSketch, parseTarget } from './system/sketch/sketch';
import { createPartShooter, PartAddress } from './shot';
import { gridOf, ListedGrid } from './system/list-system';
import { createSystemModules, productModuleIdOf, SketchVariant } from './system/system-modules';
import { createDrawQueue, ThumbUnavailableError } from './thumb';

export const SHOT_USAGE =
  'shot <layer>/<name> --states [--variants [--at <commit>]] [--state <name>] [--preset <preset> | --width <px>] [--product <name>] [--surface <name>] [--color <name>] [--out <file>]';

type Axis = { label: string; sketch: SketchVariant | null };

type Plan = { label: string; address: PartAddress };

/**
 * The sheet with a row after each variant row that marks, per state, the pixels the variant changes from the merged
 * row; unchanged when there is no merged row.
 */
export const withDiffRows = (options: { rows: Axis[]; plan: Plan[][]; sheet: SheetCell[][] }): SheetCell[][] => {
  const { rows, plan, sheet } = options;
  const mergedIndex = rows.findIndex((axis) => axis.sketch === null);

  if (mergedIndex === -1 || rows.length < 2) return sheet;

  const merged = new Map(
    (plan[mergedIndex] ?? []).flatMap((entry, index) => {
      const cell = sheet[mergedIndex]?.[index];

      return cell && 'png' in cell ? [[entry.address.state, cell.png] as const] : [];
    }),
  );

  return sheet.flatMap((row, rowIndex) => {
    if (rowIndex === mergedIndex) return [row];

    const diffs = row.flatMap((cell, index) => {
      const before = merged.get(plan[rowIndex]?.[index]?.address.state ?? '');

      return before && 'png' in cell
        ? [{ label: `${cell.label} vs merged`, before, after: cell.png, over: cell.label }]
        : [];
    });

    return diffs.length > 0 ? [row, diffs] : [row];
  });
};

/** Rows of cells: one row per variant when `variants` is set, else one row; one column per state when `states` is set. */
export const planOf = (options: {
  base: Omit<PartAddress, 'state' | 'sketch'>;
  rows: Axis[];
  statesOf: (axis: Axis) => string[];
  states: boolean;
  state: string | null;
}): Plan[][] => {
  const { base, rows, statesOf, states, state } = options;
  const columns = states ? [...new Set(rows.flatMap(statesOf))] : [state ?? ''];

  return rows.map((axis) => {
    const own = statesOf(axis);

    return columns.flatMap((column) => {
      const name = states ? column : (state ?? own[0] ?? '');

      if (states && !own.includes(name)) return [];

      return [
        {
          label: [axis.label, states || axis.sketch === null ? name : ''].filter(Boolean).join(' / '),
          address: { ...base, state: name, sketch: axis.sketch },
        },
      ];
    });
  });
};

/** One sheet row per row of the part's grid, after a row of the states the grid leaves out. */
export const gridRowsOf = (row: Plan[], grid: ListedGrid): Plan[][] => {
  const byState = new Map(row.map((cell) => [cell.address.state, cell]));
  const gridded = new Set(grid.cells.map((cell) => cell.state));
  const rest = row.filter((cell) => !gridded.has(cell.address.state));
  const rows = grid.rows.map((name) =>
    grid.columns.flatMap((column) => {
      const state = grid.cells.find((cell) => cell.row === name && cell.column === column)?.state;
      const cell = state === undefined ? undefined : byState.get(state);

      return cell ? [cell] : [];
    }),
  );

  return [rest, ...rows].filter((cells) => cells.length > 0);
};

export const rowsOf = (options: { part: string; variants: string[] | null; merged: boolean }): Axis[] => {
  const { part, variants, merged } = options;

  if (!variants) return [{ label: '', sketch: null }];

  return [
    ...(merged ? [{ label: 'merged', sketch: null }] : []),
    ...variants.map((variant) => ({ label: variant, sketch: { target: part, variant } })),
  ];
};

export const shotReportOf = (options: { out: string; diffs: string[] }) => [...options.diffs, options.out];

/**
 * The product a shot draws: the one `--product` names or the only one the config declares, else the only product
 * with an open sketch on the part, else the only product with the part.
 */
export const shotProductOf = (options: {
  target: string;
  config: DesignConfig;
  asked: string | undefined;
  part: string;
}): ResolvedProduct | string => {
  const { target, config, asked, part } = options;
  const declared = Object.keys(config.products ?? {});
  const parsed = parseTarget(part);

  if (asked !== undefined || declared.length < 2 || typeof parsed === 'string')
    return oneProductOf({ target, config, asked });

  const sketched = declared.filter(
    (product) => findSketch({ productDir: productDirOf({ target, product }), product, sketch: parsed }) !== null,
  );
  const system = createSystemModules({ target, config });
  const holders = sketched.length > 0 ? sketched : declared.filter((product) => system.partOf({ product, part }));

  return oneProductOf({ target, config, asked: holders.length === 1 ? holders[0] : undefined });
};

const stringsOf = (states: unknown) => (states && typeof states === 'object' ? Object.keys(states) : []);

/**
 * `et design shot <layer>/<name> --states [--variants]` draws every state of a part, and with `--variants`
 * every variant of its open sketch too, into one contact sheet PNG, and prints where it wrote it.
 */
export const designShot = async (options: { target: string; argv: string[]; invocation: string }) => {
  const { target, argv, invocation } = options;
  const args = argsOf(argv, ['--product', '--at', '--state', '--preset', '--width', '--surface', '--color', '--out']);
  const usage = `usage: ${invocation} ${SHOT_USAGE}`;

  if (typeof args === 'string') {
    console.error(`${args}\n${usage}`);

    return 2;
  }

  const [part, ...extra] = args.positional;
  const states = args.flags.has('--states');
  const variants = args.flags.has('--variants');
  const width = args.values['--width'] === undefined ? null : Number(args.values['--width']);
  const preset = args.values['--preset'] ?? null;

  if (
    !part ||
    extra.length > 0 ||
    (!states && !variants) ||
    (args.values['--at'] !== undefined && !variants) ||
    (width !== null && !(Number.isInteger(width) && width > 0)) ||
    (preset && width)
  ) {
    console.error(usage);

    return 2;
  }

  const config = configOf(target);

  if (typeof config === 'string') {
    console.error(config);

    return 1;
  }

  const resolved = shotProductOf({ target, config, asked: args.values['--product'], part });

  if (typeof resolved === 'string') {
    console.error(resolved);

    return 1;
  }

  const product = resolved.name;
  const at = args.values['--at'];
  let sketchesRoot: string | undefined;

  if (at !== undefined) {
    const sketchTarget = parseTarget(part);
    const productDir = createSystemModules({ target, config }).productOf(product)?.dir;

    if (typeof sketchTarget === 'string' || !productDir) {
      console.error(`design-explore: --at needs a <layer>/<name> part of a known product`);

      return 1;
    }

    const extracted = extractSketchAt({
      target,
      productDir,
      sketch: sketchTarget,
      commit: at,
      dest: resolve(workRootOf(target), 'at', `${product}-${at.replace(/[^\w.-]/gu, '_')}`),
    });

    if ('problem' in extracted) {
      console.error(`design-explore: ${extracted.problem}`);

      return 1;
    }

    sketchesRoot = extracted.root;
  }

  const system = createSystemModules({ target, config, sketchesRoot });
  const sketch = system.sketchesOf(product).find((found) => found.target === part);
  const rows = rowsOf({
    part,
    variants: variants ? (sketch?.variants ?? []) : null,
    merged: Boolean(system.partOf({ product, part })),
  });

  if (variants && !sketch?.variants.length) {
    console.error(`design-explore: ${part} has no open sketch in product "${product}"`);

    return 1;
  }

  if (!system.partOf({ product, part }) && !sketch) {
    console.error(`design-explore: product "${product}" has no part "${part}"`);

    return 1;
  }

  const queue = createDrawQueue({ target });
  const server = await createDesignServer({ target, config, listen: true, port: 0, sketchesRoot });

  try {
    await server.listen();

    const { port } = server.httpServer?.address() as AddressInfo;
    const loaded = new Map<Axis, string[]>();
    let grid: ListedGrid | undefined;

    for (const axis of rows) {
      const found = system.partOf({ product, part, sketch: axis.sketch });

      if (!found) continue;

      const module = (await server.ssrLoadModule(
        productModuleIdOf({ file: found.file, product, sketch: axis.sketch }),
      )) as { default?: { states?: unknown; grid?: unknown } };
      const names = stringsOf(module.default?.states);

      loaded.set(axis, names);
      if (!variants) grid = gridOf(module.default?.grid, names).grid;
    }

    const isPage = part.startsWith('pages/');
    const presets = system.productOf(product)?.presets ?? {};
    const chosenPreset = preset ?? (isPage ? (Object.keys(presets)[0] ?? null) : null);
    const params = new URLSearchParams();

    for (const name of ['surface', 'color']) {
      const value = args.values[`--${name}`];

      if (value) params.set(name, value);
    }

    const plan = planOf({
      base: { product, part, preset: chosenPreset, width, interaction: null },
      rows,
      statesOf: (axis) => loaded.get(axis) ?? [],
      states,
      state: args.values['--state'] ?? null,
    });
    const shownGrid = states ? grid : undefined;
    const drawn = shownGrid ? plan.flatMap((cells) => gridRowsOf(cells, shownGrid)) : plan;
    const shooter = createPartShooter({ target, base: `http://localhost:${port}`, system });

    try {
      const sheet: SheetCell[][] = [];

      for (const row of drawn) {
        const cells: SheetCell[] = [];

        for (const { label, address } of row) {
          cells.push(
            await shooter.pictureOf({ ...address, params }).then(
              ({ png }) => ({ label, png }),
              (error: unknown) => ({ label, error: error instanceof Error ? error.message : String(error) }),
            ),
          );
        }

        sheet.push(cells);
      }

      if (sheet.every((row) => row.length === 0)) {
        console.error(`design-explore: ${part} has no state to draw`);

        return 1;
      }

      const { png, diffs } = await queue.run((browser) =>
        contactSheetOf({ browser, rows: variants ? withDiffRows({ rows, plan, sheet }) : sheet }),
      );
      const out = resolve(
        target,
        args.values['--out'] ?? `${workRootOf(target)}/shots/${product}-${part.replace('/', '-')}.png`,
      );

      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, png);
      for (const line of shotReportOf({ out, diffs })) console.log(line);

      return 0;
    } finally {
      await shooter.close();
    }
  } catch (error) {
    if (error instanceof ThumbUnavailableError) {
      console.error(error.message);

      return 1;
    }

    throw error;
  } finally {
    await queue.close();
    await server.close();
  }
};
