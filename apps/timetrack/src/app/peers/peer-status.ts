import { formatDurationMs } from '@ethlete/timetrack';
import { PairTarget, PairedMachine } from '../../host';

export const CONNECTED_WITHIN_MS = 3 * 60_000;

const WARN_OFFSET_MS = 2 * 60_000;
const REFUSE_OFFSET_MS = 10 * 60_000;

export type ClockOffsetSeverity = 'ok' | 'warning' | 'error';

export const clockOffsetSeverity = (offsetMs: number): ClockOffsetSeverity => {
  const off = Math.abs(offsetMs);

  if (off < WARN_OFFSET_MS) return 'ok';
  if (off <= REFUSE_OFFSET_MS) return 'warning';

  return 'error';
};

export const connectedMachines = (paired: readonly PairedMachine[], nowMs: number) =>
  paired.filter((machine) => machine.lastSeenMs !== null && nowMs - machine.lastSeenMs <= CONNECTED_WITHIN_MS);

const spanOf = (ms: number) => (ms < 60_000 ? `${Math.round(ms / 1000)}s` : formatDurationMs(ms));

export const formatLastSeen = (lastSeenMs: number | null, nowMs: number) => {
  if (lastSeenMs === null) return 'not seen yet';

  const ago = Math.max(0, nowMs - lastSeenMs);

  return ago < 60_000 ? 'just now' : `${formatDurationMs(ago)} ago`;
};

export const describeClockOffset = (machine: Pick<PairedMachine, 'label' | 'clockOffsetMs'>) => {
  const offsetMs = machine.clockOffsetMs;

  if (offsetMs === null) return null;

  const span = spanOf(Math.abs(offsetMs));
  const direction = offsetMs >= 0 ? 'ahead' : 'behind';
  const severity = clockOffsetSeverity(offsetMs);

  if (severity === 'ok') return { severity, text: `Clock ${span} ${direction}` };

  if (severity === 'warning') {
    return { severity, text: `Clock ${span} ${direction}: its times will be corrected` };
  }

  return {
    severity,
    text: `${machine.label}'s clock is ${span} ${direction}: its events will be refused until the clocks agree`,
  };
};

export const parseAddress = (typed: string): Extract<PairTarget, { kind: 'address' }> | null => {
  const text = typed.trim();
  const bracketed = /^\[([^\]]+)\](?::(\d+))?$/.exec(text);
  const plain = /^([^:\s]+)(?::(\d+))?$/.exec(text);
  const match = bracketed ?? plain;

  if (!match?.[1]) return null;

  const port = match[2] === undefined ? null : Number(match[2]);

  if (port !== null && (port < 1 || port > 65_535)) return null;

  return { kind: 'address', host: match[1], port };
};
