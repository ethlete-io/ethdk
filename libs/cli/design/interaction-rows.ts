export type InteractionRowsOptions<
  TProps,
  TInteraction extends string,
  TRest extends string = never,
  TRow extends string = TRest,
> = {
  interactions: readonly TInteraction[];
  force: (props: TProps, interaction: TInteraction) => TProps;
  restOnly?: readonly (TRest | NoInfer<TRow>)[];
};

type RowState<TRow extends string, TInteraction extends string, TRest extends string> =
  TRow | `${Exclude<TRow, TRest>}-${TInteraction}`;

const isDisabledRow = (props: unknown) =>
  typeof props === 'object' && props !== null && (props as { disabled?: unknown }).disabled === true;

/**
 * Builds the `states` and `grid` of a part from one props object per row: each row is drawn at rest as `<row>` and
 * in each of `interactions` as `<row>-<interaction>`, with the props `force` returns. A row whose props carry
 * `disabled: true`, or that `restOnly` names, is drawn only at rest: name there each row that only changes the
 * content of the first row, such as a badge or a longer title, so its interactions are drawn once, on the first row.
 * Spread the result into `definePart`; the built state names stay in its type.
 */
export const interactionRows = <
  TProps,
  const TRow extends string,
  const TInteraction extends string,
  const TRest extends TRow = never,
>(
  rows: Record<TRow, TProps>,
  { interactions, force, restOnly = [] }: InteractionRowsOptions<TProps, TInteraction, TRest, TRow>,
) => {
  const entries = Object.entries(rows) as [TRow, TProps][];
  const interactionsOf = (row: TRow, props: TProps) =>
    isDisabledRow(props) || (restOnly as readonly string[]).includes(row) ? [] : interactions;
  const states = Object.fromEntries(
    entries.flatMap(([row, props]) => [
      [row, props],
      ...interactionsOf(row, props).map((interaction) => [`${row}-${interaction}`, force(props, interaction)]),
    ]),
  ) as Record<RowState<TRow, TInteraction, TRest>, TProps>;
  const gridRows = Object.fromEntries(
    entries.map(([row, props]) => [
      row,
      Object.fromEntries([
        ['rest', row],
        ...interactionsOf(row, props).map((interaction) => [interaction, `${row}-${interaction}`]),
      ]),
    ]),
  ) as Record<TRow, { rest: TRow } & Partial<Record<TInteraction, RowState<TRow, TInteraction, TRest>>>>;

  return { states, grid: { columns: ['rest', ...interactions] as const, rows: gridRows } };
};
