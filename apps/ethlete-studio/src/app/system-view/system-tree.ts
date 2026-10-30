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
  rejectionOf,
} from '../../host/design';
import { CanvasFrame, FramePlace, REST } from '../components/design-canvas/canvas-frame';
import { CanvasRowHead } from '../components/design-canvas/design-canvas.component';
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
  | 'changed'
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
export type TreeFrame = { key: string; name: string; part: string; frame: string };

/** A part drawn in more than one frame lists them as `frames`; a part drawn in one is a leaf. */
export type TreeEntry = {
  key: string;
  name: string;
  title?: string;
  badges: PartBadge[];
  count?: number;
  frames?: TreeFrame[];
};

export type TreeSection = { key: string; label: string; entries: TreeEntry[] };

export type TreeGroup = { key: string; label: string; entries: TreeEntry[]; sections?: TreeSection[] };

export const partKeyOf = (part: Pick<ListedPart, 'layer' | 'name'>) => `${part.layer}/${part.name}`;

const badgesOf = (
  part: ListedPart,
  { sketched, marks }: { sketched: ReadonlySet<string>; marks: CommentMarks },
): PartBadge[] => [
  ...(part.origin === 'base' ? (['from base'] as const) : []),
  ...(part.origin === 'overridden' ? (['overridden'] as const) : []),
  ...(part.changedOutsideSketch ? (['changed'] as const) : []),
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
    product = null,
  }: {
    /** The product the parts belong to, to list each part's frames. */
    product?: ListedProduct | null;
    calls?: ListedCall[];
    sketches?: ListedSketch[];
    comments?: (CommentPlace & Pick<ListedComment, 'threadState'>)[];
    /** The target of the sketch whose merge runs. */
    merging?: string | null;
  } = {},
): TreeGroup[] => {
  const sketched = new Set(sketches.map((sketch) => sketch.target));
  const marksOf = (onSketch: boolean): CommentMarks => {
    const own = comments.filter((comment) =>
      comment.sketch
        ? onSketch &&
          sketches.some(
            ({ target, createdAt }) => target === comment.sketch?.target && createdAt === comment.sketch.createdAt,
          )
        : !onSketch,
    );
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
        entries: parts.filter(holds).map((part) => {
          const frames = product ? treeFramesOf(product, part) : [];

          return {
            key: partKeyOf(part),
            name: part.name,
            badges: badgesOf(part, { sketched, marks: partMarks }),
            ...(isWireframe(part) ? { count: part.kitUses } : {}),
            ...(frames.length > 1 ? { frames } : {}),
          };
        }),
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

/** The pages of its own product that use a part, in the order the server lists them. */
export const usingPagesOf = (product: ListedProduct, part: ListedPart | null): ListedPart[] =>
  (part?.usedIn ?? []).flatMap((use) =>
    use.product === product.name ? product.parts.filter((page) => partKeyOf(page) === use.part) : [],
  );

/**
 * The pages of its own product that use any target part of a sketch, each once and none that is a target itself;
 * `part` is the first target as the product has it now.
 */
export const sketchUsingPagesOf = ({
  product,
  sketch,
  part,
}: {
  product: ListedProduct;
  sketch: Pick<ListedSketch, 'target' | 'targetParts'>;
  part: ListedPart | null;
}): ListedPart[] => {
  const targets = sketch.targetParts ?? [sketch.target];
  const pages = targets.flatMap((key) =>
    usingPagesOf(
      product,
      key === sketch.target ? part : (product.parts.find((candidate) => partKeyOf(candidate) === key) ?? null),
    ),
  );

  return [...new Set(pages)].filter((page) => !targets.includes(partKeyOf(page)));
};

const USED_IN = 'used in';

const UNCHANGED_ROW = 'unchanged';

/** The first state of a page at the product's first preset, or fitted when the product has none, to show a part inside it. */
const pageFrameOf = (options: {
  port: number;
  product: ListedProduct;
  page: ListedPart;
  sketch?: { target: string; variant: string };
  epoch?: number;
  revision?: number;
  surface?: string;
  color?: string;
}) => {
  const { port, product, page, sketch, epoch, revision, surface, color } = options;
  const state = page.states[0];

  if (state === undefined) return null;

  const [preset] = Object.keys(product.presets);
  const size = preset === undefined ? undefined : product.presets[preset];
  const key = partKeyOf(page);
  const address: PartAddress = {
    port,
    product: product.name,
    part: key,
    state,
    epoch,
    revision,
    surface,
    color,
    ...(sketch ? { sketch: sketch.target, variant: sketch.variant } : {}),
    ...(preset === undefined ? { fit: true } : {}),
  };

  return {
    src: partFrameUrl(address),
    ...(size ? { width: size.width, ...(size.height === undefined ? {} : { height: size.height }) } : {}),
    label: [key, state, preset].filter(Boolean).join(' · '),
    screenshot: partShotUrl({ ...address, preset, revision }),
    error: loadErrorOf(page.problems),
    place: { part: key, state, size: preset ?? FITTED, ...(sketch ? { sketch } : {}) },
  };
};

const sizeLabelOf = (size: string, interaction: string) => (interaction === REST ? size : `${size} · ${interaction}`);

const stateSizeLabelOf = ({ state, interaction }: Cell, size: string) =>
  state === undefined ? sizeLabelOf(size, interaction) : `${state} · ${sizeLabelOf(size, interaction)}`;

export const FITTED = 'fitted';

type Cell = { state: string | undefined; interaction: string };

/** A part that is no page and declares no `widths` fits its content and draws every state in one frame. */
export const isSmallPart = (part: Pick<ListedPart, 'layer' | 'widths'>) =>
  part.layer !== 'pages' && (part.widths?.length ?? 0) === 0;

const GRID = 'grid';

const SHEET_FILL = 'surface';

/** The states a part's `grid` places, in one frame of cells in rest, each at `width` or fitted without one. */
const gridFrameOf = (options: {
  grid: NonNullable<ListedPart['grid']>;
  width: number | undefined;
  addressOf: (cell: Cell) => PartAddress;
  placeOf: (cell: Cell, size: string | number) => { place?: FramePlace };
  idOf: (cell: Cell, size?: string | number) => string;
  revision?: number;
}): CanvasFrame => {
  const { grid, width, addressOf, placeOf, idOf, revision } = options;

  return {
    id: GRID,
    src: '',
    label: GRID,
    grid: {
      sheet: 'groups',
      columns: grid.columns,
      rows: grid.rows,
      cells: grid.cells.map(({ row, column, state }) => {
        const cell = { state, interaction: REST };

        return {
          id: idOf(cell, width),
          row,
          column,
          label: state,
          src: partFrameUrl({ ...addressOf(cell), fill: SHEET_FILL, ...(width === undefined ? { fit: true } : {}) }),
          ...(width === undefined ? {} : { width }),
          screenshot: partShotUrl({ ...addressOf(cell), fill: SHEET_FILL, width, revision }),
          ...placeOf(cell, width ?? FITTED),
        };
      }),
    },
  };
};

/**
 * Every state of a part in rest and in each interaction it declares: a page at every preset of the
 * product, a part with `widths` at each width, any other part in one frame of fitted cells, a row per state
 * and a column per interaction. A part's `grid` draws the states it places in one more frame, in rest, each cell
 * at the part's first width or fitted. Only a `LOAD` problem fails the frames: a part that breaks a rule still
 * renders, and one that does not load lists no states.
 */
const ownFramesOf = (source: FramesSource): CanvasFrame[] => {
  const { port, product, part, epoch, revision, surface, color } = source;
  const key = partKeyOf(part);
  const error = loadErrorOf(part.problems);
  const grid = part.layer === 'pages' || error ? undefined : part.grid;
  const gridded = new Set(grid?.cells.map((cell) => cell.state));
  const states = statesOf(part, error).filter((state) => state === undefined || !gridded.has(state));
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
  const gridFrames = grid ? [gridFrameOf({ grid, width: widths[0], addressOf, placeOf, idOf, revision })] : [];

  if (widths.length > 0) {
    return [
      ...cells.flatMap((cell) =>
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
      ),
      ...gridFrames,
    ];
  }

  const [first] = cells;

  if (!first) return gridFrames;
  if (error) return [{ id: key, src: partFrameUrl({ ...addressOf(first), fit: true }), label: key, error }];

  return [
    {
      id: key,
      src: '',
      label: key,
      grid: {
        sheet: 'table',
        columns: interactions,
        rows: states.filter((state) => state !== undefined),
        cells: cells.map((cell) => ({
          id: idOf(cell),
          row: cell.state ?? '',
          column: cell.interaction,
          label: `${cell.state} · ${cell.interaction}`,
          src: partFrameUrl({ ...addressOf(cell), fill: SHEET_FILL, fit: true }),
          screenshot: partShotUrl({ ...addressOf(cell), fill: SHEET_FILL, revision }),
          ...placeOf(cell, FITTED),
        })),
      },
    },
    ...gridFrames,
  ];
};

export const frameKeyOf = (part: string, frame: string) => `frame:${part} ${frame}`;

/** The frames a part draws on its own, as tree rows that open the part on that frame. */
const treeFramesOf = (product: ListedProduct, part: ListedPart): TreeFrame[] =>
  ownFramesOf({ port: 0, product, part }).map((frame) => ({
    key: frameKeyOf(partKeyOf(part), frame.id),
    name: frame.label,
    part: partKeyOf(part),
    frame: frame.id,
  }));

/**
 * Every state of a part as `ownFramesOf` draws it, then a `used in` row with the first state of each page
 * of the product that uses the part. When every page of a product with several uses it, the row is one empty cell
 * labelled `used in all N pages` instead.
 */
export const framesOf = (source: FramesSource): CanvasFrame[] => {
  const pages = usingPagesOf(source.product, source.part);
  const total = source.product.parts.filter((part) => part.layer === 'pages').length;

  if (total > 1 && pages.length === total)
    return [
      ...ownFramesOf(source),
      {
        id: USED_IN,
        src: '',
        width: 390,
        height: 120,
        label: USED_IN,
        row: USED_IN,
        rowLabel: `${USED_IN} all ${total} pages`,
        empty: 'every page of the product uses it',
      },
    ];

  return [
    ...ownFramesOf(source),
    ...pages.flatMap((page): CanvasFrame[] => {
      const frame = pageFrameOf({ ...source, page });
      const key = partKeyOf(page);

      return frame
        ? [
            {
              ...frame,
              id: `${USED_IN} ${key}`,
              row: USED_IN,
              rowLabel: USED_IN,
            },
          ]
        : [];
    }),
  ];
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
  /** Whether the user opened (`true`) or folded (`false`) a state no shown variant changes, by state. */
  openStates?: Record<string, boolean>;
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
  section?: string;
};

export type ShownRound = SketchRound & { variants: string[]; open: boolean };

/**
 * The rounds of a sketch, oldest first, with their variants. A round is open as the user chose in
 * `openRounds`, else while it is the newest. A newest round missing from `openRounds` came after that
 * choice, so it opens alone and every older round folds again. Data older than rounds reads as one
 * untitled round `r1`.
 */
export const sketchRoundsOf = (sketch: ListedSketch, openRounds: Record<string, boolean> = {}): ShownRound[] => {
  const rounds: SketchRound[] = sketch.rounds?.length ? sketch.rounds : [{ key: 'r1', title: '', note: '' }];
  const fallback = rounds[0]?.key;
  const newest = rounds[rounds.length - 1]?.key ?? '';
  const chosen = newest in openRounds ? openRounds : {};

  return rounds.map((round) => ({
    ...round,
    variants: sketch.variants.filter((variant) => (sketch.variantInfo?.[variant]?.round ?? fallback) === round.key),
    open: chosen[round.key] ?? round.key === newest,
  }));
};

/** The canvas column or column group key of a round. */
export const roundColumnKeyOf = (round: string) => `round ${round}`;

/** The open flag of every round, to remember; it names the newest round, so a later round folds the older ones again. */
export const openRoundsOf = (rounds: ShownRound[]): Record<string, boolean> =>
  Object.fromEntries(rounds.map((round) => [round.key, round.open]));

/** The canvas row head key of a state no shown variant changes. */
export const stateRowKeyOf = (state: string) => `${UNCHANGED_ROW} ${state}`;

/** The state a `stateRowKeyOf` row key folds, or `null` for another row key. */
export const stateOfRowKey = (key: string) =>
  key.startsWith(`${UNCHANGED_ROW} `) ? key.slice(UNCHANGED_ROW.length + 1) : null;

/** The key a state of one target part of a sketch is opened and folded by: the bare state for the first target. */
export const sketchStateKeyOf = ({
  sketch,
  part,
  state,
}: {
  sketch: Pick<ListedSketch, 'target'>;
  part: string;
  state: string;
}) => (part === sketch.target ? state : `${part} ${state}`);

const roundNameOf = ({ key, title }: SketchRound) => [key, title].filter(Boolean).join(' · ');

/** The label over each frame of a variant the agent may still change. */
export const PENDING_LABEL = 'Agent still drawing';

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
  /** One per folded round, and one per state that every shown variant draws as the part is now: folded to its head unless the user opened it. */
  rowHeads: CanvasRowHead[];
  /** The canvas bands top to bottom when rounds are shown, one per round, newest first; empty for one band. */
  sections: string[];
};

export const CURRENT = 'current';
const SKETCH_SECTION = 'sketch';
const IN_CONTEXT = 'in context';
const contextColumnKeyOf = (column: string) => `${IN_CONTEXT} ${column}`;

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
  stateKey?: string;
  interaction: string;
  key: string | undefined;
  label?: string;
  group?: string;
};

const rowKeyIn = (section: string | undefined, key: string) => (section === undefined ? key : `${section} ${key}`);

/**
 * The sketch as a matrix: one column for the part as it is now (when it exists) and one per variant. With
 * several rounds or a titled one, each round is its own band, newest on top: an open round has its variant
 * columns under a round group, with the current column in the topmost open band, and a folded round is one
 * row head without frames. While the sketch is in progress, every frame of a variant in the newest round is
 * pending. With
 * `ALL` interactions, one row per state and interaction - state by state, each in Studio order - else one
 * row per state in the picked interaction; the current states come first, then any state only a variant
 * has. Every cell has the one picked size. A column that lacks a row's state or interaction gets an empty
 * cell there. A variant the agent reports drawing while the sketch is in progress gets a column without
 * frames, until the report is 30 minutes old: then it draws, and its head notes that no report came. Below
 * it all, an `in context` band has a row per page that uses the target: that page with each column swapped in.
 */
export const sketchMatrixOf = ({
  port,
  product,
  part,
  sketch,
  size: picked = null,
  interaction: pickedInteraction = null,
  openRounds = {},
  openStates = {},
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
  const idOf = (column: string, { stateKey, state, interaction: shown }: MatrixRow) =>
    [column, stateKey ?? state ?? '', ...(shown === REST ? [] : [shown])].join(' ');
  const targetOf = (variant: string, key = sketch.target) =>
    sketch.targets?.find((target) => target.variant === variant && (target.part ?? sketch.target) === key);
  const several = (sketch.targetParts?.length ?? 1) > 1;
  const roundsGrouped = rounds.length > 1 || rounds.some((round) => round.title !== '');
  const newestFirst = [...rounds].reverse().filter((round) => round.variants.length > 0);
  const firstOpen = newestFirst.find((round) => round.open);
  const currentSection = !roundsGrouped ? undefined : firstOpen ? roundColumnKeyOf(firstOpen.key) : CURRENT;
  const sections = !roundsGrouped
    ? []
    : [...(firstOpen ? [] : [CURRENT]), ...newestFirst.map((round) => roundColumnKeyOf(round.key))];
  const pending = new Set(sketch.status === 'in progress' ? (rounds.at(-1)?.variants ?? []) : []);
  const variantColumnOf = (variant: string) => {
    const target = targetOf(variant);
    const problems = sketch.problems.find((entry) => entry.variant === variant)?.problems ?? [];

    const authors = sketch.variantInfo?.[variant]?.authors ?? [];
    const rejected = rejectedLabelOf(sketch, variant);
    const named = [variant, authorsLabelOf(authors), rejected && 'rejected'].filter(Boolean).join(' · ');
    const note = [
      rejected && `${rejected.text} (${rejected.by})`,
      sketch.variantInfo?.[variant]?.note,
      silent && variant === reported && 'No report for 30 min',
    ]
      .filter(Boolean)
      .join('\n\n');

    return {
      key: variant,
      label: variant === drawing ? `${named} · drawing …` : named,
      ...(note === '' ? {} : { note }),
      ...(authors.length > 0 ? { title: `${variant} by ${authors.join(', ')}` } : {}),
      drawing: variant === drawing,
      states: target?.states ?? part?.states ?? [],
      interactions: [REST, ...(target?.interactions ?? part?.interactions ?? [])],
      error: [target?.error, loadErrorOf(problems)].filter(Boolean).join('\n') || undefined,
    };
  };
  const roundHeads: CanvasRowHead[] = [];
  const roundColumns = (roundsGrouped ? newestFirst : rounds).flatMap((round): MatrixColumn[] => {
    const name = roundNameOf(round);
    const shownNote = [round.note, round.lost && `Lost: ${round.lost}`].filter(Boolean).join('\n\n');
    const note = shownNote === '' ? {} : { note: shownNote };
    const section = roundColumnKeyOf(round.key);

    if (round.variants.length === 0) return [];
    if (!roundsGrouped) return round.variants.map(variantColumnOf);
    if (!round.open) {
      const label = [name, round.variants.join(' ')].join(' · ');

      roundHeads.push({
        key: section,
        label,
        title: [`Open ${label}`, shownNote].filter(Boolean).join('\n\n'),
        open: false,
        section,
        ...note,
      });

      return [];
    }

    const group = {
      key: section,
      label: name,
      title: [`Fold ${name}`, shownNote].filter(Boolean).join('\n\n'),
      ...note,
    };

    return round.variants.map((variant) => ({ ...variantColumnOf(variant), group, section }));
  });
  const sectionOf = (column: string) =>
    column === CURRENT ? currentSection : roundColumns.find((candidate) => candidate.key === column)?.section;
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
    ...roundColumns.map((column) => variantColumnOf(column.key)),
  ];
  const rowOf = (row: MatrixRow, column: string) => {
    const section = sectionOf(column);
    const label = section === undefined || row.key === undefined ? row.label : (row.label ?? row.key);

    return {
      row: row.key === undefined ? undefined : rowKeyIn(section, row.key),
      ...(label === undefined ? {} : { rowLabel: label }),
      ...(row.group === undefined ? {} : { rowGroup: row.group }),
    };
  };
  const variantColumns = columns.filter((column) => column.key !== CURRENT);
  const blockOf = (key: string) => {
    const primary = key === sketch.target;
    const listed = primary ? part : (product.parts.find((candidate) => partKeyOf(candidate) === key) ?? null);
    const stateKeyOf = (state: string) => sketchStateKeyOf({ sketch, part: key, state });
    const factsOf = (column: (typeof columns)[number]) => {
      if (primary) return column;
      if (column.key === CURRENT)
        return {
          ...column,
          states: listed?.states ?? [],
          interactions: listed ? interactionsOf(listed) : [REST],
          error: listed ? loadErrorOf(listed.problems) : undefined,
        };

      const target = targetOf(column.key, key);
      const problems = sketch.problems.find((entry) => entry.variant === column.key)?.problems ?? [];

      return {
        ...column,
        states: target?.states ?? listed?.states ?? [],
        interactions: [REST, ...(target?.interactions ?? listed?.interactions ?? [])],
        error: [target?.error, loadErrorOf(problems)].filter(Boolean).join('\n') || undefined,
      };
    };
    const partColumns = columns.map(factsOf);
    const states = [...new Set(partColumns.flatMap((column) => column.states))];
    const unchanged = (state: string) =>
      variantColumns.length > 0 &&
      variantColumns.every((column) => targetOf(column.key, key)?.unchanged?.includes(state) ?? false);
    const kept = (listed?.states ?? []).filter(unchanged);
    const ordered = [...states.filter((state) => !kept.includes(state)), ...kept];
    const rowStates = ordered.filter((state) => !kept.includes(state) || openStates[stateKeyOf(state)] === true);
    const named = (label: string) => (several ? `${key} · ${label}` : label);
    const rows: MatrixRow[] =
      states.length === 0
        ? [
            {
              state: undefined,
              interaction: shownInteractions[0] ?? REST,
              key: primary ? undefined : key,
              ...(primary ? {} : { stateKey: key, label: key, group: key }),
            },
          ]
        : rowStates.flatMap((state) =>
            shownInteractions.map((shown, index): MatrixRow => {
              const stateKey = stateKeyOf(state);

              return grouped
                ? {
                    state,
                    stateKey,
                    interaction: shown,
                    key: `${stateKey} · ${shown}`,
                    group: stateKey,
                    ...(index === 0 ? (several ? { label: named(`${state} · ${shown}`) } : {}) : { label: shown }),
                  }
                : {
                    state,
                    stateKey,
                    interaction: shown,
                    key: stateKey,
                    ...(several ? { label: named(state), group: key } : {}),
                  };
            }),
          );

    const frameOf = (column: (typeof partColumns)[number], row: MatrixRow): CanvasFrame => {
      const { state, interaction: shown } = row;
      const address: PartAddress = {
        port,
        product: product.name,
        part: key,
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
        ...rowOf(row, column.key),
        column: column.key,
        ...(pending.has(column.key) ? { pending: PENDING_LABEL } : {}),
        ...(rejectionOf(sketch, column.key) ? { rejected: true } : {}),
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
                part: key,
                state,
                size: cell.preset ?? cell.width ?? FITTED,
                ...(shown === REST ? {} : { interaction: shown }),
                ...(column.key === CURRENT ? {} : { sketch: { target: sketch.target, variant: column.key } }),
              },
            }),
      };
    };

    const frames = partColumns.flatMap((column) => {
      if (column.drawing) return [];

      const absent = column.key === CURRENT && listed === null;

      if (column.states.length === 0 && !absent) return rows[0] ? [frameOf(column, rows[0])] : [];

      return rows.flatMap((row): CanvasFrame[] => {
        if (row.state === undefined && !absent) return [];

        const missing =
          row.state === undefined || !column.states.includes(row.state)
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
            ...rowOf(row, column.key),
            column: column.key,
            empty: column.key === CURRENT ? 'new in this sketch' : missing,
          },
        ];
      });
    });

    const rowHeads = kept.map((state): CanvasRowHead => {
      const stateKey = stateKeyOf(state);
      const open = openStates[stateKey] === true;

      return {
        key: stateRowKeyOf(stateKey),
        label: named(`${state} · unchanged in ${variantColumns.map((column) => column.key).join(' ')}`),
        title: `${open ? 'Fold' : 'Open'} ${named(state)}: every shown variant draws it as current does`,
        open,
        before: rowKeyIn(currentSection, grouped ? `${stateKey} · ${shownInteractions[0] ?? REST}` : stateKey),
        ...(currentSection === undefined ? {} : { section: currentSection }),
      };
    });

    return { frames, rowHeads };
  };
  const blocks = (sketch.targetParts ?? [sketch.target]).map(blockOf);
  const frames = blocks.flatMap((block) => block.frames);
  const rowHeads = blocks.flatMap((block) => block.rowHeads);

  const headOf = ({ key, label, title, note, drawing: isDrawing, group }: MatrixColumn): MatrixColumn => {
    const section = sectionOf(key);

    return {
      key,
      label,
      drawing: isDrawing,
      ...(title === undefined ? {} : { title }),
      ...(note === undefined ? {} : { note }),
      ...(group === undefined ? {} : { group }),
      ...(section === undefined ? {} : { section }),
    };
  };

  const heads = [...columns.slice(0, part ? 1 : 0), ...roundColumns].map(headOf);
  const pages = sketchUsingPagesOf({ product, sketch, part });
  const contextFrames = pages.flatMap((page) =>
    columns.flatMap((column): CanvasFrame[] => {
      const frame = column.drawing
        ? null
        : pageFrameOf({
            port,
            product,
            page,
            epoch,
            revision,
            surface,
            color,
            ...(column.key === CURRENT ? {} : { sketch: { target: sketch.target, variant: column.key } }),
          });
      const key = partKeyOf(page);

      return frame
        ? [
            {
              ...frame,
              id: `${IN_CONTEXT} ${column.key} ${key}`,
              row: `${IN_CONTEXT} ${key}`,
              rowLabel: `in ${key}`,
              column: contextColumnKeyOf(column.key),
              ...(pending.has(column.key) ? { pending: PENDING_LABEL } : {}),
              ...(rejectionOf(sketch, column.key) ? { rejected: true } : {}),
            },
          ]
        : [];
    }),
  );

  if (contextFrames.length === 0)
    return {
      columns: heads,
      frames,
      sizes,
      size,
      interactions,
      interaction,
      rowHeads: [...roundHeads, ...rowHeads],
      sections,
    };

  const inBand = <T extends { section?: string }>(entry: T) =>
    sections.length > 0 ? entry : { ...entry, section: SKETCH_SECTION };

  return {
    columns: [
      ...heads.map(inBand),
      ...heads.map(({ key, label, drawing: isDrawing }) => ({
        key: contextColumnKeyOf(key),
        label,
        drawing: isDrawing,
        section: IN_CONTEXT,
      })),
    ],
    frames: [...frames, ...contextFrames],
    sizes,
    size,
    interactions,
    interaction,
    rowHeads: [...roundHeads, ...rowHeads].map(inBand),
    sections: [...(sections.length > 0 ? sections : [SKETCH_SECTION]), IN_CONTEXT],
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

  return {
    columns,
    frames,
    sizes: [],
    size: null,
    interactions: [REST],
    interaction: REST,
    rowHeads: [],
    sections: [],
  };
};

/** Whether the user may pick a variant: the sketch is ready, and the variant is not rejected and breaks no rule. */
export const canPick = (sketch: ListedSketch, variant: string) =>
  sketch.status === 'ready' &&
  !rejectionOf(sketch, variant) &&
  (sketch.problems.find((entry) => entry.variant === variant)?.problems.length ?? 0) === 0;

/** The variant the user picked, or `null` before a pick, after a discard decision, or once it is rejected. */
export const pickedVariantOf = (sketch: ListedSketch) =>
  sketch.decision?.kind === 'pick' &&
  sketch.variants.includes(sketch.decision.variant) &&
  !rejectionOf(sketch, sketch.decision.variant)
    ? sketch.decision.variant
    : null;

/** "Rejected: <reason>" or "Rejected", and who rejected the variant and who wrote the reason; `null` while it is live. */
export const rejectedLabelOf = (sketch: Pick<ListedSketch, 'rejections'>, variant: string) => {
  const rejection = rejectionOf(sketch, variant);

  if (!rejection) return null;

  const reasonBy =
    rejection.reason && rejection.reasonBy && rejection.reasonBy !== rejection.by
      ? `, reason by the ${rejection.reasonBy}`
      : '';

  return {
    text: rejection.reason ? `Rejected: ${rejection.reason}` : 'Rejected',
    by: `by the ${rejection.by}${reasonBy}`,
  };
};

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
