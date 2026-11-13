import { Observable, defer, finalize, map, share } from 'rxjs';
import { ProductAddress, designAnswer$ } from './design';

/** One thing that keeps a part from being done, as `design check` and the design server list it. */
export type OpenPoint =
  | { kind: 'missing-state'; control: string | null }
  | { kind: 'open-comment'; comment: string; state: string; answered: boolean }
  | { kind: 'unmerged-sketch'; sketch: string; status: 'in progress' | 'ready'; decision: 'pick' | 'discard' | null }
  | { kind: 'sketch-problem'; sketch: string; variant: string; rule: string; message: string }
  | { kind: 'missing-motion'; from: string; to: string }
  | { kind: 'direct-edit'; sketch: string | null };

/** One thing that keeps a part from being build-ready; `part` names the embedded part it is about. */
export type BuildReadyBlocker = { kind: string; text: string; part?: string };

export type BuildReady = { ready: true } | { ready: false; blockers: BuildReadyBlocker[] };

export type PartOpenPoints = { points: OpenPoint[]; buildReady: BuildReady };

const asked = new Map<string, Observable<unknown>>();

/** The open-points answer of one part; calls that overlap share one request. */
export const openPointsAnswer$ = <TAnswer>({ port, product }: ProductAddress, part: string): Observable<TAnswer> =>
  defer(() => {
    const url = `http://localhost:${port}/__design/open-points?product=${encodeURIComponent(product)}&part=${encodeURIComponent(part)}`;
    const held = asked.get(url);

    if (held) return held as Observable<TAnswer>;

    const shared$ = designAnswer$<TAnswer>(url).pipe(
      finalize(() => asked.delete(url)),
      share(),
    );

    asked.set(url, shared$);

    return shared$;
  });

/** The open points of one part of a product and whether it is build-ready. */
export const partOpenPoints$ = (address: ProductAddress, part: string): Observable<PartOpenPoints> =>
  openPointsAnswer$<PartOpenPoints>(address, part).pipe(map(({ points, buildReady }) => ({ points, buildReady })));
