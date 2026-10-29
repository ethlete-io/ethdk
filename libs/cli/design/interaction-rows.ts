export type InteractionRowsOptions<TProps, TInteraction extends string> = {
  interactions: readonly TInteraction[];
  force: (props: TProps, interaction: TInteraction) => TProps;
};

type RowState<TRow extends string, TInteraction extends string> = TRow | `${TRow}-${TInteraction}`;

/**
 * Builds the `states` and `grid` of a part from one props object per row: each row is drawn at rest as `<row>` and
 * in each of `interactions` as `<row>-<interaction>`, with the props `force` returns. Spread the result into
 * `definePart`; the built state names stay in its type.
 */
export const interactionRows = <TProps, const TRow extends string, const TInteraction extends string>(
  rows: Record<TRow, TProps>,
  { interactions, force }: InteractionRowsOptions<TProps, TInteraction>,
) => {
  const entries = Object.entries(rows) as [TRow, TProps][];
  const states = Object.fromEntries(
    entries.flatMap(([row, props]) => [
      [row, props],
      ...interactions.map((interaction) => [`${row}-${interaction}`, force(props, interaction)]),
    ]),
  ) as Record<RowState<TRow, TInteraction>, TProps>;
  const gridRows = Object.fromEntries(
    entries.map(([row]) => [
      row,
      Object.fromEntries([['rest', row], ...interactions.map((interaction) => [interaction, `${row}-${interaction}`])]),
    ]),
  ) as Record<TRow, Record<'rest' | TInteraction, RowState<TRow, TInteraction>>>;

  return { states, grid: { columns: ['rest', ...interactions] as const, rows: gridRows } };
};
