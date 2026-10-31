export type InteractionRowsOptions<TProps, TInteraction extends string> = {
  interactions: readonly TInteraction[];
  force: (props: TProps, interaction: TInteraction) => TProps;
};

type RowState<TRow extends string, TInteraction extends string> = TRow | `${TRow}-${TInteraction}`;

const isDisabledRow = (props: unknown) =>
  typeof props === 'object' && props !== null && (props as { disabled?: unknown }).disabled === true;

/**
 * Builds the `states` and `grid` of a part from one props object per row: each row is drawn at rest as `<row>` and
 * in each of `interactions` as `<row>-<interaction>`, with the props `force` returns. A row whose props carry
 * `disabled: true` is drawn only at rest. Spread the result into `definePart`; the built state names stay in its type.
 */
export const interactionRows = <TProps, const TRow extends string, const TInteraction extends string>(
  rows: Record<TRow, TProps>,
  { interactions, force }: InteractionRowsOptions<TProps, TInteraction>,
) => {
  const entries = Object.entries(rows) as [TRow, TProps][];
  const interactionsOf = (props: TProps) => (isDisabledRow(props) ? [] : interactions);
  const states = Object.fromEntries(
    entries.flatMap(([row, props]) => [
      [row, props],
      ...interactionsOf(props).map((interaction) => [`${row}-${interaction}`, force(props, interaction)]),
    ]),
  ) as Record<RowState<TRow, TInteraction>, TProps>;
  const gridRows = Object.fromEntries(
    entries.map(([row, props]) => [
      row,
      Object.fromEntries([
        ['rest', row],
        ...interactionsOf(props).map((interaction) => [interaction, `${row}-${interaction}`]),
      ]),
    ]),
  ) as Record<TRow, { rest: TRow } & Partial<Record<TInteraction, RowState<TRow, TInteraction>>>>;

  return { states, grid: { columns: ['rest', ...interactions] as const, rows: gridRows } };
};
