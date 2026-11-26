import { Signal, computed, signal, untracked } from '@angular/core';
import { SIGNAL } from '@angular/core/primitives/signals';
import { collectQueryFormLinks, noteQueryFormRead } from './query-devtools-hook';

/** Which query forms a query reads while it builds its args. */
export type QueryDevtoolsFormLinksHandle = {
  /**
   * The devtools ids of the query forms this query's args have read. Empty for a query whose args read
   * none.
   *
   * Accumulates rather than being rebuilt per evaluation, so a form that a conditional branch stops
   * reading keeps its link until the query is recreated instead of making the panel flicker.
   */
  ids: Signal<readonly string[]>;
};

/** The write side, used by the code that evaluates a query's args. */
export type QueryDevtoolsFormLinksRecorder = QueryDevtoolsFormLinksHandle & {
  /** Runs `build`, recording every query form whose value it reads. */
  track: <T>(build: () => T) => T;
};

/**
 * Wraps the committed value of the query form `formId` in a signal that reports every read to the
 * devtools.
 * @internal
 */
export const noteQueryFormReads = <T>(formId: string, source: Signal<T>): Signal<T> => {
  const memoized = computed(() => source());

  // The read must be noted per read, not per recomputation of the value: the second query to build
  // args reads a memoized value, and a note that only fires on a recomputation never reaches its
  // collection window. Carrying the memo's signal node over keeps this function a real `Signal`.
  const read = () => {
    noteQueryFormRead(formId);

    return memoized();
  };

  return Object.assign(read, { [SIGNAL]: memoized[SIGNAL] });
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
