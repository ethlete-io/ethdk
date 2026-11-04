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

/**
 * Reads the sketch names without loading a part module when `listed` is false, then the quick listing, then the full one;
 * a failed or timed out listing keeps the last items and carries the error.
 */
export const sketchRead$ = ({
  port,
  product,
  listed = false,
}: {
  port: number;
  product: string;
  listed?: boolean;
}): Observable<SketchRead> =>
  defer(() => {
    let items: ListedSketch[] = [];

    return concat(
      listed ? [] : listedOnly$({ port, product }),
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
