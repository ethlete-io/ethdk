import { CollectedEvent, PresenceEvent } from '../model/event';
import { TimeWindow } from './overlap';

const isPresence = (event: CollectedEvent): event is PresenceEvent => event.source === 'idle';

const clip = (options: { window: TimeWindow; to: TimeWindow }): TimeWindow | null => {
  const from = Math.max(options.window.from.getTime(), options.to.from.getTime());
  const to = Math.min(options.window.to.getTime(), options.to.to.getTime());

  return to > from ? { from: new Date(from), to: new Date(to) } : null;
};

/**
 * The stretches of a window in which the user had stopped collection, from the day's own events.
 *
 * A pause is the one thing the app records about time it deliberately did not watch, so it has to be
 * read back out of the same event stream everything else is: a paused stretch nothing knows about is a
 * stretch the sessionizer bridges and the day bills as work.
 *
 * Both edges are handled, because a pause outlives a calendar day: a `pause-end` with nothing open
 * before it started before the window, and a `pause-start` with no end is still running. `through` is
 * where that open one is cut off — pass `min(now, window.to)`, or a pause taken at nine this morning
 * claims every hour left until midnight.
 */
export const pauseWindows = (options: {
  events: readonly CollectedEvent[];
  /** The window the events were read for. A pause reaching past either edge is clipped to it. */
  window: TimeWindow;
  /** Where a pause that is still running ends. Defaults to the window's own end. */
  through?: Date;
}): TimeWindow[] => {
  const events = options.events
    .filter(isPresence)
    .filter((event) => event.kind === 'pause-start' || event.kind === 'pause-end')
    .slice()
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const windows: TimeWindow[] = [];
  let openedAt: Date | null = null;

  for (const event of events) {
    if (event.kind === 'pause-start') {
      openedAt ??= event.at;
      continue;
    }

    windows.push({ from: openedAt ?? options.window.from, to: event.at });
    openedAt = null;
  }

  if (openedAt) windows.push({ from: openedAt, to: options.through ?? options.window.to });

  return windows
    .map((window) => clip({ window, to: options.window }))
    .filter((window): window is TimeWindow => !!window);
};

/** How much of a window a pause covers. Overlapping pauses cannot happen, so this is a plain sum. */
export const pausedMs = (windows: readonly TimeWindow[]) =>
  windows.reduce((sum, window) => sum + Math.max(0, window.to.getTime() - window.from.getTime()), 0);
