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
 * A typed prompt is one of them: a person pressed the keys, at the instant the log records. A turn is
 * not, and neither is a session — those are the machine working, whoever started it.
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

  const close = (at: Date) => {
    if (!current) return;
    if (at > current.to) current.to = at;
    windows.push(current);
    current = null;
    mark = null;
  };

  /** The silence two marks tolerate: the shorter of what each of them allows. */
  const gapMs = (sample: PresenceSample) => Math.min(mark?.gapMs ?? Infinity, isAgents(sample) ? agentGapMs : Infinity);

  for (const [index, sample] of options.samples.entries()) {
    if (sample.source === 'idle') {
      if (endsPresence(sample.kind)) {
        away = true;
        // A stretch a later `idle-end` or `unlock` closes needs no help from the fallback below, and
        // must refuse it: the window source emits a focus event for a title change too, so an agent
        // working in the window the user left focused would otherwise read as the user returning.
        awaited = index < resumeIndex;
        close(sample.at);
      }

      if (resumesPresence(sample.kind)) away = false;

      continue;
    }

    if (sample.source === 'agent-usage') {
      const allowed = Math.min(gapMs(sample), options.maxUnobservedMs);

      if (!away && current && mark && sample.at.getTime() - mark.at.getTime() < allowed) {
        mark = { at: sample.at, gapMs: agentGapMs };
      }

      continue;
    }

    // Input the idle notifier may have missed the resume of. A focus change and a typed prompt each
    // need somebody at the keyboard, so either ends being away on its own.
    if (!awaited && isPresent(sample)) away = false;

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
