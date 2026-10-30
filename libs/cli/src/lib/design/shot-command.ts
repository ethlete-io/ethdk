import { mkdirSync, writeFileSync } from 'fs';
import { AddressInfo } from 'net';
import { dirname, resolve } from 'path';
import { changedCropOf, contactSheetOf, pngSizeOf, SheetCell } from './contact-sheet';
import { configOf, argsOf, oneProductOf } from './system/sketch/cli-args';
import { createDesignServer } from './serve';
import { DesignConfig, workRootOf } from './paths';
import { INTERACTIONS } from './force-interactions';
import { extractSketchAt } from './sketch-at';
import { productDirOf } from './system/product';
import { ResolvedProduct } from './system/resolve-product';
import { findSketch, parseTarget, Sketch } from './system/sketch/sketch';
import { createPartShooter, cropOf, PartAddress } from './shot';
import { gridOf, ListedGrid } from './system/list-system';
import { createSystemModules, productModuleIdOf, SketchVariant } from './system/system-modules';
import { createDrawQueue, ThumbUnavailableError } from './thumb';
import { BoxOf } from './variant-diff';

export const SHOT_USAGE = `shot <layer>/<name> --states [--variants [--round <key>[,<key>...]] [--variant <name>[,<name>...]] [--at <commit>] [--diff-props]] [--state <name>[,<name>...]] [--interaction <${INTERACTIONS.join('|')}>] [--preset <preset> | --width <px>] [--scale <1-4>] [--crop <x,y,width,height> | --crop changed] [--product <name>] [--surface <name>] [--color <name>] [--out <file>]`;

type Axis = { label: string; sketch: SketchVariant | null };

type Plan = { label: string; address: PartAddress; absent?: true };

export const NEW_STATE_NOTE = 'New state - no merged version';

/**
 * The sheet with a row after each variant row that marks, per state, the pixels the variant changes from the merged
 * row; headed by a note that the part is new when there is no merged row. A cell of `props` at the place of a variant
 * cell is the merged part drawn with that variant's state props, and replaces the merged cell in the comparison. A row
 * with a grid in `grids` is laid out by it, each grid row followed by its diff row.
 */
export const withDiffRows = (options: {
  rows: Axis[];
  plan: Plan[][];
  sheet: SheetCell[][];
  props?: SheetCell[][];
  grids?: (ListedGrid | undefined)[];
}): SheetCell[][] => {
  const { rows, plan, sheet, props, grids } = options;
  const mergedIndex = rows.findIndex((axis) => axis.sketch === null);
  const compares = mergedIndex !== -1 && rows.length > 1;
  const mergedStates = new Set(
    (plan[mergedIndex] ?? []).flatMap((entry) => (entry.absent ? [] : [entry.address.state])),
  );
  const merged = new Map(
    (plan[mergedIndex] ?? []).flatMap((entry, index) => {
      const cell = sheet[mergedIndex]?.[index];

      return cell && 'png' in cell ? [[entry.address.state, cell] as const] : [];
    }),
  );

  const diffOf = (rowIndex: number, index: number): SheetCell | null => {
    const cell = sheet[rowIndex]?.[index];
    const state = plan[rowIndex]?.[index]?.address.state ?? '';
    const before = merged.get(state);

    if (!cell || !('png' in cell)) return null;
    if (!mergedStates.has(state)) return { label: `${cell.label} vs merged`, note: 'new state' };

    const own = props?.[rowIndex]?.[index];

    if (own) {
      const label = `${cell.label} vs merged with its props`;

      if ('png' in own) return { label, before: own.png, after: cell.png, over: cell.label };

      return { label, note: 'error' in own ? own.error : 'not drawn' };
    }

    if (!before) return null;

    const markupDiffers = before.markup !== undefined && cell.markup !== undefined && before.markup !== cell.markup;

    return {
      label: `${cell.label} vs merged`,
      before: before.png,
      after: cell.png,
      over: cell.label,
      ...(markupDiffers ? { markupDiffers } : {}),
    };
  };

  const laidOut = sheet.flatMap((row, rowIndex) => {
    const grid = grids?.[rowIndex];
    const cells = plan[rowIndex] ?? [];
    const groups = grid
      ? gridRowsOf(cells, grid).map((group) => group.map((cell) => cells.indexOf(cell)))
      : [row.map((_, index) => index)];

    return groups.flatMap((group) => {
      const drawn = group.flatMap((index) => (row[index] ? [row[index]] : []));
      const diffs =
        compares && rowIndex !== mergedIndex
          ? group.flatMap((index) => {
              const diff = diffOf(rowIndex, index);

              return diff ? [diff] : [];
            })
          : [];

      return diffs.length > 0 ? [drawn, diffs] : [drawn];
    });
  });

  return mergedIndex === -1 ? [[{ label: 'merged', note: 'new part, nothing to compare with' }], ...laidOut] : laidOut;
};

/**
 * Rows of cells: one row per variant when `variants` is set, else one row; one column per state when `states` is set,
 * or per state of `only` in its order.
 * Without a width or a preset in `base`, a row is drawn at the width `widthOf` gives for it.
 */
export const planOf = (options: {
  base: Omit<PartAddress, 'state' | 'sketch'>;
  rows: Axis[];
  statesOf: (axis: Axis) => string[];
  widthOf?: (axis: Axis) => number | null;
  states: boolean;
  state: string | null;
  only?: string[];
}): Plan[][] => {
  const { base, rows, statesOf, widthOf, states, state, only } = options;
  const all = [...new Set(rows.flatMap(statesOf))];
  const columns = states ? (only ? only.filter((name) => all.includes(name)) : all) : [state ?? ''];

  return rows.map((axis) => {
    const own = statesOf(axis);
    const width = base.width ?? (base.preset ? null : (widthOf?.(axis) ?? null));

    return columns.flatMap((column) => {
      const name = states ? column : (state ?? own[0] ?? '');

      if (states && !own.includes(name)) return [];

      const absent = !states && state !== null && axis.sketch === null && !own.includes(name) && all.includes(name);

      return [
        {
          label: [axis.label, states || axis.sketch === null ? name : ''].filter(Boolean).join(' / '),
          address: { ...base, width, state: name, sketch: axis.sketch },
          ...(absent ? { absent: true as const } : {}),
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

/**
 * The variants of a sketch that a shot draws: all of them, or only those in the named rounds and among the named
 * variants. A string names a round or a variant the sketch does not have, or says that none is left.
 */
export const shownVariantsOf = (options: {
  sketch: Pick<Sketch, 'variants' | 'rounds' | 'variantInfo'>;
  rounds: string[];
  variants: string[];
}): string[] | string => {
  const { sketch, rounds, variants } = options;
  const known = sketch.rounds.map((round) => round.key);
  const unknownRounds = rounds.filter((key) => !known.includes(key));
  const unknownVariants = variants.filter((name) => !sketch.variants.includes(name));

  if (unknownRounds.length > 0) return `no round ${unknownRounds.join(', ')} (rounds: ${known.join(', ')})`;
  if (unknownVariants.length > 0)
    return `no variant ${unknownVariants.join(', ')} (variants: ${sketch.variants.join(', ')})`;

  const shown = sketch.variants.filter(
    (name) =>
      (rounds.length === 0 || rounds.includes(sketch.variantInfo[name]?.round ?? '')) &&
      (variants.length === 0 || variants.includes(name)),
  );

  return shown.length > 0 ? shown : `no variant is in round ${rounds.join(', ')} and named ${variants.join(', ')}`;
};

/** The diff lines of the sheet, a line per new state, and the PNG path last. */
export const shotReportOf = (options: { out: string; diffs: string[]; sheet: SheetCell[][] }) => [
  ...options.diffs,
  ...options.sheet.flatMap((row) =>
    row.flatMap((cell) => ('note' in cell && cell.label.includes(' vs merged') ? [`${cell.label}: ${cell.note}`] : [])),
  ),
  options.out,
];

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

const CROP_CHANGED = 'changed';

/**
 * The crop around every pixel a variant cell changes from the merged cell of its state, in CSS pixels inside the
 * largest picture, or `null` when no variant changes a pixel.
 */
export const changedCropIn = async (options: {
  plan: Plan[][];
  sheet: SheetCell[][];
  mergedIndex: number;
  boxOf: BoxOf;
  scale: number;
}) => {
  const { plan, sheet, mergedIndex, boxOf, scale } = options;
  const pngs = sheet.flatMap((row) => row.flatMap((cell) => ('png' in cell ? [cell.png] : [])));
  const merged = new Map(
    (plan[mergedIndex] ?? []).flatMap((entry, index) => {
      const cell = sheet[mergedIndex]?.[index];

      return cell && 'png' in cell ? [[entry.address.state, cell.png] as const] : [];
    }),
  );
  const pairs = sheet.flatMap((row, rowIndex) =>
    rowIndex === mergedIndex
      ? []
      : row.flatMap((cell, index) => {
          const before = merged.get(plan[rowIndex]?.[index]?.address.state ?? '');

          return before && 'png' in cell ? [[before, cell.png] as const] : [];
        }),
  );

  if (pngs.length === 0) return null;

  const sizes = pngs.map(pngSizeOf);
  const boxes = await Promise.all(pairs.map(([before, after]) => boxOf(before, after)));

  return changedCropOf({
    boxes,
    frame: {
      width: Math.max(...sizes.map((size) => size.width)),
      height: Math.max(...sizes.map((size) => size.height)),
    },
    scale,
  });
};

const stringsOf = (states: unknown) => (states && typeof states === 'object' ? Object.keys(states) : []);

/**
 * `et design shot <layer>/<name> --states [--variants]` draws every state of a part, and with `--variants`
 * every variant of its open sketch too, into one contact sheet PNG, and prints where it wrote it.
 */
export const designShot = async (options: { target: string; argv: string[]; invocation: string }) => {
  const { target, argv, invocation } = options;
  const args = argsOf(argv, [
    '--product',
    '--at',
    '--round',
    '--variant',
    '--state',
    '--interaction',
    '--preset',
    '--width',
    '--scale',
    '--crop',
    '--surface',
    '--color',
    '--out',
  ]);
  const usage = `usage: ${invocation} ${SHOT_USAGE}`;

  if (typeof args === 'string') {
    console.error(`${args}\n${usage}`);

    return 2;
  }

  const [part, ...extra] = args.positional;
  const asked = args.values['--state']?.split(',').filter(Boolean) ?? [];
  const states = args.flags.has('--states') || asked.length > 1;
  const variants = args.flags.has('--variants');
  const diffProps = args.flags.has('--diff-props');
  const onlyRounds = args.values['--round']?.split(',').filter(Boolean) ?? [];
  const onlyVariants = args.values['--variant']?.split(',').filter(Boolean) ?? [];
  const width = args.values['--width'] === undefined ? null : Number(args.values['--width']);
  const preset = args.values['--preset'] ?? null;
  const scale = Number(args.values['--scale'] ?? 1);
  const interaction = args.values['--interaction'] ?? null;
  const cropChanged = args.values['--crop'] === CROP_CHANGED;

  if (
    !part ||
    extra.length > 0 ||
    (!states && !variants) ||
    ((args.values['--at'] !== undefined || diffProps || onlyRounds.length > 0 || onlyVariants.length > 0) &&
      !variants) ||
    (width !== null && !(Number.isInteger(width) && width > 0)) ||
    (preset && width) ||
    !(Number.isInteger(scale) && scale >= 1 && scale <= 4) ||
    (cropChanged ? !variants : cropOf(args.values['--crop']) === undefined) ||
    (interaction !== null && !(INTERACTIONS as readonly string[]).includes(interaction))
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

  if (variants && !sketch?.variants.length) {
    console.error(`design-explore: ${part} has no open sketch in product "${product}"`);

    return 1;
  }

  const shownVariants =
    variants && sketch ? shownVariantsOf({ sketch, rounds: onlyRounds, variants: onlyVariants }) : null;

  if (typeof shownVariants === 'string') {
    console.error(`design-explore: ${part} has ${shownVariants}`);

    return 1;
  }

  const rows = rowsOf({ part, variants: shownVariants, merged: Boolean(system.partOf({ product, part })) });

  if (!system.partOf({ product, part }) && !sketch) {
    console.error(`design-explore: product "${product}" has no part "${part}"`);

    return 1;
  }

  if (cropChanged && !system.partOf({ product, part })) {
    console.error(
      `design-explore: --crop changed compares the variants with the merged part, and ${part} is new in product "${product}"`,
    );

    return 2;
  }

  const queue = createDrawQueue({ target });
  const server = await createDesignServer({ target, config, listen: true, port: 0, sketchesRoot });

  try {
    await server.listen();

    const { port } = server.httpServer?.address() as AddressInfo;
    const loaded = new Map<Axis, string[]>();
    const widths = new Map<Axis, number>();
    const grids = new Map<Axis, ListedGrid | undefined>();

    for (const axis of rows) {
      const found = system.partOf({ product, part, sketch: axis.sketch });

      if (!found) continue;

      const module = (await server.ssrLoadModule(
        productModuleIdOf({ file: found.file, product, sketch: axis.sketch }),
      )) as { default?: { states?: unknown; grid?: unknown; widths?: unknown } };
      const names = stringsOf(module.default?.states);

      const first = Array.isArray(module.default?.widths) ? (module.default.widths[0] as unknown) : undefined;

      loaded.set(axis, names);
      if (typeof first === 'number' && Number.isInteger(first) && first > 0) widths.set(axis, first);
      grids.set(axis, gridOf(module.default?.grid, names).grid);
    }

    const known = [...new Set([...loaded.values()].flat())];
    const unknown = asked.filter((name) => !known.includes(name));

    if (unknown.length > 0) {
      console.error(`design-explore: ${part} has no state ${unknown.join(', ')} (states: ${known.join(', ')})`);

      return 1;
    }

    const isPage = part.startsWith('pages/');
    const presets = system.productOf(product)?.presets ?? {};
    const chosenPreset = preset ?? (isPage ? (Object.keys(presets)[0] ?? null) : null);
    const params = new URLSearchParams();

    for (const name of ['surface', 'color', 'scale']) {
      const value = args.values[`--${name}`];

      if (value) params.set(name, value);
    }

    if (args.values['--crop'] && !cropChanged) params.set('clip', args.values['--crop']);

    const plan = planOf({
      base: { product, part, preset: chosenPreset, width, interaction },
      rows,
      statesOf: (axis) => loaded.get(axis) ?? [],
      widthOf: (axis) => (isPage ? null : (widths.get(axis) ?? null)),
      states,
      state: asked[0] ?? null,
      only: states && asked.length > 0 ? asked : undefined,
    });
    const shooter = createPartShooter({ target, base: `http://localhost:${port}`, system });

    try {
      const shoot = ({ label, address, absent }: Plan): Promise<SheetCell> =>
        absent
          ? Promise.resolve({ label, note: NEW_STATE_NOTE })
          : shooter.pictureOf({ ...address, params }).then(
              ({ png, markup }) => ({ label, png, ...(markup === undefined ? {} : { markup }) }),
              (error: unknown) => ({ label, error: error instanceof Error ? error.message : String(error) }),
            );
      const shootAll = async () => {
        const drawn: SheetCell[][] = [];

        for (const row of plan) {
          const cells: SheetCell[] = [];

          for (const entry of row) cells.push(await shoot(entry));

          drawn.push(cells);
        }

        return drawn;
      };
      let sheet = await shootAll();
      const mergedIndex = rows.findIndex((axis) => axis.sketch === null);

      if (cropChanged) {
        const crop = await changedCropIn({ plan, sheet, mergedIndex, boxOf: shooter.changedBoxOf, scale });

        if (crop) {
          params.set('clip', `${crop.x},${crop.y},${crop.width},${crop.height}`);
          console.log(`crop ${crop.x},${crop.y},${crop.width},${crop.height} (changed bounds)`);
          sheet = await shootAll();
        } else {
          console.log('crop changed: no variant changes a pixel of the merged part, so the full frame is drawn');
        }
      }

      const mergedStates = new Set(plan[mergedIndex]?.flatMap((cell) => (cell.absent ? [] : [cell.address.state])));
      const props: SheetCell[][] = [];

      for (const row of diffProps ? plan : []) {
        const cells: SheetCell[] = [];

        for (const { label, address } of row) {
          cells.push(
            address.sketch && mergedStates.has(address.state)
              ? await shoot({ label, address: { ...address, sketch: null, props: address.sketch } })
              : { label, note: '' },
          );
        }

        props.push(cells);
      }

      if (sheet.every((row) => row.length === 0)) {
        console.error(`design-explore: ${part} has no state to draw`);

        return 1;
      }

      const shown = withDiffRows({
        rows,
        plan,
        sheet,
        props: diffProps ? props : undefined,
        grids: rows.map((axis) => (states ? grids.get(axis) : undefined)),
      });
      const { png, diffs } = await queue.run((browser) => contactSheetOf({ browser, rows: shown }));
      const out = resolve(
        target,
        args.values['--out'] ?? `${workRootOf(target)}/shots/${product}-${part.replace('/', '-')}.png`,
      );

      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, png);
      for (const line of shotReportOf({ out, diffs, sheet: shown })) console.log(line);

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
