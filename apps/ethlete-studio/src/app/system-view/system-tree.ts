import {
  CommentPlace,
  ListedCall,
  ListedComment,
  ListedPart,
  ListedProduct,
  ListedSketch,
  PartAddress,
  SketchRound,
  callShotUrl,
  frameUrl,
  partFrameUrl,
  partShotUrl,
} from '../../host/design';
import { CanvasFrame, REST } from '../components/design-canvas/canvas-frame';
import { isAnswered, isQuestion } from './comment-pins';
import { CompareRow, MERGE_COLUMNS, mergeFrameIdOf } from './merge-preview';

export type SystemGroupKey = 'foundations' | 'components' | 'elements' | 'pages' | 'wireframes' | 'sketches' | 'legacy';

export const isWireframe = (part: Pick<ListedPart, 'layer' | 'kitUses'>) =>
  part.layer === 'pages' && (part.kitUses ?? 0) > 0;

const onLayer = (layer: string) => (part: ListedPart) => part.layer === layer;

export const SYSTEM_GROUPS: readonly { key: SystemGroupKey; label: string; holds: (part: ListedPart) => boolean }[] = [
  { key: 'foundations', label: 'Foundations', holds: onLayer('foundations') },
  { key: 'components', label: 'Components', holds: onLayer('components') },
  { key: 'elements', label: 'Elements', holds: onLayer('elements') },
  { key: 'pages', label: 'Pages', holds: (part) => part.layer === 'pages' && !isWireframe(part) },
  { key: 'wireframes', label: 'Wireframes', holds: isWireframe },
  { key: 'sketches', label: 'Sketches', holds: () => false },
  { key: 'legacy', label: 'Legacy', holds: () => false },
];

export type PartBadge =
  | 'from base'
  | 'overridden'
  | 'error'
  | 'transferred'
  | 'sketch open'
  | 'comment open'
  | 'question'
  | 'answered'
  | 'in progress'
  | 'ready'
  | 'merging';

/** Which parts and sketches hold an open comment, and which of those wait for the user. */
type CommentMarks = { commented: ReadonlySet<string>; questioned: ReadonlySet<string>; answered: ReadonlySet<string> };

const commentBadgesOf = (key: string, { commented, questioned, answered }: CommentMarks): PartBadge[] => {
  if (questioned.has(key)) return ['question'];
  if (answered.has(key)) return ['answered'];
  return commented.has(key) ? ['comment open'] : [];
};

/** `count` is the number of wireframe kit parts a wireframe page uses. */
export type TreeEntry = { key: string; name: string; title?: string; badges: PartBadge[]; count?: number };

export type TreeSection = { key: string; label: string; entries: TreeEntry[] };

export type TreeGroup = { key: string; label: string; entries: TreeEntry[]; sections?: TreeSection[] };

export const partKeyOf = (part: Pick<ListedPart, 'layer' | 'name'>) => `${part.layer}/${part.name}`;

const badgesOf = (
  part: ListedPart,
  { sketched, marks }: { sketched: ReadonlySet<string>; marks: CommentMarks },
): PartBadge[] => [
  ...(part.origin === 'base' ? (['from base'] as const) : []),
  ...(part.origin === 'overridden' ? (['overridden'] as const) : []),
  ...(sketched.has(partKeyOf(part)) ? (['sketch open'] as const) : []),
  ...commentBadgesOf(partKeyOf(part), marks),
  ...(part.problems.length > 0 ? (['error'] as const) : []),
];

export const sketchKeyOf = (target: string) => `sketch:${target}`;

const sketchEntryOf = (
  sketch: ListedSketch,
  { marks, merging }: { marks: CommentMarks; merging: boolean },
): TreeEntry => ({
  key: sketchKeyOf(sketch.target),
  name: sketch.name,
  title: sketch.target,
  badges: [
    merging ? 'merging' : sketch.status,
    ...commentBadgesOf(sketch.target, marks),
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
    merging = null,
  }: {
    calls?: ListedCall[];
    sketches?: ListedSketch[];
    comments?: (CommentPlace & Pick<ListedComment, 'threadState'>)[];
    /** The target of the sketch whose merge runs. */
    merging?: string | null;
  } = {},
): TreeGroup[] => {
  const sketched = new Set(sketches.map((sketch) => sketch.target));
  const marksOf = (onSketch: boolean): CommentMarks => {
    const own = comments.filter((comment) => !!comment.sketch === onSketch);
    const keyOf = (comment: CommentPlace) => comment.sketch?.target ?? comment.part;

    return {
      commented: new Set(own.map(keyOf)),
      questioned: new Set(own.filter(isQuestion).map(keyOf)),
      answered: new Set(own.filter(isAnswered).map(keyOf)),
    };
  };
  const partMarks = marksOf(false);
  const sketchMarks = marksOf(true);

  return SYSTEM_GROUPS.flatMap(({ key, label, holds }) => {
    if (key === 'legacy') return legacyGroupsOf(calls);
    if (key === 'sketches')
      return [
        {
          key,
          label,
          entries: sketches.map((sketch) =>
            sketchEntryOf(sketch, { marks: sketchMarks, merging: sketch.target === merging }),
          ),
        },
      ];

    return [
      {
        key,
        label,
        entries: parts.filter(holds).map((part) => ({
          key: partKeyOf(part),
          name: part.name,
          badges: badgesOf(part, { sketched, marks: partMarks }),
          ...(isWireframe(part) ? { count: part.kitUses } : {}),
        })),
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

/** Rest, then each interaction the part declares, in its order. */
export const interactionsOf = (part: ListedPart): string[] => [REST, ...(part.interactions ?? [])];

/** The columns of a fitted part's table: rest, then each interaction the part declares. */
export const partColumnsOf = (part: ListedPart): { key: string; label: string }[] =>
  interactionsOf(part).map((key) => ({ key, label: key }));

const sizeLabelOf = (size: string, interaction: string) => (interaction === REST ? size : `${size} · ${interaction}`);

const stateSizeLabelOf = ({ state, interaction }: Cell, size: string) =>
  state === undefined ? sizeLabelOf(size, interaction) : `${state} · ${sizeLabelOf(size, interaction)}`;

export const FITTED = 'fitted';

type Cell = { state: string | undefined; interaction: string };

export type FrameArrangement = 'sheet' | 'matrix';

/**
 * A page and a part with `widths` show a row per state with a frame per size and interaction; any other
 * part shows a table with a row per state and a column per interaction.
 */
export const arrangementOf = (part: ListedPart): FrameArrangement =>
  part.layer === 'pages' || (part.widths?.length ?? 0) > 0 ? 'sheet' : 'matrix';

/**
 * Every state of a part in rest and in each interaction it declares: a page at every preset of the
 * product, a part with `widths` at each width, any other part fitted to its content. Only a `LOAD` problem fails the frames: a part that breaks a rule still renders, and
 * one that does not load lists no states.
 */
export const framesOf = (source: FramesSource): CanvasFrame[] => {
  const { port, product, part, epoch, revision, surface, color } = source;
  const key = partKeyOf(part);
  const error = loadErrorOf(part.problems);
  const states = statesOf(part, error);
  const interactions = interactionsOf(part);
  const cells = states.flatMap((state) => interactions.map((interaction) => ({ state, interaction })));
  const addressOf = ({ state, interaction }: Cell) => ({
    port,
    product: product.name,
    part: key,
    state: state ?? '',
    epoch,
    revision,
    surface,
    color,
    ...(interaction === REST ? {} : { interaction }),
  });
  const placeOf = ({ state, interaction }: Cell, size: string | number) =>
    state === undefined ? {} : { place: { part: key, state, size, ...(interaction === REST ? {} : { interaction }) } };
  const idOf = ({ state, interaction }: Cell, size?: string | number) =>
    [state ?? '', ...(size === undefined ? [] : [size]), ...(interaction === REST ? [] : [interaction])].join(' ');

  if (part.layer === 'pages') {
    return cells.flatMap((cell) =>
      Object.entries(product.presets).map(([preset, { width, height }]) => ({
        id: idOf(cell, preset),
        src: partFrameUrl(addressOf(cell)),
        width,
        height,
        label: stateSizeLabelOf(cell, preset),
        row: cell.state,
        screenshot: partShotUrl({ ...addressOf(cell), preset, revision }),
        error,
        ...placeOf(cell, preset),
      })),
    );
  }

  const widths = part.widths ?? [];

  if (widths.length > 0) {
    return cells.flatMap((cell) =>
      widths.map((width) => ({
        id: idOf(cell, width),
        src: partFrameUrl(addressOf(cell)),
        width,
        label: stateSizeLabelOf(cell, 'width'),
        row: cell.state,
        screenshot: partShotUrl({ ...addressOf(cell), width, revision }),
        error,
        ...placeOf(cell, width),
      })),
    );
  }

  return cells.map((cell) => ({
    id: idOf(cell),
    src: partFrameUrl({ ...addressOf(cell), fit: true }),
    label: cell.state === undefined ? key : '',
    row: cell.state,
    column: cell.interaction,
    screenshot: partShotUrl({ ...addressOf(cell), revision }),
    error,
    ...placeOf(cell, FITTED),
  }));
};

export type SketchFramesSource = Omit<FramesSource, 'part'> & {
  sketch: ListedSketch;
  /** The target as the product has it now; `null` for a sketch of a new part. */
  part: ListedPart | null;
  /** The preset name or the width the user picked for every cell; the first one when it is not offered. */
  size?: string | null;
  /** The interaction the user picked for every cell, or `ALL`; `ALL` when it is not offered. */
  interaction?: string | null;
  /** Whether the user opened (`true`) or folded (`false`) a round, by round key. */
  openRounds?: Record<string, boolean>;
  /** The time in ms the agent's report is judged against; without it, a report never expires. */
  now?: number;
};

const REPORT_EXPIRY_MS = 30 * 60_000;

/** When a drawing report stops blocking its variant's column, in ms; `null` for none or an unreadable `updatedAt`. */
export const reportExpiryOf = (report: ListedSketch['report']) => {
  const updatedAt = report ? Date.parse(report.updatedAt) : NaN;

  return Number.isNaN(updatedAt) ? null : updatedAt + REPORT_EXPIRY_MS;
};

/** The interaction switch value that shows every interaction in its own row. */
export const ALL = 'all';

export type MatrixColumn = {
  key: string;
  label: string;
  drawing: boolean;
  title?: string;
  note?: string;
  group?: { key: string; label: string; note?: string; title?: string };
  folded?: { width: number; note?: string };
};

export type ShownRound = SketchRound & { variants: string[]; open: boolean };

/**
 * The rounds of a sketch, oldest first, with their variants. A round is open when the user opened it in
 * `openRounds`, else while it is the newest. Data older than rounds reads as one untitled round `r1`.
 */
export const sketchRoundsOf = (sketch: ListedSketch, openRounds: Record<string, boolean> = {}): ShownRound[] => {
  const rounds: SketchRound[] = sketch.rounds?.length ? sketch.rounds : [{ key: 'r1', title: '', note: '' }];
  const fallback = rounds[0]?.key;

  return rounds.map((round, index) => ({
    ...round,
    variants: sketch.variants.filter((variant) => (sketch.variantInfo?.[variant]?.round ?? fallback) === round.key),
    open: openRounds[round.key] ?? index === rounds.length - 1,
  }));
};

/** The canvas column or column group key of a round. */
export const roundColumnKeyOf = (round: string) => `round ${round}`;

const roundNameOf = ({ key, title }: SketchRound) => [key, title].filter(Boolean).join(' · ');

const FOLDED_MIN_WIDTH = 240;
const FOLDED_FALLBACK_WIDTH = 320;

/** The first author and "+N" for the rest, or `null` without authors. */
export const authorsLabelOf = (authors: string[]) =>
  authors.length === 0 ? null : authors.length === 1 ? authors[0] : `${authors[0]} +${authors.length - 1}`;

export type SketchMatrix = {
  columns: MatrixColumn[];
  frames: CanvasFrame[];
  /** The preset names of a page or the container widths of a part, for the switch; empty when every cell fits its content. */
  sizes: string[];
  size: string | null;
  /** Rest, then every interaction the part or a variant declares in Studio order, for the switch. */
  interactions: string[];
  /** A single interaction, or `ALL`. */
  interaction: string;
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

/** The order Studio shows interactions in; one it does not know goes last. */
const STUDIO_INTERACTIONS = [REST, 'hover', 'focus-visible', 'active', 'disabled'];

const studioRankOf = (interaction: string) => {
  const rank = STUDIO_INTERACTIONS.indexOf(interaction);

  return rank === -1 ? STUDIO_INTERACTIONS.length : rank;
};

const sketchInteractionsOf = ({ sketch, part }: { sketch: ListedSketch; part: ListedPart | null }) =>
  [
    ...new Set([
      REST,
      ...(part?.interactions ?? []),
      ...(sketch.targets ?? []).flatMap((target) => target.interactions ?? []),
    ]),
  ].sort((a, b) => studioRankOf(a) - studioRankOf(b));

type MatrixRow = {
  state: string | undefined;
  interaction: string;
  key: string | undefined;
  label?: string;
  group?: string;
};

/**
 * The sketch as a matrix: one column for the part as it is now (when it exists) and one per variant. With
 * several rounds or a titled one, the variant columns of an open round share a round group, and a folded
 * round is one narrow column without frames. With
 * `ALL` interactions, one row per state and interaction - state by state, each in Studio order - else one
 * row per state in the picked interaction; the current states come first, then any state only a variant
 * has. Every cell has the one picked size. A column that lacks a row's state or interaction gets an empty
 * cell there. A variant the agent reports drawing while the sketch is in progress gets a column without
 * frames, until the report is 30 minutes old: then it draws, and its head notes that no report came.
 */
export const sketchMatrixOf = ({
  port,
  product,
  part,
  sketch,
  size: picked = null,
  interaction: pickedInteraction = null,
  openRounds = {},
  now,
  epoch,
  revision,
  surface,
  color,
}: SketchFramesSource): SketchMatrix => {
  const sizes = sketchSizesOf({ product, sketch, part });
  const size = picked !== null && sizes.includes(picked) ? picked : (sizes[0] ?? null);
  const cell = cellSizeOf(product, size);
  const rounds = sketchRoundsOf(sketch, openRounds);
  const shown = new Set(rounds.flatMap((round) => (round.open ? round.variants : [])));
  const interactions = sketchInteractionsOf({
    sketch: { ...sketch, targets: sketch.targets?.filter((target) => shown.has(target.variant)) },
    part,
  });
  const interaction = pickedInteraction !== null && interactions.includes(pickedInteraction) ? pickedInteraction : ALL;
  const shownInteractions = interaction === ALL ? interactions : [interaction];
  const grouped = shownInteractions.length > 1;
  const reported = sketch.status === 'in progress' ? (sketch.report?.variant ?? null) : null;
  const expiry = reportExpiryOf(sketch.report);
  const silent = reported !== null && now !== undefined && expiry !== null && now >= expiry;
  const drawing = silent ? null : reported;
  const idOf = (column: string, { state, interaction: shown }: MatrixRow) =>
    [column, state ?? '', ...(shown === REST ? [] : [shown])].join(' ');
  const targetOf = (variant: string) => sketch.targets?.find((target) => target.variant === variant);
  const roundsGrouped = rounds.length > 1 || rounds.some((round) => round.title !== '');
  const foldedWidth = Math.max(FOLDED_MIN_WIDTH, Math.round((cell.width ?? FOLDED_FALLBACK_WIDTH) / 2));
  const variantColumnOf = (variant: string) => {
    const target = targetOf(variant);
    const problems = sketch.problems.find((entry) => entry.variant === variant)?.problems ?? [];

    const authors = sketch.variantInfo?.[variant]?.authors ?? [];
    const named = [variant, authorsLabelOf(authors)].filter(Boolean).join(' · ');

    return {
      key: variant,
      label: variant === drawing ? `${named} · drawing …` : named,
      ...(silent && variant === reported ? { note: 'No report for 30 min' } : {}),
      ...(authors.length > 0 ? { title: `${variant} by ${authors.join(', ')}` } : {}),
      drawing: variant === drawing,
      states: target?.states ?? part?.states ?? [],
      interactions: [REST, ...(target?.interactions ?? part?.interactions ?? [])],
      error: [target?.error, loadErrorOf(problems)].filter(Boolean).join('\n') || undefined,
    };
  };
  const roundColumns = rounds.flatMap((round): MatrixColumn[] => {
    const name = roundNameOf(round);
    const note = round.note === '' ? {} : { note: round.note };

    if (round.variants.length === 0) return [];
    if (!roundsGrouped) return round.variants.map(variantColumnOf);
    if (!round.open) {
      const label = [name, round.variants.join(' ')].join(' · ');

      return [
        {
          key: roundColumnKeyOf(round.key),
          label,
          title: [`Open ${label}`, round.note].filter(Boolean).join('\n\n'),
          drawing: false,
          folded: { width: foldedWidth, ...note },
        },
      ];
    }

    const group = {
      key: roundColumnKeyOf(round.key),
      label: name,
      title: [`Fold ${name}`, round.note].filter(Boolean).join('\n\n'),
      ...note,
    };

    return round.variants.map((variant) => ({ ...variantColumnOf(variant), group }));
  });
  const columns: (MatrixColumn & { states: string[]; interactions: string[]; error?: string })[] = [
    ...(part
      ? [
          {
            key: CURRENT,
            label: CURRENT,
            drawing: false,
            states: part.states,
            interactions: interactionsOf(part),
            error: loadErrorOf(part.problems),
          },
        ]
      : []),
    ...roundColumns.flatMap((column) => (column.folded ? [] : [variantColumnOf(column.key)])),
  ];
  const states = [...new Set(columns.flatMap((column) => column.states))];
  const rows: MatrixRow[] =
    states.length === 0
      ? [{ state: undefined, interaction: shownInteractions[0] ?? REST, key: undefined }]
      : states.flatMap((state) =>
          shownInteractions.map((shown, index): MatrixRow =>
            grouped
              ? {
                  state,
                  interaction: shown,
                  key: `${state} · ${shown}`,
                  group: state,
                  ...(index === 0 ? {} : { label: shown }),
                }
              : { state, interaction: shown, key: state },
          ),
        );
  const rowOf = (row: MatrixRow) => ({
    row: row.key,
    ...(row.label === undefined ? {} : { rowLabel: row.label }),
    ...(row.group === undefined ? {} : { rowGroup: row.group }),
  });

  const frameOf = (column: (typeof columns)[number], row: MatrixRow): CanvasFrame => {
    const { state, interaction: shown } = row;
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
      ...(shown === REST ? {} : { interaction: shown }),
    };

    return {
      id: idOf(column.key, row),
      src: partFrameUrl(address),
      ...(cell.width ? { width: cell.width } : {}),
      ...(cell.height ? { height: cell.height } : {}),
      label: cell.label,
      ...rowOf(row),
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
              ...(shown === REST ? {} : { interaction: shown }),
              ...(column.key === CURRENT ? {} : { sketch: { target: sketch.target, variant: column.key } }),
            },
          }),
    };
  };

  const frames = columns.flatMap((column) => {
    if (column.drawing) return [];

    if (column.states.length === 0) return rows[0] ? [frameOf(column, rows[0])] : [];

    return rows.flatMap((row): CanvasFrame[] => {
      if (row.state === undefined) return [];

      const missing = !column.states.includes(row.state)
        ? `${column.key} has no ${row.state} state`
        : !column.interactions.includes(row.interaction)
          ? `${column.key} has no ${row.interaction} interaction`
          : null;

      if (missing === null) return [frameOf(column, row)];

      return [
        {
          id: idOf(column.key, row),
          src: '',
          ...(cell.width ? { width: cell.width } : {}),
          ...(cell.height ? { height: cell.height } : {}),
          label: cell.label,
          ...rowOf(row),
          column: column.key,
          empty: column.key === CURRENT ? 'new in this sketch' : missing,
        },
      ];
    });
  });

  const headOf = ({ key, label, title, note, drawing: isDrawing, group, folded }: MatrixColumn): MatrixColumn => ({
    key,
    label,
    drawing: isDrawing,
    ...(title === undefined ? {} : { title }),
    ...(note === undefined ? {} : { note }),
    ...(group === undefined ? {} : { group }),
    ...(folded === undefined ? {} : { folded }),
  });

  return {
    columns: [...columns.slice(0, part ? 1 : 0), ...roundColumns].map(headOf),
    frames,
    sizes,
    size,
    interactions,
    interaction,
  };
};

export type MergePreviewSource = Omit<FramesSource, 'part'> & {
  sketch: ListedSketch;
  variant: string;
  /** The parts that show the target, each as `<layer>/<name>`. */
  affected: string[];
  /** The preset or width the matrix shows; a part that offers it takes it, any other its first size. */
  size?: string | null;
  /** The compared states to show; without them, every state of every affected part. */
  rows?: CompareRow[] | null;
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
  rows = null,
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
    const rowOf = (state: string) => rows?.find((row) => row.part === key && (row.state === state || row.state === ''));
    const shown = rows === null ? states : states.filter((state) => rowOf(state) !== undefined);

    return shown.flatMap((state) =>
      MERGE_COLUMNS.map((column): CanvasFrame => {
        const rowError = rowOf(state)?.error;
        const address: PartAddress = {
          port,
          product: product.name,
          part: key,
          state,
          epoch,
          revision,
          surface,
          color,
          ...(column === 'merged' ? { sketch: sketch.target, variant } : {}),
          ...(cell.width === undefined ? { fit: true } : {}),
        };

        return {
          id: mergeFrameIdOf({ column, part: key, state }),
          src: partFrameUrl(address),
          ...(cell.width ? { width: cell.width } : {}),
          ...(cell.height ? { height: cell.height } : {}),
          label: cell.label,
          row: state ? `${key} · ${state}` : key,
          column,
          screenshot: partShotUrl({
            ...address,
            preset: cell.preset,
            width: cell.preset ? undefined : cell.width,
            revision,
          }),
          error: rowError ?? (column === 'now' ? error : undefined),
        };
      }),
    );
  });

  return { columns, frames, sizes: [], size: null, interactions: [REST], interaction: REST };
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
