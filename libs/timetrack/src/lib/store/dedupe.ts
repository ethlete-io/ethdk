import { CollectedEvent } from '../model/event';

/** A separator none of the parts can contain, so two different events cannot key to the same string. */
const PART_SEPARATOR = '\u001f';

const keyOf = (parts: string[]) => parts.join(PART_SEPARATOR);

/**
 * The identity a re-collected event is recognised by, so the store drops a repeat. Every kind has
 * one, so a new kind has to declare what makes two of its observations the same one.
 *
 * No key holds a title: `repairStoredTitles$` rewrites a stored title to apply a later redaction
 * rule, and a key built from a title would keep the raw one in the database.
 *
 * A GitLab event keys by GitLab's own id, which is unique inside one instance only; a second
 * instance would have to put its host in the key.
 */
export const dedupeKeyOf = (event: CollectedEvent) => {
  switch (event.kind) {
    case 'git-commit':
      return keyOf([event.kind, event.repoPath, event.sha]);
    case 'merge-request-changes':
      return keyOf([event.kind, event.repoPath, event.eventId, event.head]);
    case 'git-branch-update':
      return keyOf([event.kind, event.repoPath, event.at.toISOString(), event.branch]);
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
      return keyOf([event.kind, event.at.toISOString(), event.appId]);
    case 'call-start':
    case 'call-end':
      return keyOf([event.kind, event.at.toISOString(), event.appId]);
    case 'idle-start':
    case 'idle-end':
    case 'lock':
    case 'unlock':
    case 'pause-start':
    case 'pause-end':
    case 'input-idle':
    case 'input-active':
    case 'private-interval':
      return keyOf([event.kind, event.at.toISOString()]);
    case 'editor-heartbeat':
      return keyOf([event.kind, event.reporter, event.at.toISOString()]);
    case 'agent-usage':
      return keyOf([event.kind, event.provider, event.turnId]);
    case 'agent-prompt':
      return keyOf([event.kind, event.provider, event.promptId]);
    case 'agent-session':
      return keyOf([event.kind, event.sessionId, event.at.toISOString()]);
  }
};
