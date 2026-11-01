import { Observable, map } from 'rxjs';
import { ProductAddress, designAnswer$ } from './design';

/** One thing that keeps a part from being done, as `design check` and the design server list it. */
export type OpenPoint =
  | { kind: 'missing-state'; control: string | null }
  | { kind: 'contrast'; state: string; path: string }
  | { kind: 'open-comment'; comment: string; state: string; answered: boolean }
  | { kind: 'unmerged-sketch'; status: 'in progress' | 'ready'; decision: 'pick' | 'discard' | null }
  | { kind: 'no-go' }
  | { kind: 'stale-go' }
  | { kind: 'missing-motion'; from: string; to: string };

/** The open points of one part of a product. */
export const partOpenPoints$ = ({ port, product }: ProductAddress, part: string): Observable<OpenPoint[]> =>
  designAnswer$<{ points: OpenPoint[] }>(
    `http://localhost:${port}/__design/open-points?product=${encodeURIComponent(product)}&part=${encodeURIComponent(part)}`,
  ).pipe(map(({ points }) => points));
