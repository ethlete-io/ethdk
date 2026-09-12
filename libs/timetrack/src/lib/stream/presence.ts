import { ActivityEvent, AgentPromptEvent, AgentUsageEvent, PresenceEvent } from '../model/event';
import { TimeWindow } from '../model/time-window';

/**
 * What presence is read from: the machine's own samples, plus the two agent events a day nothing
 * observed is rebuilt from. See ADR 0006.
 */
export type PresenceSample = ActivityEvent | AgentPromptEvent | AgentUsageEvent;

/**
 * Whether a sample is the user at the machine, rather than something the machine did on its own.
 *
 * A prompt a person gave is one of them: they pressed the keys, at the instant the log records. A turn
 * is not, and neither is a session — those are the machine working, whoever started it.
 *
 * Whether anybody asked for that prompt is `attended`'s question, and a sample that fails it never
 * reaches this one.
 */
const isPresent = (sample: PresenceSample) => sample.kind === 'window-focus' || sample.kind === 'agent-prompt';

/**
 * The index of the last sample that resumes presence, or -1 for a day that holds none.
 *
 * A stretch away before it is one the idle source closed itself, and only such a stretch may refuse
 * the fallback below.
 */
const lastResumeIndex = (samples: readonly PresenceSample[]) => {
  for (let index = samples.length - 1; index >= 0; index -= 1) {
    const sample = samples[index];

    if (sample && sample.source === 'idle' && resumesPresence(sample.kind)) return index;
  }

  return -1;
};

/** Whether the sample is an agent's, which is what the wider of the two gaps applies to. */
const isAgents = (sample: PresenceSample) => sample.kind === 'agent-prompt' || sample.kind === 'agent-usage';

/**
 * The session ids whose work nobody asked for, at each point of the day.
 *
 * A turn carries no `askedBy` of its own, so the session is what answers for it: a turn is the machine
 * working on whatever it was last asked for. A session that opens on a schedule and that the user then
 * types into is attended from that prompt onwards, which is why this is read as the day runs rather
 * than decided for the whole session in advance.
 */
type SessionAttendance = Map<string, 'human' | 'machine'>;

/**
 * Whether anybody is behind this sample. Only an agent's samples can answer `false`.
 *
 * This is the difference between a person who waits on an agent and an agent that runs alone, and
 * nothing else in the day can tell the two apart — the turns, the sessions and the commits are
 * identical either way.
 */
const attended = (sample: PresenceSample, asked: SessionAttendance) => {
  if (sample.kind === 'agent-prompt') return sample.askedBy !== 'machine';
  if (sample.kind === 'agent-usage') return asked.get(sample.sessionId) !== 'machine';

  return true;
};

const endsPresence = (kind: PresenceEvent['kind']) =>
  kind === 'idle-start' || kind === 'lock' || kind === 'pause-start';

const resumesPresence = (kind: PresenceEvent['kind']) =>
  kind === 'idle-end' || kind === 'unlock' || kind === 'pause-end';

/**
 * Whether the day opens with the user already away.
 *
 * A resume with nothing to resume from began before the day did, and idleness outlives a calendar day.
 * Without this an agent that ran through midnight arrives as a morning of work nobody was at.
 */
const opensAway = (samples: readonly PresenceSample[]) => {
  const first = samples.find((sample) => sample.source === 'idle');

  return first?.source === 'idle' && resumesPresence(first.kind);
};

export type PresenceOptions = {
  samples: readonly PresenceSample[];
  /** The safety valve for a stretch nothing observed at all. The collectors are edge-triggered, so it is generous. */
  maxUnobservedMs: number;
  /**
   * The silence that ends a stretch either side of an agent event. It is an idle rule rather than a
   * safety valve, so it is shorter: a person waiting on an agent is at the machine, and a person who
   * typed nothing and ran nothing for this long is not. Defaults to `maxUnobservedMs`.
   */
  maxAgentGapMs?: number;
};

/**
 * The stretches of wall-clock time the user was at the machine, in order and never overlapping.
 *
 * Nothing the machine does on its own counts while the user is away: from an `idle-start`, a `lock` or
 * a `pause-start` until the input that ends it, an agent session, a commit and a turn neither open a
 * stretch nor hold one open. A stretch also ends where the samples simply stop, at its last sample
 * rather than at the next one, because nothing observed the time in between.
 *
 * A turn is the one mark that holds a stretch open without extending it: it postpones the close, and
 * the stretch still ends at the last real sample. That is what carries a stretch across the minutes a
 * person spent reading what an agent wrote, and it can only ever happen between two of their own
 * actions. See ADR 0006.
 *
 * An `idle-start` a turn still runs through is the same wait, only longer than the idle notifier's
 * patience, so it postpones the close in the same way: the stretch stays open while the turns keep
 * arriving, and the resume that ends the idleness closes the whole wait as presence. If the agent
 * stops too, the stretch ends where the idleness began and the wait is an absence. A `lock` and a
 * `pause-start` say the user left, so neither may be held open this way.
 */
export const presenceWindows = (options: PresenceOptions): TimeWindow[] => {
  const agentGapMs = options.maxAgentGapMs ?? options.maxUnobservedMs;
  const windows: TimeWindow[] = [];
  let current: TimeWindow | null = null;
  let away = opensAway(options.samples);
  let mark: { at: Date; gapMs: number } | null = null;
  const resumeIndex = lastResumeIndex(options.samples);
  /** Whether the stretch away now running ends in a resume of its own, so nothing else may end it. */
  let awaited = away;
  /** The `idle-start` an agent is still working through, and where the stretch closes if it stops too. */
  let bridged: Date | null = null;
  /** When the agent last did anything *for the user*, which is what says whether one is still working. */
  let lastAgent: Date | null = null;
  const asked: SessionAttendance = new Map();

  const close = (at: Date) => {
    if (!current) return;
    if (at > current.to) current.to = at;
    windows.push(current);
    current = null;
    mark = null;
    bridged = null;
  };

  /** The silence two marks tolerate: the shorter of what each of them allows. */
  const gapMs = (sample: PresenceSample) => Math.min(mark?.gapMs ?? Infinity, isAgents(sample) ? agentGapMs : Infinity);

  for (const [index, sample] of options.samples.entries()) {
    // Before the sample is read: a prompt states who asked, and every turn after it in the same session
    // is that answer until the next prompt changes it.
    if (sample.kind === 'agent-prompt') asked.set(sample.sessionId, sample.askedBy ?? 'human');

    // The agent stopped as well, so the wait it held open was an absence after all. This has to run
    // before the branches below, or the resume that ends the idleness would close it as presence.
    const agentWorks = !!lastAgent && sample.at.getTime() - lastAgent.getTime() < agentGapMs;

    if (bridged && current && !agentWorks) close(current.to);

    // An agent nobody asked for says nothing about the day: it may not open a stretch, extend one,
    // hold one open across an idle-start, or end a stretch away. It is still the machine at work, and
    // `unattendedMs` is where that is reported.
    if (!attended(sample, asked)) continue;

    if (isAgents(sample)) lastAgent = sample.at;

    if (sample.source === 'idle') {
      if (endsPresence(sample.kind)) {
        away = true;
        // A stretch a later `idle-end` or `unlock` closes needs no help from the fallback below, and
        // must refuse it: the window source emits a focus event for a title change too, so an agent
        // working in the window the user left focused would otherwise read as the user returning.
        awaited = index < resumeIndex;

        if (sample.kind === 'idle-start' && current && mark && agentWorks) {
          if (sample.at > current.to) current.to = sample.at;
          bridged = sample.at;
        } else {
          close(bridged ?? sample.at);
        }
      }

      if (resumesPresence(sample.kind)) {
        if (bridged && current) {
          if (sample.at > current.to) current.to = sample.at;
          bridged = null;
        }

        away = false;
      }

      continue;
    }

    if (sample.source === 'agent-usage') {
      const allowed = Math.min(gapMs(sample), options.maxUnobservedMs);

      if ((!away || bridged) && current && mark && sample.at.getTime() - mark.at.getTime() < allowed) {
        mark = { at: sample.at, gapMs: agentGapMs };
      }

      continue;
    }

    // Input the idle notifier may have missed the resume of. A focus change and a typed prompt each
    // need somebody at the keyboard, so either ends being away on its own.
    if (!awaited && isPresent(sample)) {
      away = false;
      bridged = null;
    }

    if (away) continue;

    const allowed = Math.min(gapMs(sample), options.maxUnobservedMs);

    if (current && mark && sample.at.getTime() - mark.at.getTime() >= allowed) close(current.to);

    if (current) current.to = sample.at;
    else current = { from: sample.at, to: sample.at };

    mark = { at: sample.at, gapMs: isAgents(sample) ? agentGapMs : Infinity };
  }

  if (current) close(current.to);

  return windows;
};
