import { ReviewedRow, UnnamedContext } from '@ethlete/timetrack';
import { injectAutoMode } from '../auto-mode';
import { injectDayReview } from '../day-review';

type DayReviewStore = NonNullable<ReturnType<typeof injectDayReview>>;

export type RowTicketFiling = {
  contextOf: (row: ReviewedRow) => UnnamedContext | null;
  file: (row: ReviewedRow) => void;
};

export const unnamedContextOf = (options: {
  row: Pick<ReviewedRow, 'issueKey' | 'standInId' | 'state'>;
  context: UnnamedContext | null;
}) => (options.row.issueKey || options.row.standInId || options.row.state === 'rejected' ? null : options.context);

export const rowTicketFiling = (options: {
  store: DayReviewStore;
  autoMode: NonNullable<ReturnType<typeof injectAutoMode>>;
  open: (context: UnnamedContext) => void;
}): RowTicketFiling => {
  const contextOf = (row: ReviewedRow) => {
    const subject = options.autoMode.reaskSubjectOf(row);
    const context =
      subject?.kind === 'context' ? options.store.unnamed().find((c) => c.id === subject.contextId) : null;

    return unnamedContextOf({ row, context: context ?? null });
  };

  return {
    contextOf,
    file: (row) => {
      const context = contextOf(row);

      if (context) options.open(context);
    },
  };
};
