import { ActivityBlock } from '../model/block';
import { CollectedEvent, PresenceEvent } from '../model/event';
import { Confidence } from '../model/evidence';
import { WorklogProposal } from '../model/proposal';

/** What the machine is doing at this moment, as a tray readout has to state it in one line. */
export type CurrentActivity =
  | { state: 'unknown' }
  | { state: 'paused'; since: Date }
  | { state: 'idle'; since: Date }
  | { state: 'working'; since: Date; block: ActivityBlock };

const AWAY_KINDS: PresenceEvent['kind'][] = ['idle-start', 'lock'];

const newestBy = <T>(items: readonly T[], at: (item: T) => Date) =>
  items.reduce<T | null>((newest, item) => (!newest || at(item) >= at(newest) ? item : newest), null);

/**
 * Reads the day so far as a single present-tense statement.
 *
 * Leaving is the one thing a collector reports directly, so a presence event newer than the last
 * observation wins: naming the branch the user walked away from as current work would be a lie.
 * Silence is not — window and git collection are edge-triggered, so an hour of reading in one window
 * emits nothing at all, and the idle notifier is what distinguishes that from an empty chair.
 *
 * A pause beats both. Nothing has watched since it started, so the newest block is only the work that
 * was running when the user stopped collection, and reporting it as current would be the same lie.
 */
export const currentActivity = (options: {
  events: readonly CollectedEvent[];
  blocks: readonly ActivityBlock[];
}): CurrentActivity => {
  const presence = newestBy(
    options.events.filter((event): event is PresenceEvent => event.source === 'idle'),
    (event) => event.at,
  );
  const block = newestBy(options.blocks, (candidate) => candidate.to);

  if (presence?.kind === 'pause-start') return { state: 'paused', since: presence.at };

  if (presence && AWAY_KINDS.includes(presence.kind) && (!block || presence.at >= block.to)) {
    return { state: 'idle', since: presence.at };
  }

  return block ? { state: 'working', since: block.from, block } : { state: 'unknown' };
};

/** The issue the work happening now would be logged on, and how sure the day is of it. */
export type CurrentAttribution = { issueKey: string; confidence: Confidence };

/**
 * Which row the current work would land on, or `null` when nothing names one.
 *
 * A readout that states the issue without stating how sure of it the day is invites the reader to
 * trust a guess — and a keyless branch produces exactly such a guess. `null` is the answer for work
 * no rule could name, which is a different thing from a weak guess and has to read differently.
 *
 * The row is found by the block's last sample rather than its start: a merged row spans several
 * blocks, and the newest sample is the one the reader is watching happen.
 */
export const currentAttribution = (options: {
  activity: CurrentActivity;
  rows: readonly WorklogProposal[];
}): CurrentAttribution | null => {
  if (options.activity.state !== 'working') return null;

  const at = options.activity.block.to.getTime();
  const row = options.rows.find((candidate) => candidate.from.getTime() <= at && at <= candidate.to.getTime());

  return row ? { issueKey: row.issueKey, confidence: row.confidence } : null;
};
