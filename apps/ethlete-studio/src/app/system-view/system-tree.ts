import {
  CommentPlace,
  ListedCall,
  ListedPart,
  ListedProduct,
  ListedSketch,
  PartAddress,
  callShotUrl,
  frameUrl,
  partFrameUrl,
  partShotUrl,
} from '../../host/design';
import { CanvasFrame } from '../components/design-canvas/canvas-frame';

export type SystemGroupKey = 'foundations' | 'components' | 'elements' | 'pages' | 'sketches' | 'legacy';

export const SYSTEM_GROUPS: readonly { key: SystemGroupKey; label: string; layers: readonly string[] }[] = [
  { key: 'foundations', label: 'Foundations', layers: ['foundations'] },
  { key: 'components', label: 'Components', layers: ['components'] },
  { key: 'elements', label: 'Elements', layers: ['elements'] },
  { key: 'pages', label: 'Pages', layers: ['pages'] },
  { key: 'sketches', label: 'Sketches', layers: [] },
  { key: 'legacy', label: 'Legacy', layers: [] },
];

export type PartBadge =
  'from base' | 'overridden' | 'error' | 'transferred' | 'sketch open' | 'comment open' | 'in progress' | 'ready';

export type TreeEntry = { key: string; name: string; title?: string; badges: PartBadge[] };

export type TreeSection = { key: string; label: string; entries: TreeEntry[] };

export type TreeGroup = { key: string; label: string; entries: TreeEntry[]; sections?: TreeSection[] };

export const partKeyOf = (part: Pick<ListedPart, 'layer' | 'name'>) => `${part.layer}/${part.name}`;

const badgesOf = (part: ListedPart, sketched: ReadonlySet<string>, commented: ReadonlySet<string>): PartBadge[] => [
  ...(part.origin === 'base' ? (['from base'] as const) : []),
  ...(part.origin === 'overridden' ? (['overridden'] as const) : []),
  ...(sketched.has(partKeyOf(part)) ? (['sketch open'] as const) : []),
  ...(commented.has(partKeyOf(part)) ? (['comment open'] as const) : []),
  ...(part.problems.length > 0 ? (['error'] as const) : []),
];

export const sketchKeyOf = (target: string) => `sketch:${target}`;

const sketchEntryOf = (sketch: ListedSketch, commented: ReadonlySet<string>): TreeEntry => ({
  key: sketchKeyOf(sketch.target),
  name: sketch.name,
  title: sketch.target,
  badges: [
    sketch.status,
    ...(commented.has(sketch.target) ? (['comment open'] as const) : []),
    ...(sketch.problems.some((entry) => entry.problems.length > 0) ? (['error'] as const) : []),
  ],
});

export const callKeyOf = (slug: string) => `legacy:${slug}`;

const callBadgesOf = (call: ListedCall): PartBadge[] =>
  'error' in call ? ['error'] : call.transferred ? ['transferred'] : [];

const callEntryOf = (call: ListedCall, name: string): TreeEntry => ({
  key: callKeyOf(call.slug),
  name,
  title: 'error' in call ? call.error : call.headline,
  badges: callBadgesOf(call),
});

/** One Legacy group for all calls, or one per project once the calls span several. Calls sharing a stage (the first slug segment after the project) form a section. */
export const legacyGroupsOf = (calls: ListedCall[]): TreeGroup[] => {
  const projects = [...new Set(calls.map((call) => call.project))];
  const split = projects.length > 1;

  return projects.map((project) => {
    const groupKey = split ? `legacy/${project}` : 'legacy';
    const entries: TreeEntry[] = [];
    const sections = new Map<string, TreeSection>();

    for (const call of calls.filter((listed) => listed.project === project)) {
      const rest = call.slug.slice(project.length + 1) || call.slug;
      const slash = rest.indexOf('/');

      if (slash <= 0) {
        entries.push(callEntryOf(call, rest));
        continue;
      }

      const stage = rest.slice(0, slash);
      const section = sections.get(stage) ?? { key: `${groupKey}/${stage}`, label: stage, entries: [] };

      section.entries.push(callEntryOf(call, rest.slice(slash + 1)));
      sections.set(stage, section);
    }

    return {
      key: groupKey,
      label: split ? `Legacy · ${project}` : 'Legacy',
      entries,
      sections: [...sections.values()],
    };
  });
};

export type OpenContext = { remembered: Record<string, boolean>; hasProducts: boolean };

/** The keys of the group and the section that hold the entry, outermost first. */
export const holdersOf = (tree: TreeGroup[], key: string | null): string[] => {
  if (key === null) return [];

  for (const group of tree) {
    if (group.entries.some((entry) => entry.key === key)) return [group.key];

    const section = group.sections?.find((candidate) => candidate.entries.some((entry) => entry.key === key));

    if (section) return [group.key, section.key];
  }

  return [];
};

/** Whether a group shows its entries: the remembered choice, else open - except Legacy beside products. */
export const isGroupOpen = (group: TreeGroup, { remembered, hasProducts }: OpenContext) =>
  remembered[group.key] ?? (group.key.startsWith('legacy') ? !hasProducts : true);

/** Whether a section shows its entries: the remembered choice, else folded. */
export const isSectionOpen = (section: TreeSection, { remembered }: OpenContext) => remembered[section.key] ?? false;

/**
 * The groups of the tree that hold a part, an open sketch or a call, each with its entries in listed order.
 * A comment on a sketch variant marks the sketch, any other comment its part.
 */
export const treeOf = (
  parts: ListedPart[],
  {
    calls = [],
    sketches = [],
    comments = [],
  }: { calls?: ListedCall[]; sketches?: ListedSketch[]; comments?: CommentPlace[] } = {},
): TreeGroup[] => {
  const sketched = new Set(sketches.map((sketch) => sketch.target));
  const commentedParts = new Set(comments.filter((comment) => !comment.sketch).map((comment) => comment.part));
  const commentedSketches = new Set(comments.flatMap((comment) => comment.sketch?.target ?? []));

  return SYSTEM_GROUPS.flatMap(({ key, label, layers }) => {
    if (key === 'legacy') return legacyGroupsOf(calls);
    if (key === 'sketches')
      return [{ key, label, entries: sketches.map((sketch) => sketchEntryOf(sketch, commentedSketches)) }];

    return [
      {
        key,
        label,
        entries: parts
          .filter((part) => layers.includes(part.layer))
          .map((part) => ({ key: partKeyOf(part), name: part.name, badges: badgesOf(part, sketched, commentedParts) })),
      },
    ];
  }).filter((group) => group.entries.length > 0 || (group.sections?.length ?? 0) > 0);
};

export type FramesSource = {
  port: number;
  product: ListedProduct;
  part: ListedPart;
  epoch?: number;
  revision?: number;
  surface?: string;
  color?: string;
};

const loadErrorOf = (problems: { rule: string; message: string }[]) =>
  problems
    .filter((problem) => problem.rule === 'LOAD')
    .map((problem) => problem.message)
    .join('\n') || undefined;

const statesOf = (part: ListedPart, error: string | undefined): (string | undefined)[] =>
  part.states.length > 0 ? part.states : error ? [undefined] : [];

const presetFramesOf = ({ port, product, part, epoch, revision, surface, color }: FramesSource): CanvasFrame[] => {
  const key = partKeyOf(part);
  const error = loadErrorOf(part.problems);

  return statesOf(part, error).flatMap((state) =>
    Object.entries(product.presets).map(([preset, { width, height }]) => {
      const address = { port, product: product.name, part: key, state: state ?? '', epoch, revision, surface, color };

      return {
        id: `${state ?? ''} ${preset}`,
        src: partFrameUrl(address),
        width,
        height,
        label: preset,
        row: state,
        screenshot: partShotUrl({ ...address, preset, revision }),
        error,
        ...(state === undefined ? {} : { place: { part: key, state, size: preset } }),
      };
    }),
  );
};

export const FITTED = 'fitted';

export type FrameArrangement = 'sheet' | 'grid';

/** A page and a part with `widths` show a row per state; any other part shows its states as a grid of tiles. */
export const arrangementOf = (part: ListedPart): FrameArrangement =>
  part.layer === 'pages' || (part.widths?.length ?? 0) > 0 ? 'sheet' : 'grid';

/**
 * A page at every preset of the product, a part with `widths` at each width, any other part fitted to
 * its content, one frame per state. Only a `LOAD` problem fails the frames: a part that breaks a rule
 * still renders, and one that does not load lists no states.
 */
export const framesOf = (source: FramesSource): CanvasFrame[] => {
  const { port, product, part, epoch, revision, surface, color } = source;
  const key = partKeyOf(part);
  const error = loadErrorOf(part.problems);
  const states = statesOf(part, error);
  const addressOf = (state: string | undefined) => ({
    port,
    product: product.name,
    part: key,
    state: state ?? '',
    epoch,
    revision,
    surface,
    color,
  });

  if (part.layer === 'pages') return presetFramesOf(source);

  const widths = part.widths ?? [];

  if (widths.length > 0) {
    return states.flatMap((state) =>
      widths.map((width) => ({
        id: `${state ?? ''} ${width}`,
        src: partFrameUrl(addressOf(state)),
        width,
        label: 'width',
        row: state,
        screenshot: partShotUrl({ ...addressOf(state), width, revision }),
        error,
        ...(state === undefined ? {} : { place: { part: key, state, size: width } }),
      })),
    );
  }

  return states.map((state) => ({
    id: state ?? '',
    src: partFrameUrl({ ...addressOf(state), fit: true }),
    label: state ?? key,
    screenshot: partShotUrl({ ...addressOf(state), revision }),
    error,
    ...(state === undefined ? {} : { place: { part: key, state, size: FITTED } }),
  }));
};

export type SketchFramesSource = Omit<FramesSource, 'part'> & {
  sketch: ListedSketch;
  /** The target as the product has it now; `null` for a sketch of a new part. */
  part: ListedPart | null;
  /** The preset name or the width the user picked for every cell; the first one when it is not offered. */
  size?: string | null;
};

export type MatrixColumn = { key: string; label: string; drawing: boolean };

export type SketchMatrix = {
  columns: MatrixColumn[];
  frames: CanvasFrame[];
  /** The preset names of a page or the container widths of a part, for the switch; empty when every cell fits its content. */
  sizes: string[];
  size: string | null;
};

const CURRENT = 'current';

type CellSize = { preset?: string; width?: number; height?: number; label: string };

const cellSizeOf = (product: ListedProduct, size: string | null): CellSize => {
  if (size === null) return { label: '' };

  const preset = product.presets[size];

  return preset
    ? { preset: size, width: preset.width, height: preset.height, label: size }
    : { width: Number(size), label: `${size} px` };
};

/** The sizes a sketch offers: the presets of a page, else every width the part or a variant declares, else none. */
const sketchSizesOf = ({
  product,
  sketch,
  part,
}: {
  product: ListedProduct;
  sketch: ListedSketch;
  part: ListedPart | null;
}) => {
  if (sketch.layer === 'pages') return Object.keys(product.presets);

  const widths = new Set([...(part?.widths ?? []), ...(sketch.targets ?? []).flatMap((target) => target.widths ?? [])]);

  return [...widths].sort((a, b) => a - b).map(String);
};

/**
 * The sketch as a matrix: one column for the part as it is now (when it exists) and one per variant, one
 * row per state - the current states first, then any state only a variant has. Every cell has the one
 * picked size. A column that lacks a row's state gets an empty cell there. A variant the agent reports
 * drawing while the sketch is in progress gets a column without frames.
 */
export const sketchMatrixOf = ({
  port,
  product,
  part,
  sketch,
  size: picked = null,
  epoch,
  revision,
  surface,
  color,
}: SketchFramesSource): SketchMatrix => {
  const sizes = sketchSizesOf({ product, sketch, part });
  const size = picked !== null && sizes.includes(picked) ? picked : (sizes[0] ?? null);
  const cell = cellSizeOf(product, size);
  const drawing = sketch.status === 'in progress' ? (sketch.report?.variant ?? null) : null;
  const targetOf = (variant: string) => sketch.targets?.find((target) => target.variant === variant);
  const columns: (MatrixColumn & { states: string[]; error?: string })[] = [
    ...(part
      ? [{ key: CURRENT, label: CURRENT, drawing: false, states: part.states, error: loadErrorOf(part.problems) }]
      : []),
    ...sketch.variants.map((variant) => {
      const target = targetOf(variant);
      const problems = sketch.problems.find((entry) => entry.variant === variant)?.problems ?? [];

      return {
        key: variant,
        label: variant === drawing ? `${variant} · drawing …` : variant,
        drawing: variant === drawing,
        states: target?.states ?? part?.states ?? [],
        error: [target?.error, loadErrorOf(problems)].filter(Boolean).join('\n') || undefined,
      };
    }),
  ];
  const states = [...new Set(columns.flatMap((column) => column.states))];
  const rows: (string | undefined)[] = states.length > 0 ? states : [undefined];

  const frameOf = (column: (typeof columns)[number], state: string | undefined): CanvasFrame => {
    const address: PartAddress = {
      port,
      product: product.name,
      part: sketch.target,
      state: state ?? '',
      epoch,
      revision,
      surface,
      color,
      ...(column.key === CURRENT ? {} : { sketch: sketch.target, variant: column.key }),
      ...(size === null ? { fit: true } : {}),
    };

    return {
      id: `${column.key} ${state ?? ''}`,
      src: partFrameUrl(address),
      ...(cell.width ? { width: cell.width } : {}),
      ...(cell.height ? { height: cell.height } : {}),
      label: cell.label,
      row: state,
      column: column.key,
      screenshot: partShotUrl({
        ...address,
        preset: cell.preset,
        width: cell.preset ? undefined : cell.width,
        revision,
      }),
      error: column.states.length > 0 ? undefined : column.error,
      ...(state === undefined
        ? {}
        : {
            place: {
              part: sketch.target,
              state,
              size: cell.preset ?? cell.width ?? FITTED,
              ...(column.key === CURRENT ? {} : { sketch: { target: sketch.target, variant: column.key } }),
            },
          }),
    };
  };

  const frames = columns.flatMap((column) => {
    if (column.drawing) return [];

    if (column.states.length === 0) return [frameOf(column, rows[0])];

    return rows.flatMap((state): CanvasFrame[] => {
      if (state === undefined) return [];
      if (column.states.includes(state)) return [frameOf(column, state)];

      return [
        {
          id: `${column.key} ${state}`,
          src: '',
          ...(cell.width ? { width: cell.width } : {}),
          ...(cell.height ? { height: cell.height } : {}),
          label: cell.label,
          row: state,
          column: column.key,
          empty: column.key === CURRENT ? 'new in this sketch' : `${column.key} has no ${state} state`,
        },
      ];
    });
  });

  return {
    columns: columns.map(({ key, label, drawing: isDrawing }) => ({ key, label, drawing: isDrawing })),
    frames,
    sizes,
    size,
  };
};

export type MergePreviewSource = Omit<FramesSource, 'part'> & {
  sketch: ListedSketch;
  variant: string;
  /** The parts that show the target, each as `<layer>/<name>`. */
  affected: string[];
  /** The preset or width the matrix shows; a part that offers it takes it, any other its first size. */
  size?: string | null;
};

/**
 * Each affected part in every state twice: as the product has it now, and as it looks once the
 * variant is merged. A page takes a preset, a part with `widths` a width, any other part fits its content.
 */
export const mergePreviewOf = ({
  port,
  product,
  sketch,
  variant,
  affected,
  size = null,
  epoch,
  revision,
  surface,
  color,
}: MergePreviewSource): SketchMatrix => {
  const columns: MatrixColumn[] = [
    { key: 'now', label: 'now', drawing: false },
    { key: 'merged', label: `after merging ${variant}`, drawing: false },
  ];
  const frames = affected.flatMap((key) => {
    const part = product.parts.find((candidate) => partKeyOf(candidate) === key);

    if (!part) return [];

    const offered = part.layer === 'pages' ? Object.keys(product.presets) : (part.widths ?? []).map(String);
    const cell = cellSizeOf(product, size !== null && offered.includes(size) ? size : (offered[0] ?? null));
    const error = loadErrorOf(part.problems);
    const states = part.states.length > 0 ? part.states : [''];

    return states.flatMap((state) =>
      columns.map((column): CanvasFrame => {
        const address: PartAddress = {
          port,
          product: product.name,
          part: key,
          state,
          epoch,
          revision,
          surface,
          color,
          ...(column.key === 'merged' ? { sketch: sketch.target, variant } : {}),
          ...(cell.width === undefined ? { fit: true } : {}),
        };

        return {
          id: `${column.key} ${key} ${state}`,
          src: partFrameUrl(address),
          ...(cell.width ? { width: cell.width } : {}),
          ...(cell.height ? { height: cell.height } : {}),
          label: cell.label,
          row: state ? `${key} · ${state}` : key,
          column: column.key,
          screenshot: partShotUrl({
            ...address,
            preset: cell.preset,
            width: cell.preset ? undefined : cell.width,
            revision,
          }),
          error: column.key === 'now' ? error : undefined,
        };
      }),
    );
  });

  return { columns, frames, sizes: [], size: null };
};

/** Whether the user may pick a variant: the sketch is ready and the variant breaks no rule. */
export const canPick = (sketch: ListedSketch, variant: string) =>
  sketch.status === 'ready' && (sketch.problems.find((entry) => entry.variant === variant)?.problems.length ?? 0) === 0;

/** The variant the user picked, or `null` before a pick or after a discard decision. */
export const pickedVariantOf = (sketch: ListedSketch) =>
  sketch.decision?.kind === 'pick' && sketch.variants.includes(sketch.decision.variant)
    ? sketch.decision.variant
    : null;

/** The width a call frame takes when its call declares none. */
export const DEFAULT_CALL_WIDTH = 1280;

export type CallFramesSource = {
  port: number;
  call: ListedCall;
  epoch?: number;
  revision?: number;
  surface?: string;
  color?: string;
};

/** One frame per variant of a legacy call, at the call's own frame width. A call that does not load gets one failed frame. */
export const callFramesOf = ({ port, call, epoch, revision, surface, color }: CallFramesSource): CanvasFrame[] => {
  if ('error' in call) {
    return [{ id: call.slug, src: 'about:blank', width: DEFAULT_CALL_WIDTH, label: call.slug, error: call.error }];
  }

  const width = call.frameWidth > 0 ? call.frameWidth : DEFAULT_CALL_WIDTH;

  return call.variants.map((variant) => {
    const address = { port, slug: call.slug, variant: variant.key, epoch, revision, surface, color };

    return {
      id: variant.key,
      src: frameUrl(address),
      width,
      label: variant.name || variant.key,
      screenshot: callShotUrl({ ...address, width }),
    };
  });
};
