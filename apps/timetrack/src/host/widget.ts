import { Confidence } from '@ethlete/timetrack';
import { Observable } from 'rxjs';
import { emitHostEvent$, hostEvent$, hostEventWith$ } from './events';
import { invokeHost$ } from './invoke';

/** What the app window publishes for the floating readout. Matches `WIDGET_READOUT_EVENT` below. */
export const WIDGET_READOUT_EVENT = 'widget-readout';

/**
 * What the widget sends when it has mounted.
 *
 * The readout is published on change, so a widget opened between two changes would show nothing for
 * up to a minute. Asking for it is the whole handshake — no state has to be kept anywhere for it.
 */
export const WIDGET_READY_EVENT = 'widget-ready';

/**
 * The day as a floating readout has to state it: what is being recorded, where it goes, and how sure
 * of that the day is.
 *
 * Every duration and every clock time arrives worded, exactly as the tray readout does, so the widget
 * never formats one differently from the review it is a window onto.
 */
export type WidgetReadout = {
  state: 'unknown' | 'paused' | 'idle' | 'working';
  /** What is being recorded, or the reason nothing is. One line. */
  label: string;
  /** The clock time this state began, or empty when it has no beginning to name. */
  since: string;
  /** The issue the current work would be logged on. `null` when nothing names one. */
  issueKey: string | null;
  /** How sure the day is of `issueKey`. `null` exactly when `issueKey` is. */
  confidence: Confidence | null;
  /** The day's total against its target, worded as the tray words it. */
  total: string;
  isPaused: boolean;
};

export type TauriWidget = {
  open$(): Observable<void>;
  close$(): Observable<void>;
  isOpen$(): Observable<boolean>;
  /** Brings the app window back, which is what the widget is the shortest way to. */
  revealApp$(): Observable<void>;
  /** Sends the current readout to the widget, if one is open. */
  publish$(readout: WidgetReadout): Observable<void>;
  /** What the app window publishes. Read by the widget. */
  readout$(): Observable<WidgetReadout>;
  /** Asks the app window for the readout. Sent by the widget once, when it has mounted. */
  announceReady$(): Observable<void>;
  /** A widget asking for the readout it opened too late to receive. Read by the app window. */
  ready$(): Observable<void>;
};

export const createTauriWidget = (): TauriWidget => ({
  open$: () => invokeHost$<void>('widget_open'),
  close$: () => invokeHost$<void>('widget_close'),
  isOpen$: () => invokeHost$<boolean>('widget_is_open'),
  revealApp$: () => invokeHost$<void>('widget_reveal_app'),
  publish$: (readout) => emitHostEvent$(WIDGET_READOUT_EVENT, readout),
  readout$: () => hostEventWith$<WidgetReadout>(WIDGET_READOUT_EVENT),
  announceReady$: () => emitHostEvent$(WIDGET_READY_EVENT, undefined),
  ready$: () => hostEvent$(WIDGET_READY_EVENT),
});
