import {
  EMPTY,
  Observable,
  ReplaySubject,
  catchError,
  concat,
  defer,
  distinctUntilChanged,
  filter,
  ignoreElements,
  map,
  merge,
  of,
  share,
  skipWhile,
  switchMap,
  takeUntil,
  tap,
  timeout,
} from 'rxjs';
import {
  LISTED_SKETCHES_TIMEOUT_MS,
  ListedSketch,
  ListedSketches,
  designAnswer$,
  listedSketches$,
} from '../../host/design';
import { isSketchKey, sketchKeyOf } from './system-tree';

export type SketchRead = { product: string; items: ListedSketch[]; error: string | null };

const listedOnly$ = ({ port, product }: { port: number; product: string }) =>
  designAnswer$<ListedSketches>(
    `http://localhost:${port}/__design/sketches?product=${encodeURIComponent(product)}&unchanged=no&targets=no`,
  ).pipe(timeout(LISTED_SKETCHES_TIMEOUT_MS));

/** How many leading states of a picked sketch are compared first, so its view shows before the rest is compared. */
export const OPENED_FIRST_STATES = 6;

const openedListed$ = ({
  port,
  product,
  opened,
  first = null,
}: {
  port: number;
  product: string;
  opened: string;
  first?: number | null;
}) =>
  designAnswer$<ListedSketches>(
    `http://localhost:${port}/__design/sketches?product=${encodeURIComponent(product)}&sketch=${encodeURIComponent(opened)}${first === null ? '' : `&first=${first}`}`,
  ).pipe(timeout(LISTED_SKETCHES_TIMEOUT_MS));

const started = <T>(source$: Observable<T>) => {
  const answer$ = source$.pipe(
    share({ connector: () => new ReplaySubject<T>(), resetOnError: false, resetOnComplete: false }),
  );

  return {
    answer$,
    start$: answer$.pipe(
      ignoreElements(),
      // eslint-disable-next-line ethlete/no-silent-catch-error -- answer$ carries the failure in its turn
      catchError(() => EMPTY),
    ),
  };
};

const keepListed = (kept: ListedSketch[]) => (answer: ListedSketches) => ({
  ...answer,
  sketches: answer.sketches.map((sketch) => kept.find((listed) => listed.target === sketch.target) ?? sketch),
});

const openedOf = (picked: string | null) =>
  picked && isSketchKey(picked) ? picked.slice(sketchKeyOf('').length) : null;

/**
 * Reads the sketch names without loading a part module, the quick listing and the compare of the sketch `picked`
 * names alone at once and answers them in that order, then the full listing; the picked sketch's compare
 * first answers its leading `OPENED_FIRST_STATES` states, then all of them; a failed or timed out listing keeps the
 * last items and carries the error, but a failed compare of a picked sketch only waits for the full listing. A sketch
 * that `picks` names later is compared alone while the full listing runs. A sketch in `kept` that the name listing
 * still lists stays as kept until the quick listing answers.
 */
export const sketchRead$ = ({
  port,
  product,
  kept = null,
  picked = null,
  picks = EMPTY,
}: {
  port: number;
  product: string;
  kept?: ListedSketch[] | null;
  picked?: string | null;
  picks?: Observable<string | null>;
}): Observable<SketchRead> =>
  defer(() => {
    let items: ListedSketch[] = kept ?? [];
    const opened = openedOf(picked);
    const compared$ = (answer$: Observable<ListedSketches>) =>
      answer$.pipe(
        map((answer) => ({
          ...answer,
          sketches: items.map((listed) => answer.sketches.find((one) => one.target === listed.target) ?? listed),
        })),
        // eslint-disable-next-line ethlete/no-silent-catch-error -- the full listing that follows carries a failure
        catchError(() => EMPTY),
      );
    const names = started(listedOnly$({ port, product }));
    const quick = started(listedSketches$({ port, product, quick: true }));
    const openedFirst = opened ? started(openedListed$({ port, product, opened, first: OPENED_FIRST_STATES })) : null;
    const openedCompare = opened
      ? started(concat(openedFirst?.start$ ?? EMPTY, openedListed$({ port, product, opened })))
      : null;
    const full$ = listedSketches$({ port, product }).pipe(share());
    const laterPicks$ = picks.pipe(
      map(openedOf),
      distinctUntilChanged(),
      skipWhile((sketch) => sketch === opened),
      filter((sketch): sketch is string => sketch !== null),
    );

    return merge(
      names.start$,
      quick.start$,
      openedCompare?.start$ ?? EMPTY,
      concat(
        kept ? names.answer$.pipe(map(keepListed(kept))) : names.answer$,
        quick.answer$,
        openedFirst ? compared$(openedFirst.answer$) : EMPTY,
        openedCompare ? compared$(openedCompare.answer$) : EMPTY,
        merge(
          full$,
          laterPicks$.pipe(
            switchMap((sketch) => compared$(openedListed$({ port, product, opened: sketch }))),
            takeUntil(full$),
          ),
        ),
      ),
    ).pipe(
      tap((answer) => (items = answer.sketches)),
      map((answer): SketchRead => ({ product, items: answer.sketches, error: null })),
      catchError((error) =>
        of<SketchRead>({ product, items, error: error instanceof Error ? error.message : String(error) }),
      ),
    );
  });
