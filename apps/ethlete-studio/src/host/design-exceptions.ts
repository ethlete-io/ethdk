import { Observable } from 'rxjs';
import { ProductAddress, designAnswer$ } from './design';

export type ExceptionApproval = { by: string; at: string; hash: string };

/** `reopened`: approved, but the part changed since. */
export type ExceptionState = 'approved' | 'pending' | 'reopened';

/** A requested `design complete` exception, keyed `<layer>/<name>.<control>.<requirement>`. */
export type ListedException = { key: string; state: ExceptionState; reason: string; approval?: ExceptionApproval };

export type DesignException = { reason: string; requested: string; approval?: ExceptionApproval };

/** The exceptions of a part that wait for an approval: never approved, or reopened by a change since. */
export const openExceptionsOf = (exceptions: ListedException[], part: string) =>
  exceptions.filter((exception) => exception.key.startsWith(`${part}.`) && exception.state !== 'approved');

const exceptionsUrl = ({ port, product }: ProductAddress, path: string) =>
  `http://localhost:${port}/__design/${path}?product=${encodeURIComponent(product)}`;

export const listedExceptions$ = (address: ProductAddress): Observable<ListedException[]> =>
  designAnswer$<ListedException[]>(exceptionsUrl(address, 'exceptions'));

export const approveException$ = (
  address: ProductAddress,
  approval: { key: string; by: string },
): Observable<DesignException> =>
  designAnswer$<DesignException>(exceptionsUrl(address, 'exception-approve'), {
    method: 'POST',
    body: JSON.stringify(approval),
  });
