export const GRID_REST = 'rest';

const GRID_INTERACTIONS = ['hover', 'active', 'focus-visible'] as const;

export type InteractionGridLine = { base: string; states: (string | null)[] };

export type InteractionGrid = { interactions: string[]; lines: InteractionGridLine[] };

const splitOf = (state: string) => {
  const interaction = GRID_INTERACTIONS.find((name) => state === name || state.endsWith(`-${name}`));

  if (!interaction) return { base: state, interaction: GRID_REST };

  return { base: state.slice(0, Math.max(0, state.length - interaction.length - 1)), interaction };
};

/**
 * Lays states out as the interaction grid of the SDK pages: one line per base state in first-seen order, one column per
 * interaction in the order rest, hover, active, focus-visible, keeping only the columns a state fills. A state named
 * `<base>-<interaction>` goes to the line of `<base>`. Returns null when no state names an interaction.
 */
export const interactionGridOf = (states: readonly string[]): InteractionGrid | null => {
  const split = states.map((state) => ({ state, ...splitOf(state) }));

  if (split.every(({ interaction }) => interaction === GRID_REST)) return null;

  const interactions = [GRID_REST, ...GRID_INTERACTIONS].filter((name) =>
    split.some(({ interaction }) => interaction === name),
  );
  const bases = [...new Set(split.map(({ base }) => base))];

  return {
    interactions,
    lines: bases.map((base) => ({
      base,
      states: interactions.map(
        (name) => split.find((entry) => entry.base === base && entry.interaction === name)?.state ?? null,
      ),
    })),
  };
};

/** The width of every interaction column of a variant: its widest shot, unscaled. */
export const gridColumnWidthOf = ({ width, shots }: { width: number; shots: readonly { width?: number }[] }) =>
  Math.max(width, ...shots.map((shot) => shot.width ?? width));

const SCALE_STEPS = 30;

/**
 * The one sketch scale at which every variant's interaction columns fit `room`: a column takes its frame width times
 * the scale, or its head's width when that is wider. `columns` holds each variant's frame width, `heads` each column
 * head's width.
 */
export const gridScaleOf = ({ room, columns, heads }: { room: number; columns: number[]; heads: number[] }) => {
  const widthAt = (scale: number) =>
    columns.reduce((sum, width) => sum + heads.reduce((line, head) => line + Math.max(width * scale, head), 0), 0);

  if (widthAt(1) <= room) return 1;

  let low = 0;
  let high = 1;

  for (let step = 0; step < SCALE_STEPS; step++) {
    const middle = (low + high) / 2;

    if (widthAt(middle) <= room) low = middle;
    else high = middle;
  }

  return low;
};

export const STACK_BELOW_SCALE = 0.45;

/**
 * Whether the variants stack below each other: side by side, in `room`, they would draw below `STACK_BELOW_SCALE`, or
 * their widest column below `minColumn` px. Takes the same `columns` and `heads` as `gridScaleOf`; without column heads
 * pass a 0 per column.
 */
export const variantsStackedOf = ({
  room,
  columns,
  heads,
  minColumn = 0,
}: {
  room: number;
  columns: number[];
  heads: number[];
  minColumn?: number;
}) =>
  columns.length > 1 &&
  gridScaleOf({ room, columns, heads }) < Math.max(STACK_BELOW_SCALE, minColumn / Math.max(1, ...columns));
