import { Observable } from 'rxjs';
import { ProductAddress, designAnswer$ } from './design';

export type PartGo = { hash: string; by: string; at: string };

/** What Studio shows of a part's approval: its design hash, its go while it holds, and a direct edit that waits for an accept. */
export type PartApproval = { hash: string | null; go: PartGo | null; directEdit: boolean };

const partUrl = ({ port, product, path, part }: ProductAddress & { path: string; part?: string }) =>
  `http://localhost:${port}/__design/${path}?product=${encodeURIComponent(product)}${part === undefined ? '' : `&part=${encodeURIComponent(part)}`}`;

export const partApproval$ = (address: ProductAddress, part: string): Observable<PartApproval> =>
  designAnswer$<PartApproval>(partUrl({ ...address, path: 'open-points', part }));

/** Stores the Studio user's go for a part at the hash Studio showed. */
export const giveGo$ = (
  address: ProductAddress,
  approval: { part: string; hash: string },
): Observable<{ go: PartGo }> =>
  designAnswer$<{ go: PartGo }>(partUrl({ ...address, path: 'part-go' }), {
    method: 'POST',
    body: JSON.stringify(approval),
  });

/** Accepts the direct edit of a merged part at the hash Studio showed. */
export const acceptEdit$ = (address: ProductAddress, approval: { part: string; hash: string }): Observable<unknown> =>
  designAnswer$<unknown>(partUrl({ ...address, path: 'part-accept' }), {
    method: 'POST',
    body: JSON.stringify(approval),
  });
