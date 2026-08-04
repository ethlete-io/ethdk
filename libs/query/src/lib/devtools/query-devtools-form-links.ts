import { Signal, signal, untracked } from '@angular/core';
import { collectQueryFormLinks } from './query-devtools-hook';

/** Which query forms a query reads while it builds its args. */
export type QueryDevtoolsFormLinksHandle = {
  /**
   * The devtools ids of the query forms this query's args have read. Empty for a query whose args read
   * none.
   *
   * Accumulates rather than being rebuilt per evaluation: a form's `value` is a memoized signal, so an
   * args build that re-runs for an unrelated reason reads the cached value without going through the
   * form again. Dropping the id there would make the link flicker; a form that a conditional branch
   * stops reading keeps its link until the query is recreated instead.
   */
  ids: Signal<readonly string[]>;
};

/** The write side, used by the code that evaluates a query's args. */
export type QueryDevtoolsFormLinksRecorder = QueryDevtoolsFormLinksHandle & {
  /** Runs `build`, recording every query form whose value it reads. */
  track: <T>(build: () => T) => T;
};

/**
 * Records which query forms feed one query's args, so the devtools can answer "which query does this
 * form drive?" from the reads themselves rather than from a naming convention.
 * @internal
 */
export const createQueryDevtoolsFormLinks = (): QueryDevtoolsFormLinksRecorder => {
  const ids = signal<readonly string[]>([]);

  return {
    ids: ids.asReadonly(),
    track: (build) => {
      const collected = collectQueryFormLinks(build);

      // Args are built inside a reactive computation, which may not write to a signal - `untracked`
      // lifts that restriction, and skipping the write unless something is new keeps the panel from
      // being notified on every evaluation.
      untracked(() => {
        const known = ids();
        const added = collected.ids.filter((id) => !known.includes(id));

        if (added.length) ids.set([...known, ...added]);
      });

      return collected.value;
    },
  };
};
