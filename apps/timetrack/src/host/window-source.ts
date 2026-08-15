import { CollectedEvent, PresenceEvent, WindowFocusEvent } from '@ethlete/timetrack';
import { Observable, map } from 'rxjs';
import { invokeHost$ } from './invoke';

type HostWindowEvent = { seq: number; atMs: number } & (
  { kind: 'window-focus'; appId: string; title: string } | { kind: 'idle-start' | 'idle-end' }
);

type HostWindowBatch = {
  events: HostWindowEvent[];
  nextSeq: number;
  dropped: number;
};

export type WindowSourceStatus = {
  /**
   * `wayland-wlr` while the compositor is reporting, `macos-ax` while the Accessibility permission
   * grants titles, `macos-app-only` while it does not, `none` when nothing is watching.
   */
  kind: string;
  detail: string | null;
};

/** The status a macOS source reports until the Accessibility permission is granted. */
export const WINDOW_SOURCE_NEEDS_ACCESSIBILITY = 'macos-app-only';

export type WindowBatch = {
  events: CollectedEvent[];
  /** The sequence to acknowledge once these are stored. Unchanged from the request when empty. */
  throughSeq: number;
  /** Samples the host dropped because nothing drained it in time. A non-zero count is a real gap. */
  dropped: number;
};

const reviveEvent = (event: HostWindowEvent): CollectedEvent => {
  const at = new Date(event.atMs);

  return event.kind === 'window-focus'
    ? ({
        at,
        source: 'window',
        kind: 'window-focus',
        appId: event.appId,
        title: event.title,
      } satisfies WindowFocusEvent)
    : ({ at, source: 'idle', kind: event.kind } satisfies PresenceEvent);
};

/**
 * The host's buffer of focus and presence samples.
 *
 * Nothing is released until `afterSeq` says it was stored, so a reload between reading and storing
 * repeats a sample rather than losing it.
 */
export type TauriWindowSource = {
  batch$(afterSeq: number): Observable<WindowBatch>;
  status$(): Observable<WindowSourceStatus>;
  /**
   * Asks the platform for the permission window titles need, and answers the state after asking.
   *
   * macOS shows its dialog once per binary and only ever opens Settings afterwards, so a `false`
   * answer means the user has not granted it yet, not that they refused just now.
   */
  requestAccessibility$(): Observable<boolean>;
};

export const createTauriWindowSource = (): TauriWindowSource => ({
  batch$: (afterSeq) =>
    invokeHost$<HostWindowBatch>('window_events', { afterSeq }).pipe(
      map((batch) => ({
        events: batch.events.map(reviveEvent),
        throughSeq: batch.events[batch.events.length - 1]?.seq ?? afterSeq,
        dropped: batch.dropped,
      })),
    ),
  status$: () => invokeHost$<WindowSourceStatus>('window_source_status'),
  requestAccessibility$: () => invokeHost$<boolean>('window_request_accessibility'),
});
