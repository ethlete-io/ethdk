import { CollectedEvent } from '../model/event';
import { TimeWindow } from '../model/time-window';
import { WorkGroup } from './merge';

/**
 * The instants a person was demonstrably at this machine.
 *
 * Four things can say so, and nothing else can: a window they brought to the front, an idle
 * transition the notifier saw, a prompt they gave an agent, and a call they held. A turn, a session, a
 * commit and an editor heartbeat all say the machine worked, which is a different question — an agent
 * on a schedule produces every one of them with nobody in the room.
 */
export const attendedAt = (events: readonly CollectedEvent[]): Date[] =>
  events
    .filter((event) => {
      if (event.source === 'window' || event.source === 'idle') return true;

      return event.kind === 'agent-prompt' && event.askedBy !== 'machine';
    })
    .map((event) => event.at)
    .sort((a, b) => a.getTime() - b.getTime());

/**
 * Marks each group with whether anybody was there for it.
 *
 * One instant of attendance anywhere in a band answers for the whole band: a person who works for an
 * hour switches a window at some point in it, and a band that holds no such instant at all held
 * nobody. The test is deliberately that lenient — a row wrongly called unattended costs the user a
 * manual entry, and a row wrongly called attended is what puts hours nobody worked into Tempo.
 *
 * A band the user claimed themselves is attended whatever the events say. A timer they started and a
 * call they held are both acts of a person, and neither leaves a window event behind.
 */
export const markAttendance = (options: {
  groups: readonly WorkGroup[];
  at: readonly Date[];
  /** The stretches the user claimed by hand: the runs they timed and the calls a rule counted as work. */
  claimed?: readonly TimeWindow[];
}): WorkGroup[] => {
  const instants = options.at.map((at) => at.getTime());
  const claimed = options.claimed ?? [];

  return options.groups.map((group) => {
    const from = group.from.getTime();
    const to = group.to.getTime();
    const held =
      instants.some((at) => at >= from && at <= to) ||
      claimed.some((window) => window.from.getTime() < to && window.to.getTime() > from);

    return { ...group, attended: held };
  });
};
