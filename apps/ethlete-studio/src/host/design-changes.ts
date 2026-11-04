import { Observable, concatMap, filter, map, merge, of, scan } from 'rxjs';
import { designEvents$ } from './design-events';
import { designServerPid$ } from './design-server-pid';
import { PartsChange, partsChangeOf } from './design-parts';

/** What one design server event asks Studio to read again. `all` follows a reconnect to another server or an event it cannot read; `relisted` a reconnect to the same one, which
 * reads the lists again but leaves every frame as it is. */
export type DesignChange =
  | { kind: 'all' }
  | { kind: 'relisted' }
  | { kind: 'calls' }
  | { kind: 'sketches' }
  | { kind: 'parts'; change: PartsChange };

const ALL: DesignChange = { kind: 'all' };

const RELISTED: DesignChange = { kind: 'relisted' };

const reconnects$ = (port: number): Observable<DesignChange> =>
  merge(
    of('start' as const),
    designEvents$(port, 'open').pipe(map(() => 'open' as const)),
    designEvents$(port, 'error').pipe(map(() => 'error' as const)),
  ).pipe(
    scan(
      (state, event) => ({
        dropped: event === 'error' || (state.dropped && event !== 'open'),
        read: event === 'start' || (event === 'open' && state.dropped),
        reconnected: event === 'open' && state.dropped,
      }),
      { dropped: false, read: false, reconnected: false },
    ),
    filter((state) => state.read),
    concatMap(({ reconnected }) => designServerPid$(port).pipe(map((pid) => ({ pid, reconnected })))),
    scan(
      (state, { pid, reconnected }): { known: number | null; change: DesignChange | null } => ({
        known: pid ?? state.known,
        change: reconnected ? (pid !== null && pid === state.known ? RELISTED : ALL) : null,
      }),
      { known: null, change: null } as { known: number | null; change: DesignChange | null },
    ),
    map(({ change }) => change),
    filter((change): change is DesignChange => change !== null),
  );

/** Emits what each change the design server reports names, from its shared event stream. */
export const designChanges$ = (port: number): Observable<DesignChange> =>
  merge(
    reconnects$(port),
    designEvents$(port, 'calls').pipe(map((): DesignChange => ({ kind: 'calls' }))),
    designEvents$(port, 'sketches').pipe(map((): DesignChange => ({ kind: 'sketches' }))),
    designEvents$(port, 'parts').pipe(
      map((event): DesignChange => {
        const change = partsChangeOf(event.data);

        return change ? { kind: 'parts', change } : ALL;
      }),
    ),
  );
