import { ActivityEvent, PresenceEvent } from '../model/event';
import { TimeWindow } from '../model/time-window';

/** Whether a sample is the user at the machine, rather than something the machine did on its own. */
const isPresent = (sample: ActivityEvent) => sample.kind === 'window-focus';

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
const opensAway = (samples: readonly ActivityEvent[]) => {
  const first = samples.find((sample) => sample.source === 'idle');

  return first?.source === 'idle' && resumesPresence(first.kind);
};

/**
 * The stretches of wall-clock time the user was at the machine, in order and never overlapping.
 *
 * Nothing the machine does on its own counts while the user is away: from an `idle-start`, a `lock` or
 * a `pause-start` until the input that ends it, an agent session and a commit neither open a stretch
 * nor hold one open. A stretch also ends where the samples simply stop, at its last sample rather than
 * at the next one, because nothing observed the time in between.
 */
export const presenceWindows = (options: {
  samples: readonly ActivityEvent[];
  /** The safety valve for a stretch nothing observed at all. The collectors are edge-triggered, so it is generous. */
  maxUnobservedMs: number;
}): TimeWindow[] => {
  const windows: TimeWindow[] = [];
  let current: TimeWindow | null = null;
  let away = opensAway(options.samples);

  const close = (at: Date) => {
    if (!current) return;
    if (at > current.to) current.to = at;
    windows.push(current);
    current = null;
  };

  for (const sample of options.samples) {
    if (sample.source === 'idle') {
      if (endsPresence(sample.kind)) {
        away = true;
        close(sample.at);
      }

      if (resumesPresence(sample.kind)) away = false;

      continue;
    }

    // Input the idle notifier may have missed the resume of. A focus change needs somebody at the
    // keyboard, so it ends being away on its own.
    if (isPresent(sample)) away = false;

    if (away) continue;

    if (current && sample.at.getTime() - current.to.getTime() >= options.maxUnobservedMs) close(current.to);

    if (current) current.to = sample.at;
    else current = { from: sample.at, to: sample.at };
  }

  if (current) close(current.to);

  return windows;
};
