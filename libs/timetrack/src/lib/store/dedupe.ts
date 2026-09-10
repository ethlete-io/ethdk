import { CollectedEvent } from '../model/event';

/** A separator none of the parts can contain, so two different events cannot key to the same string. */
const PART_SEPARATOR = '\u001f';

const keyOf = (parts: string[]) => parts.join(PART_SEPARATOR);

/**
 * The identity a re-collected event is recognised by, or `null` for an event only its collector can
 * have observed.
 *
 * A git scan reads a window of history rather than a stream, so overlapping runs — the periodic
 * reconcile, a run the watcher triggered, the wide scan after the app was closed — see the same
 * commits and switches again. The store drops a repeat by this key, which is what lets a scan window
 * be as wide as it needs to be.
 *
 * A commit keys by its sha alone, so the branch the first scan reported for it is the one that stays.
 * `%S` names whichever ref reached the commit first, and a commit that later also lives on another
 * branch must not turn into a second observation of the same work.
 *
 * A calendar occurrence keys by its times as well as its id, so a meeting somebody moved is stored
 * again at the hour it moved to rather than keeping the one it was first read at.
 *
 * A GitLab event keys by GitLab's own id, which is unique inside one instance — a second instance
 * would have to put its host in the key. A GitHub event keys by its source and its id.
 *
 * A sample the host buffered — a focus change, a presence transition, a microphone edge — keys by the
 * instant it was taken at and the state it reports. The host holds such a sample until the collector
 * acknowledges it, so a webview that reloads between reading and storing drains it a second time, and
 * the key is what makes that repeat free. Two samples of the same window a minute apart are two real
 * observations and both still store, because their instants differ.
 *
 * An editor heartbeat keys by its reporter and its instant, which is what makes a reporter's retry
 * free: a POST whose response was lost is sent again, and one editor cannot have been in two states
 * at the same millisecond.
 *
 * An agent's token spend keys by the provider and the provider's own id for the turn. That is what lets
 * a session log be read again from the top — which `resyncAgentSessionCursors` does whenever the user
 * links a checkout — without the day's spend doubling. A typed prompt keys the same way, on the id of
 * the record that holds it, so the pass that rebuilds a day from the top is free to re-read too.
 */
export const dedupeKeyOf = (event: CollectedEvent): string | null => {
  switch (event.kind) {
    case 'git-commit':
      return keyOf([event.kind, event.repoPath, event.sha]);
    case 'git-checkout':
      return keyOf([event.kind, event.repoPath, event.at.toISOString(), event.branch]);
    case 'calendar-event':
      return keyOf([event.kind, event.occurrenceId, event.at.toISOString(), event.until.toISOString()]);
    case 'merge-request-activity':
      // GitLab's key predates GitHub and is already stored in a unique index, so it has to stay
      // spelled exactly as it was: adding the source to it now would re-append every event the store
      // already holds. GitHub's carries the source, because two forges can issue the same id.
      return keyOf(event.source === 'gitlab' ? [event.kind, event.eventId] : [event.kind, event.source, event.eventId]);
    case 'window-focus':
      return keyOf([event.kind, event.at.toISOString(), event.appId, event.title]);
    case 'call-start':
    case 'call-end':
      return keyOf([event.kind, event.at.toISOString(), event.appId]);
    case 'idle-start':
    case 'idle-end':
    case 'lock':
    case 'unlock':
    case 'pause-start':
    case 'pause-end':
      return keyOf([event.kind, event.at.toISOString()]);
    case 'editor-heartbeat':
      return keyOf([event.kind, event.reporter, event.at.toISOString()]);
    case 'agent-usage':
      return keyOf([event.kind, event.provider, event.turnId]);
    case 'agent-prompt':
      return keyOf([event.kind, event.provider, event.promptId]);
    default:
      return null;
  }
};
