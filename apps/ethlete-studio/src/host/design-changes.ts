import { Observable, filter, map, merge, scan } from 'rxjs';
import { designEvents$ } from './design-events';
import { PartsChange, partsChangeOf } from './design-parts';

/** What one design server event asks Studio to read again. `all` follows a reconnect or an event it cannot read. */
export type DesignChange =
  { kind: 'all' } | { kind: 'calls' } | { kind: 'sketches' } | { kind: 'parts'; change: PartsChange };

const ALL: DesignChange = { kind: 'all' };

const reconnects$ = (port: number): Observable<DesignChange> =>
  merge(designEvents$(port, 'open'), designEvents$(port, 'error')).pipe(
    scan((state, event) => ({ dropped: event.name === 'error', reconnected: event.name === 'open' && state.dropped }), {
      dropped: false,
      reconnected: false,
    }),
    filter((state) => state.reconnected),
    map(() => ALL),
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
