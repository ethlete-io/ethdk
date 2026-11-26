import { Observable, map } from 'rxjs';
import { invokeHost$ } from './invoke';

type HostCollectionState = { pausedAtMs: number | null };

/** When collection was stopped, or `null` while it is running. */
export type CollectionState = { pausedAt: Date | null };

/**
 * The host's own record of whether it is collecting.
 *
 * It is host state rather than a setting because the samplers start before the webview does: a pause
 * the window had to load in order to apply would collect the first seconds of every restart. Writing
 * it also writes the `pause-start` / `pause-end` event the day is reconstructed from, in the same
 * transaction, so the collectors and the record can never disagree about a stretch of time.
 */
export type TauriCollectionPause = {
  state$(): Observable<CollectionState>;
  setPaused$(paused: boolean, at: Date): Observable<CollectionState>;
};

const revive = (state: HostCollectionState): CollectionState => ({
  pausedAt: state.pausedAtMs === null ? null : new Date(state.pausedAtMs),
});

export const createTauriCollectionPause = (): TauriCollectionPause => ({
  state$: () => invokeHost$<HostCollectionState>('collection_state').pipe(map(revive)),
  setPaused$: (paused, at) =>
    invokeHost$<HostCollectionState>('collection_set_paused', { paused, atMs: at.getTime() }).pipe(map(revive)),
});
