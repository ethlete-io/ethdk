import {
  EMPTY,
  Observable,
  catchError,
  concat,
  defer,
  distinctUntilChanged,
  filter,
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

const keepListed = (kept: ListedSketch[]) => (answer: ListedSketches) => ({
  ...answer,
  sketches: answer.sketches.map((sketch) => kept.find((listed) => listed.target === sketch.target) ?? sketch),
});

const openedOf = (picked: string | null) =>
  picked && isSketchKey(picked) ? picked.slice(sketchKeyOf('').length) : null;

/**
 * Reads the sketch names without loading a part module, then the quick listing, then the compare of the sketch
 * `picked` names alone, then the full listing; a failed or timed out listing keeps the last items and carries the
 * error, but a failed compare of a picked sketch only waits for the full listing. A sketch that `picks` names later
 * is compared alone while the full listing runs. A sketch in `kept` that the name listing still lists stays as kept
 * until the quick listing answers.
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
    const compared$ = (sketch: string) =>
      openedListed$({ port, product, opened: sketch }).pipe(
        map((answer) => ({
          ...answer,
          sketches: items.map((listed) => answer.sketches.find((one) => one.target === listed.target) ?? listed),
        })),
        // eslint-disable-next-line ethlete/no-silent-catch-error -- the full listing that follows carries a failure
        catchError(() => EMPTY),
      );
    const full$ = listedSketches$({ port, product }).pipe(share());
    const laterPicks$ = picks.pipe(
      map(openedOf),
      distinctUntilChanged(),
      skipWhile((sketch) => sketch === opened),
      filter((sketch): sketch is string => sketch !== null),
    );

    return concat(
      kept ? listedOnly$({ port, product }).pipe(map(keepListed(kept))) : listedOnly$({ port, product }),
      listedSketches$({ port, product, quick: true }),
      opened ? compared$(opened) : EMPTY,
      merge(full$, laterPicks$.pipe(switchMap(compared$), takeUntil(full$))),
    ).pipe(
      tap((answer) => (items = answer.sketches)),
      map((answer): SketchRead => ({ product, items: answer.sketches, error: null })),
      catchError((error) =>
        of<SketchRead>({ product, items, error: error instanceof Error ? error.message : String(error) }),
      ),
    );
  });
