import { ReviewedRow, isManualRow } from '@ethlete/timetrack';
import { injectDayReview } from '../day-review';

type DayReviewStore = NonNullable<ReturnType<typeof injectDayReview>>;

export type RowActionContext = {
  store: DayReviewStore;
  row: ReviewedRow;
  rows: readonly ReviewedRow[];
};

type RowActionDefinition = {
  label: string;
  order: number;
  destructive?: boolean;
  enabled: (context: RowActionContext) => boolean;
  run: (context: RowActionContext) => void;
};

/** The band that starts where this one ends. Only such a pair can merge without inventing time. */
const nextOf = (context: RowActionContext) =>
  context.rows.find((candidate) => candidate.from.getTime() === context.row.to.getTime()) ?? null;

/**
 * Everything a reviewer can do to a whole row rather than to one of its fields.
 *
 * One list, because two surfaces offer it: the edit surface's action menu and the band's own context
 * menu on the timeline. Defining an entry in either alone is how the two drifted apart before.
 */
export const ROW_ACTIONS: readonly RowActionDefinition[] = [
  {
    label: 'Split in half',
    order: 10,
    enabled: () => true,
    run: ({ store, row }) => store.split(row, new Date((row.from.getTime() + row.to.getTime()) / 2)),
  },
  {
    label: 'Merge with the next band',
    order: 20,
    enabled: (context) => !!nextOf(context),
    run: (context) => {
      const next = nextOf(context);

      if (next) context.store.mergeRows([context.row, next]);
    },
  },
  {
    label: 'Reset to the proposal',
    order: 30,
    enabled: ({ row }) => row.edited && !isManualRow(row),
    run: ({ store, row }) => store.reset(row),
  },
  {
    label: 'Hide this row',
    order: 35,
    enabled: () => true,
    run: ({ store, row }) => store.hide(row),
  },
  {
    label: 'Remove this row',
    order: 40,
    destructive: true,
    enabled: ({ row }) => isManualRow(row),
    run: ({ store, row }) => store.removeRow(row),
  },
];

export type RowAction = {
  label: string;
  order: number;
  destructive: boolean;
  run: () => void;
};

/** The actions a row can take right now, in render order, each bound to that row. */
export const rowActionsFor = (context: RowActionContext): RowAction[] =>
  ROW_ACTIONS.filter((action) => action.enabled(context))
    .sort((a, b) => a.order - b.order)
    .map((action) => ({
      label: action.label,
      order: action.order,
      destructive: action.destructive === true,
      run: () => action.run(context),
    }));
