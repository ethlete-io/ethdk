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

const openedListed$ = ({ port, product, opened }: { port: number; product: string; opened: string }) =>
  designAnswer$<ListedSketches>(
    `http://localhost:${port}/__design/sketches?product=${encodeURIComponent(product)}&sketch=${encodeURIComponent(opened)}`,
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
 * names alone at once and answers the names first, then the quick listing and the compare as each arrives (a quick
 * listing after the compare keeps the compared sketch), then the full listing; a failed or timed out listing keeps the
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
    let compared: ListedSketch[] = [];
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
    const openedCompare = opened ? started(openedListed$({ port, product, opened })) : null;
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
        merge(
          quick.answer$.pipe(map((answer) => keepListed(compared)(answer))),
          openedCompare ? compared$(openedCompare.answer$.pipe(tap((answer) => (compared = answer.sketches)))) : EMPTY,
        ),
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
