import { Observable, catchError, concat, defer, map, of, tap, timeout } from 'rxjs';
import {
  LISTED_SKETCHES_TIMEOUT_MS,
  ListedSketch,
  ListedSketches,
  designAnswer$,
  listedSketches$,
} from '../../host/design';

export type SketchRead = { product: string; items: ListedSketch[]; error: string | null };

const listedOnly$ = ({ port, product }: { port: number; product: string }) =>
  designAnswer$<ListedSketches>(
    `http://localhost:${port}/__design/sketches?product=${encodeURIComponent(product)}&unchanged=no&targets=no`,
  ).pipe(timeout(LISTED_SKETCHES_TIMEOUT_MS));

const keepListed = (kept: ListedSketch[]) => (answer: ListedSketches) => ({
  ...answer,
  sketches: answer.sketches.map((sketch) => kept.find((listed) => listed.target === sketch.target) ?? sketch),
});

/**
 * Reads the sketch names without loading a part module, then the quick listing, then the full one; a failed or timed
 * out listing keeps the last items and carries the error. A sketch in `kept` that the name listing still lists stays
 * as kept until the quick listing answers.
 */
export const sketchRead$ = ({
  port,
  product,
  kept = null,
}: {
  port: number;
  product: string;
  kept?: ListedSketch[] | null;
}): Observable<SketchRead> =>
  defer(() => {
    let items: ListedSketch[] = kept ?? [];

    return concat(
      kept ? listedOnly$({ port, product }).pipe(map(keepListed(kept))) : listedOnly$({ port, product }),
      listedSketches$({ port, product, quick: true }),
      listedSketches$({ port, product }),
    ).pipe(
      tap((answer) => (items = answer.sketches)),
      map((answer): SketchRead => ({ product, items: answer.sketches, error: null })),
      catchError((error) =>
        of<SketchRead>({ product, items, error: error instanceof Error ? error.message : String(error) }),
      ),
    );
  });
