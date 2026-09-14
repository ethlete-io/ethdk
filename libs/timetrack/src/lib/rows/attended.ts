import { CollectedEvent } from '../model/event';
import { TimeWindow } from '../model/time-window';
import { WorkGroup } from './merge';

/** Which way an instant answers for: the time before it, the time after it, or both. */
export type PresenceSide = 'both' | 'before' | 'after';

/** One instant a person was demonstrably at this machine, and which way it answers. */
export type Presence = { at: Date; side: PresenceSide };

const sideOf = (event: CollectedEvent): PresenceSide => {
  if (event.source !== 'idle') return 'both';

  return event.kind === 'idle-end' || event.kind === 'unlock' || event.kind === 'pause-end' ? 'after' : 'before';
};

/**
 * The instants a person was demonstrably at this machine, and which way each one answers.
 *
 * Four things can say a person was there, and nothing else can: a window they brought to the front, an
 * idle transition the notifier saw, a prompt they gave an agent, and a call they held. A turn, a
 * session, a commit and an editor heartbeat all say the machine worked, which is a different question —
 * an agent on a schedule produces every one of them with nobody in the room.
 *
 * An idle transition is the one kind that also says where the person was *not*, so it answers one way
 * only: `idle-start`, `lock` and `pause-start` are the person leaving and answer for the time before
 * them; `idle-end`, `unlock` and `pause-end` are the person returning and answer for the time after.
 * Everything else answers both ways.
 */
export const attendedAt = (events: readonly CollectedEvent[]): Presence[] =>
  events
    .filter((event) => {
      if (event.source === 'window' || event.source === 'idle') return true;

      return event.kind === 'agent-prompt' && event.askedBy !== 'machine';
    })
    .map((event) => ({ at: event.at, side: sideOf(event) }))
    .sort((a, b) => a.at.getTime() - b.at.getTime());

/**
 * Marks each group with whether anybody was there for it.
 *
 * One instant of attendance answers for a whole band, and reaches `graceMs` past itself to either side
 * it answers for. A person works a stretch of a day rather than a band of it: they step away for ten
 * minutes while an agent runs, and the fifteen minutes that leaves behind is still a slice of a day
 * they were present for. `false` is reserved for what it is for — a chunk that ran with nobody in the
 * room at all, such as a scheduled agent session at five on a Sunday morning, where no instant of a
 * person comes within `graceMs` of either end.
 *
 * The test is deliberately lenient in that direction — a row wrongly called unattended costs the user a
 * manual entry, and a row wrongly called attended is what puts hours nobody worked into Tempo. The
 * grace is what keeps both true at once: it is short enough that a night's run reaches no one.
 *
 * A band the user claimed themselves is attended whatever the events say. A timer they started and a
 * call they held are both acts of a person, and neither leaves a window event behind.
 */
export const markAttendance = (options: {
  groups: readonly WorkGroup[];
  at: readonly Presence[];
  /** How far past itself an instant answers. Pass the day's `gapFillMs`, which is the same question. */
  graceMs: number;
  /** The stretches the user claimed by hand: the runs they timed and the calls a rule counted as work. */
  claimed?: readonly TimeWindow[];
}): WorkGroup[] => {
  const grace = Math.max(0, options.graceMs);
  const reach = options.at.map((presence) => {
    const at = presence.at.getTime();

    return { from: presence.side === 'after' ? at : at - grace, to: presence.side === 'before' ? at : at + grace };
  });
  const spans = [
    ...reach,
    ...(options.claimed ?? []).map((window) => ({ from: window.from.getTime(), to: window.to.getTime() })),
  ];

  return options.groups.map((group) => {
    const from = group.from.getTime();
    const to = group.to.getTime();

    return { ...group, attended: spans.some((span) => span.from < to && span.to > from) };
  });
};
