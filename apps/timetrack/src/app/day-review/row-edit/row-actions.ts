import { ReviewedRow, appDisplayNameOf, isManualRow } from '@ethlete/timetrack';
import { injectAutoMode } from '../auto-mode';
import { injectDayReview } from '../day-review';
import { RowTicketFiling } from './row-ticket-filing';

type DayReviewStore = NonNullable<ReturnType<typeof injectDayReview>>;

export type RowActionContext = {
  store: DayReviewStore;
  autoMode: NonNullable<ReturnType<typeof injectAutoMode>>;
  row: ReviewedRow;
  rows: readonly ReviewedRow[];
  ticket: RowTicketFiling;
};

type RowActionDefinition = {
  label: string | ((context: RowActionContext) => string);
  order: number;
  destructive?: boolean;
  enabled: (context: RowActionContext) => boolean;
  /** Shown but not pressable, where the context menu can say so. The edit surface leaves it out. */
  disabled?: (context: RowActionContext) => boolean;
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
    label: 'End here',
    order: 5,
    enabled: ({ store, row }) => store.isLiveCall(row),
    run: ({ store, row }) => store.endRowNow(row),
  },
  {
    label: ({ store, row }) => `Count ${appDisplayNameOf(store.excludedCallOf(row)?.appId ?? '')} as work`,
    order: 7,
    enabled: ({ store, row }) => store.excludedCallOf(row)?.excludedBy === 'no-rule',
    run: ({ store, row }) => store.countCallAsWork(row),
  },
  {
    label: "Don't log this time",
    order: 8,
    enabled: ({ row }) => row.state !== 'rejected' && !row.excluded,
    run: ({ store, row }) => store.setState(row, 'rejected'),
  },
  {
    label: 'Log this time',
    order: 8,
    enabled: ({ row }) => row.state === 'rejected' && !row.excluded,
    run: ({ store, row }) => store.setState(row, 'accepted'),
  },
  {
    label: 'Ask auto mode again',
    order: 15,
    enabled: ({ autoMode, row }) => autoMode.canAsk() && !!autoMode.reaskSubjectOf(row),
    disabled: ({ autoMode, row }) => {
      const subject = autoMode.reaskSubjectOf(row);

      return !!subject && autoMode.isAsking(subject);
    },
    run: ({ autoMode, row }) => {
      const subject = autoMode.reaskSubjectOf(row);

      if (subject) autoMode.askAgain(subject);
    },
  },
  {
    label: 'Create a ticket',
    order: 12,
    enabled: ({ ticket, row }) => !!ticket.contextOf(row),
    run: ({ ticket, row }) => ticket.file(row),
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
    enabled: ({ row }) => (row.edited || row.sources?.description === 'auto') && !isManualRow(row),
    run: ({ store, row }) => store.reset(row),
  },
  {
    label: 'Hide this row',
    order: 35,
    enabled: () => true,
    run: ({ store, row }) => store.hide(row),
  },
  {
    label: 'Copy as anonymous report',
    order: 38,
    enabled: () => true,
    run: ({ autoMode, row }) => autoMode.copyAnonymousReport(row.id),
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
  disabled: boolean;
  run: () => void;
};

export const rowActionLabelOf = (action: RowActionDefinition, context: RowActionContext) =>
  typeof action.label === 'string' ? action.label : action.label(context);

/** The actions a row can take right now, in render order, each bound to that row. */
export const rowActionsFor = (context: RowActionContext): RowAction[] =>
  ROW_ACTIONS.filter((action) => action.enabled(context))
    .sort((a, b) => a.order - b.order)
    .map((action) => ({
      label: rowActionLabelOf(action, context),
      order: action.order,
      destructive: action.destructive === true,
      disabled: action.disabled?.(context) === true,
      run: () => action.run(context),
    }));
