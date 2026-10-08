import { CollectedEvent, EventOrigin, OriginEvent } from '../model/event';
import { CheckoutKeys, translatePeerPath } from '../model/peer-path';
import { ReceivedEvent, ReceivedRange } from '../model/received-event';
import { dedupeKeyOf } from '../store/dedupe';
import { TimetrackExclusionRule, exclusionFilter } from '../store/exclusion';

const translateEvent = (event: CollectedEvent, translate: (path: string) => string): CollectedEvent => {
  switch (event.kind) {
    case 'git-commit':
      return {
        ...event,
        repoPath: translate(event.repoPath),
        ...(event.worktree === undefined ? {} : { worktree: translate(event.worktree) }),
      };
    case 'git-checkout':
    case 'git-branch-update':
      return { ...event, repoPath: translate(event.repoPath) };
    case 'agent-session':
    case 'agent-usage':
    case 'agent-prompt':
      return {
        ...event,
        cwd: translate(event.cwd),
        ...(event.workedIn === undefined ? {} : { workedIn: translate(event.workedIn) }),
      };
    case 'editor-heartbeat':
      if (event.repoPath !== undefined) return { ...event, repoPath: translate(event.repoPath) };

      return event.directory === undefined ? event : { ...event, directory: translate(event.directory) };
    default:
      return event;
  }
};

const sharedFactOf = (event: CollectedEvent) => {
  switch (event.kind) {
    case 'calendar-event':
    case 'merge-request-activity':
    case 'agent-session':
    case 'agent-usage':
    case 'agent-prompt':
      return dedupeKeyOf(event);
    case 'git-commit':
      return event.authoredAt ? null : `git-commit:${event.sha}`;
    default:
      return null;
  }
};

const originIdOf = (origin: EventOrigin) => (origin === 'local' ? 'local' : `peer:${origin.machineId}`);

/**
 * This machine's events and the ones it received for a day as one list, each tagged with the
 * machine that collected it. A peer's paths are mapped onto the local checkout of the same
 * repository. A fact several machines hold counts once, this machine's copy first; a commit a
 * machine pulled rather than wrote stays on that machine as presence at the pull.
 *
 * `rules` are this machine's exclusion rules, from `effectiveExclusionRules`. They apply to the
 * received events whatever the sending machine's rules were.
 */
export const mergeDayEvents = (options: {
  local: readonly CollectedEvent[];
  received: ReceivedRange;
  keys: CheckoutKeys;
  rules: readonly TimetrackExclusionRule[];
}): OriginEvent[] => {
  const { local, received, keys } = options;
  const allowedBy = exclusionFilter(options.rules);
  const allowed = received.events.flatMap((entry) => {
    const event = allowedBy(entry.event);

    return event ? [{ ...entry, event }] : [];
  });
  const tagged: OriginEvent[] = [
    ...local.map((event) => ({ ...event, origin: 'local' as const })),
    ...allowed.map(({ machineId, machineName, event }) => {
      const peerKeys = received.repoKeys[machineId] ?? {};
      const translated = translateEvent(event, (path) => translatePeerPath({ path, peerKeys, localKeys: keys }));

      return { ...translated, origin: { machineId, machineName } };
    }),
  ];
  const keptBy = new Map<string, string>();
  const merged = tagged.filter((event) => {
    const fact = sharedFactOf(event);

    if (fact === null) return true;

    const origin = originIdOf(event.origin);
    const kept = keptBy.get(fact);

    if (kept === undefined) keptBy.set(fact, origin);

    return kept === undefined || kept === origin;
  });

  return merged.sort((left, right) => left.at.getTime() - right.at.getTime());
};

/** The events of a merged day that a paired machine collected, as it sent them. */
export const receivedEventsOf = (events: readonly (CollectedEvent | OriginEvent)[]): ReceivedEvent[] =>
  events.flatMap((event) => {
    if (!('origin' in event) || event.origin === 'local') return [];

    const { origin, ...collected } = event;

    return [{ machineId: origin.machineId, machineName: origin.machineName, event: collected as CollectedEvent }];
  });
