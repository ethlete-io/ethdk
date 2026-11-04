import { Observable, catchError, concat, defer, map, of, tap } from 'rxjs';
import { ListedSketch, listedSketches$ } from '../../host/design';

export type SketchRead = { product: string; items: ListedSketch[]; error: string | null };

/** Reads the quick listing, then the full one; a failed or timed out listing keeps the last items and carries the error. */
export const sketchRead$ = ({ port, product }: { port: number; product: string }): Observable<SketchRead> =>
  defer(() => {
    let items: ListedSketch[] = [];

    return concat(listedSketches$({ port, product, quick: true }), listedSketches$({ port, product })).pipe(
      tap((listed) => (items = listed.sketches)),
      map((listed): SketchRead => ({ product, items: listed.sketches, error: null })),
      catchError((error) =>
        of<SketchRead>({ product, items, error: error instanceof Error ? error.message : String(error) }),
      ),
    );
  });
