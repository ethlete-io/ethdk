import { Observable, map } from 'rxjs';
import { ProductAddress, designAnswer$ } from './design';

/** One thing that keeps a part from being done, as `design check` and the design server list it. */
export type OpenPoint =
  | { kind: 'missing-state'; control: string | null }
  | { kind: 'contrast'; state: string; path: string }
  | { kind: 'open-comment'; comment: string; state: string; answered: boolean }
  | { kind: 'unmerged-sketch'; status: 'in progress' | 'ready'; decision: 'pick' | 'discard' | null }
  | { kind: 'missing-motion'; from: string; to: string };

/** One thing that keeps a part from being build-ready; `part` names the embedded part it is about. */
export type BuildReadyBlocker = { kind: string; text: string; part?: string };

export type BuildReady = { ready: true } | { ready: false; blockers: BuildReadyBlocker[] };

export type PartOpenPoints = { points: OpenPoint[]; buildReady: BuildReady };

/** The open points of one part of a product and whether it is build-ready. */
export const partOpenPoints$ = ({ port, product }: ProductAddress, part: string): Observable<PartOpenPoints> =>
  designAnswer$<PartOpenPoints>(
    `http://localhost:${port}/__design/open-points?product=${encodeURIComponent(product)}&part=${encodeURIComponent(part)}`,
  ).pipe(map(({ points, buildReady }) => ({ points, buildReady })));
