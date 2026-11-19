import { CollectedEvent } from '../model/event';
import { ReceivedEvent } from '../model/received-event';
import { ActivityBlock, blockDurationMs, streamKey } from '../model/block';
import { Confidence } from '../model/evidence';
import { TimeWindow, clipWindows, mergeWindows, subtractWindows } from '../model/time-window';
import { DEFAULT_MERGE_OPTIONS, WorkGroup } from './merge';
import { clipBlocks } from './overlap';

const LEAVING: ReadonlySet<string> = new Set(['idle-start', 'lock']);
const RETURNING: ReadonlySet<string> = new Set(['idle-end', 'unlock']);

/** An away stretch the day never closed runs to the end of time: nothing ever said the person came back. */
const NEVER_CAME_BACK = new Date(8.64e15);

const ECHO_MS = 5_000;

const DESK_INPUT: ReadonlySet<string> = new Set(['window-focus', 'input-active']);

/**
 * The stretches the notifier said nobody was watching, from the transitions that open and close them.
 *
 * A stretch no `idle-end` or `unlock` closes ends at the next window focus or `input-active` instead: a
 * restarted app never sends the resume. A second `idle-start` or `lock` while it is open says the same,
 * so the `idle-end` after that closes only the second stretch. An agent prompt cannot end it, since a
 * prompt from the phone lies inside an away stretch.
 */
const awayStretches = (events: readonly CollectedEvent[]): TimeWindow[] => {
  const transitions = events
    .filter((event) => event.source === 'idle' && (LEAVING.has(event.kind) || RETURNING.has(event.kind)))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  const deskInput = events
    .filter((event) => DESK_INPUT.has(event.kind))
    .map((event) => event.at)
    .sort((a, b) => a.getTime() - b.getTime());
  const backAfter = (left: Date) => deskInput.find((at) => at.getTime() > left.getTime() + ECHO_MS);
  const away: TimeWindow[] = [];

  let left: Date | undefined;

  for (const event of transitions) {
    if (LEAVING.has(event.kind)) {
      const back = left && backAfter(left);

      if (left && back && back < event.at) {
        away.push({ from: left, to: back });
        left = event.at;
      }

      left ??= event.at;
      continue;
    }

    if (left) away.push({ from: left, to: event.at });
    left = undefined;
  }

  if (left) away.push({ from: left, to: backAfter(left) ?? NEVER_CAME_BACK });

  return away;
};

/**
 * The stretches a person was demonstrably at this machine, each instant widened by `graceMs`.
 *
 * Three events say a person was there: a window they brought to the front, an idle transition the
 * notifier saw, and a prompt they gave an agent. A call they held counts too, but reaches the day
 * through `markAttendance({ claimed })` rather than through this. A turn, a session, a commit and an
 * editor heartbeat only say the machine worked.
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
 *
 * `elsewhere` is where a person was at another machine of the user's, from {@link peerAttendance}. An
 * away stretch holds only where every machine was away, so the part of it a person spent at another
 * machine is no wall.
 */
export const attendedAt = (options: {
  events: readonly CollectedEvent[];
  graceMs: number;
  elsewhere?: readonly TimeWindow[];
}): TimeWindow[] => {
  const grace = Math.max(0, options.graceMs);
  const stretches = awayStretches(options.events);
  const away = (
    options.elsewhere?.length ? subtractWindows({ windows: stretches, without: options.elsewhere }) : stretches
  ).map((stretch) => ({
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

export type PeerAttendance = { machineId: string; machineName: string; at: TimeWindow[] };

/**
 * The stretches a person was at each paired machine, read from the events it collected by the same
 * test as {@link attendedAt}. A machine no person was seen at is left out.
 */
export const peerAttendance = (options: { received: readonly ReceivedEvent[]; graceMs: number }): PeerAttendance[] => {
  const byMachine = new Map<string, { machineName: string; events: CollectedEvent[] }>();

  for (const { machineId, machineName, event } of options.received) {
    const held = byMachine.get(machineId) ?? { machineName, events: [] };

    held.events.push(event);
    byMachine.set(machineId, held);
  }

  return [...byMachine]
    .map(([machineId, held]) => ({
      machineId,
      machineName: held.machineName,
      at: attendedAt({ events: held.events, graceMs: options.graceMs }),
    }))
    .filter((peer) => peer.at.length);
};

/** Per `streamKey`, the stretches a person was at a paired machine while that machine worked in the lane. */
export const attendedLanes = (options: {
  peers: readonly PeerAttendance[];
  peerLanes: Readonly<Record<string, Readonly<Record<string, readonly TimeWindow[]>>>>;
}): Record<string, TimeWindow[]> => {
  const lanes: Record<string, TimeWindow[]> = {};

  for (const peer of options.peers) {
    for (const [lane, windows] of Object.entries(options.peerLanes[peer.machineId] ?? {})) {
      (lanes[lane] ??= []).push(...clipWindows({ windows, within: peer.at }));
    }
  }

  return Object.fromEntries(Object.entries(lanes).map(([lane, windows]) => [lane, mergeWindows(windows)]));
};

const ALL_TIME = { from: new Date(-8.64e15), to: new Date(8.64e15) };

const blocksMs = (blocks: readonly ActivityBlock[]) => blocks.reduce((sum, block) => sum + blockDurationMs(block), 0);

/** The part of `group` inside `part`, with the share of its observed time that part's blocks hold. */
const partOf = (options: { group: WorkGroup; part: TimeWindow; first: boolean; last: boolean }): WorkGroup | [] => {
  const { group, part, ...edges } = options;
  const blocks = clipBlocks({
    blocks: group.blocks,
    windows: subtractWindows({ windows: [ALL_TIME], without: [part] }),
  });

  if (!blocks.length) return [];

  const share = Math.min(1, blocksMs(blocks) / Math.max(1, blocksMs(group.blocks)));
  const tiers = group.observedByConfidence;
  const extent = mergeWindows(blocks);
  const evidenceFrom = edges.first ? -Infinity : part.from.getTime();
  const evidenceTo = edges.last ? Infinity : part.to.getTime();

  return {
    ...group,
    from: edges.first ? group.from : (extent[0]?.from ?? part.from),
    to: edges.last ? group.to : (extent[extent.length - 1]?.to ?? part.to),
    blocks,
    ...(edges.first ? {} : { cutPart: true as const }),
    evidence: group.evidence.filter((entry) => entry.at.getTime() >= evidenceFrom && entry.at.getTime() < evidenceTo),
    observedMs: Math.round(group.observedMs * share),
    ...(tiers
      ? {
          observedByConfidence: Object.fromEntries(
            Object.entries(tiers).map(([tier, ms]) => [tier, Math.round((ms ?? 0) * share)]),
          ) as Partial<Record<Confidence, number>>,
        }
      : {}),
  };
};

/**
 * `group` cut at the gaps in `spans` no shorter than `maxGapMs`, each part with whether a span holds
 * it. A group with no blocks of its own, like a call or a timer run, is never cut, and neither is a
 * stretch in `away`: ADR 0028 and ADR 0037 decide what of a break is booked. Nor is a stretch in
 * `elsewhere`, where a paired machine saw the user: a minute any machine attended is attended (ADR 0018).
 */
const cutAtAttendance = (options: {
  group: WorkGroup;
  spans: readonly TimeWindow[];
  cut: {
    away: readonly TimeWindow[];
    elsewhere: readonly TimeWindow[];
    absences: readonly TimeWindow[];
    maxGapMs: number;
  };
}): { group: WorkGroup; attended: boolean }[] => {
  const { group, spans, cut } = options;
  const held = clipWindows({ windows: spans, within: [group] });

  if (!held.length) return [{ group, attended: false }];

  const gaps = subtractWindows({ windows: [group], without: [...held, ...cut.away, ...cut.elsewhere] }).filter(
    (gap) =>
      gap.to.getTime() - gap.from.getTime() > cut.maxGapMs ||
      cut.absences.some((absence) => absence.from <= gap.from && gap.to <= absence.to),
  );

  if (!gaps.length || !group.blocks.length) return [{ group, attended: true }];

  const parts = [
    ...subtractWindows({ windows: [group], without: gaps }).map((part) => ({ part, attended: true })),
    ...gaps.map((part) => ({ part, attended: false })),
  ].sort((a, b) => a.part.from.getTime() - b.part.from.getTime());

  return parts.flatMap(({ part, attended }, index) => {
    const cut = partOf({ group, part, first: index === 0, last: index === parts.length - 1 });

    return Array.isArray(cut) ? [] : [{ group: cut, attended }];
  });
};

/**
 * Marks each group with whether anybody was there for it, cutting a band at the gaps attendance leaves
 * in it: the part of a band that attendance reaches is attended, and the rest is a band of its own that
 * nobody attended, such as an agent's night after the person who started it left. A gap shorter than
 * `maxGapMs` stays with the attended part, so a band is never cut into slivers at its edges.
 *
 * The test is deliberately lenient in that direction — a row wrongly called unattended costs the user a
 * manual entry, and a row wrongly called attended is what puts hours nobody worked into Tempo. The
 * grace inside {@link attendedAt} is what keeps both true at once: it is short enough that a night's run
 * reaches no one, and it stops dead at an away stretch.
 *
 * A band the user claimed themselves is attended whatever the events say. A timer they started and a
 * call they held are both acts of a person, and neither leaves a window event behind.
 *
 * A band holding a paired machine's own block, while a person was at that machine, is attended. A band
 * nobody attended here that a person was at a paired machine for, but whose work that machine did not
 * do, stays unattended and carries that machine's name as `workedOn`.
 */
export const markAttendance = (options: {
  groups: readonly WorkGroup[];
  at: readonly TimeWindow[];
  /** The stretches the user claimed by hand: the runs they timed and the calls a rule counted as work. */
  claimed?: readonly TimeWindow[];
  peers?: readonly PeerAttendance[];
  /** From `attendedLanes`: a block of a lane in one of these stretches makes its band attended. */
  lanes?: Readonly<Record<string, readonly TimeWindow[]>>;
  /**
   * The breaks and whole absences of the day. `propose` cuts a break out of the rows, and the prompts
   * inside an absence buy the rest of it back, so neither cuts a band here.
   */
  away?: readonly TimeWindow[];
  /**
   * The absences too long to be a break. Attendance does not reach into one, and a part of a band in one
   * that nobody attended is cut off however short it is, so an agent's night stays unattended to its edges.
   */
  absences?: readonly TimeWindow[];
  maxGapMs?: number;
}): WorkGroup[] => {
  const absences = options.absences ?? [];
  const spans = mergeWindows([
    ...subtractWindows({ windows: options.at, without: absences }),
    ...(options.claimed ?? []),
  ]);
  const cut = {
    absences,
    away: options.away ?? [],
    elsewhere: (options.peers ?? []).flatMap((peer) => peer.at),
    maxGapMs: options.maxGapMs ?? DEFAULT_MERGE_OPTIONS.maxMergeGapMs,
  };

  return options.groups.flatMap((whole) =>
    cutAtAttendance({ group: whole, spans, cut }).map(({ group, attended }) => {
      if (attended) return { ...group, attended: true };

      const from = group.from.getTime();
      const to = group.to.getTime();

      const touches = (window: TimeWindow) => window.from.getTime() < to && window.to.getTime() > from;

      const elsewhere = group.blocks.some((block) =>
        options.lanes?.[streamKey(block.context)]?.some((window) => window.from < block.to && window.to > block.from),
      );

      if (elsewhere) return { ...group, attended: true };

      const peer = options.peers?.find((candidate) => candidate.at.some(touches));

      return { ...group, attended: false, ...(peer ? { workedOn: peer.machineName } : {}) };
    }),
  );
};
