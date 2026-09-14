import { CollectedEvent } from '../model/event';
import { TimeWindow, mergeWindows } from '../model/time-window';
import { WorkGroup } from './merge';

const LEAVING: ReadonlySet<string> = new Set(['idle-start', 'lock']);
const RETURNING: ReadonlySet<string> = new Set(['idle-end', 'unlock']);

/** An away stretch the day never closed runs to the end of time: nothing ever said the person came back. */
const NEVER_CAME_BACK = new Date(8.64e15);

/**
 * The stretches the notifier said nobody was watching, from the transitions that open and close them.
 */
const awayStretches = (events: readonly CollectedEvent[]): TimeWindow[] => {
  const transitions = events
    .filter((event) => event.source === 'idle' && (LEAVING.has(event.kind) || RETURNING.has(event.kind)))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  const away: TimeWindow[] = [];

  let left: Date | undefined;

  for (const event of transitions) {
    if (LEAVING.has(event.kind)) {
      left ??= event.at;
      continue;
    }

    if (left) away.push({ from: left, to: event.at });
    left = undefined;
  }

  if (left) away.push({ from: left, to: NEVER_CAME_BACK });

  return away;
};

/**
 * The stretches a person was demonstrably at this machine, each instant widened by `graceMs`.
 *
 * Four things can say a person was there, and nothing else can: a window they brought to the front, an
 * idle transition the notifier saw, a prompt they gave an agent, and a call they held. A turn, a
 * session, a commit and an editor heartbeat all say the machine worked, which is a different question —
 * an agent on a schedule produces every one of them with nobody in the room.
 *
 * An instant is widened because a person works a stretch of a day rather than a band of it: they step
 * away for ten minutes while an agent runs, and the quarter hour that leaves behind is still time they
 * were there for.
 *
 * An away stretch is a wall the grace cannot cross, and the one thing on a day that says where a person
 * was *not*. An instant inside one is no person at all — the compositor reports a focus change as the
 * session idles, three seconds after the transition — and an instant outside one reaches only up to its
 * edge. Without the wall, the first window of the afternoon would answer for the last quarter hour of
 * the lunch break it came back from.
 */
export const attendedAt = (options: { events: readonly CollectedEvent[]; graceMs: number }): TimeWindow[] => {
  const grace = Math.max(0, options.graceMs);
  const away = awayStretches(options.events).map((stretch) => ({
    from: stretch.from.getTime(),
    to: stretch.to.getTime(),
  }));
  const instants = options.events
    .filter((event) => {
      if (event.source === 'window' || event.source === 'idle') return true;

      return event.kind === 'agent-prompt' && event.askedBy !== 'machine';
    })
    .map((event) => event.at.getTime())
    .filter((at) => !away.some((stretch) => at > stretch.from && at < stretch.to));

  return mergeWindows(
    instants.map((at) => ({
      from: new Date(
        away.reduce((edge, stretch) => (stretch.to <= at ? Math.max(edge, stretch.to) : edge), at - grace),
      ),
      to: new Date(
        away.reduce((edge, stretch) => (stretch.from >= at ? Math.min(edge, stretch.from) : edge), at + grace),
      ),
    })),
  );
};

/**
 * Marks each group with whether anybody was there for it.
 *
 * One stretch of attendance touching a band answers for the whole band. `false` is reserved for what it
 * is for — a chunk that ran with nobody in the room at all, such as a scheduled agent session at five
 * on a Sunday morning, which no stretch of presence comes near.
 *
 * The test is deliberately lenient in that direction — a row wrongly called unattended costs the user a
 * manual entry, and a row wrongly called attended is what puts hours nobody worked into Tempo. The
 * grace inside {@link attendedAt} is what keeps both true at once: it is short enough that a night's run
 * reaches no one, and it stops dead at an away stretch.
 *
 * A band the user claimed themselves is attended whatever the events say. A timer they started and a
 * call they held are both acts of a person, and neither leaves a window event behind.
 */
export const markAttendance = (options: {
  groups: readonly WorkGroup[];
  at: readonly TimeWindow[];
  /** The stretches the user claimed by hand: the runs they timed and the calls a rule counted as work. */
  claimed?: readonly TimeWindow[];
}): WorkGroup[] => {
  const spans = [...options.at, ...(options.claimed ?? [])].map((window) => ({
    from: window.from.getTime(),
    to: window.to.getTime(),
  }));

  return options.groups.map((group) => {
    const from = group.from.getTime();
    const to = group.to.getTime();

    return { ...group, attended: spans.some((span) => span.from < to && span.to > from) };
  });
};
