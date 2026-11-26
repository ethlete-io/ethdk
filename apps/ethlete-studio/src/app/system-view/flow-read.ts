import { Observable, catchError, defer, map, of } from 'rxjs';
import { ListedFlow, listedFlows$ } from '../../host/design-flows';

export type FlowRead = { product: string; items: ListedFlow[]; error: string | null };

/** A failed read for the product already shown keeps that read's items. */
export const keepLastFlows = (last: FlowRead | null, read: FlowRead | null): FlowRead | null =>
  read?.error && last?.product === read.product ? { ...read, items: last.items } : read;

/** Reads the flow listing; a failed listing carries the error. */
export const flowRead$ = ({ port, product }: { port: number; product: string }): Observable<FlowRead> =>
  defer(() =>
    listedFlows$({ port, product }).pipe(
      map(({ flows }): FlowRead => ({ product, items: flows, error: null })),
      catchError((error) =>
        of<FlowRead>({ product, items: [], error: error instanceof Error ? error.message : String(error) }),
      ),
    ),
  );
