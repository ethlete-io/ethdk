import { CheckoutKeys } from '@ethlete/timetrack';
import { Observable, catchError, map, of, take } from 'rxjs';
import { HostPorts } from '../../host';

/** This machine's checkout paths and the repository key each one stands for. */
export const ownCheckoutKeys$ = (ports: HostPorts): Observable<CheckoutKeys> =>
  ports.peers.receivedSettings$().pipe(
    map((received) => received.ownRepoKeys),
    take(1),
    catchError(() => of({})),
  );
