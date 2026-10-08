import { PairedMachine } from '../../host';
import {
  CONNECTED_WITHIN_MS,
  clockOffsetSeverity,
  connectedMachines,
  describeClockOffset,
  formatLastSeen,
  parseAddress,
} from './peer-status';

const NOW = 1_000_000_000;

const machine = (label: string, lastSeenMs: number | null): PairedMachine => ({
  machineId: label,
  label,
  certFingerprint: 'fp',
  lastAddr: null,
  lastSeenMs,
  clockOffsetMs: null,
  pairedAtMs: 0,
  lastPullMs: null,
});

describe('clockOffsetSeverity', () => {
  it('merges under 2 minutes, corrects up to 10, refuses beyond', () => {
    expect(clockOffsetSeverity(0)).toBe('ok');
    expect(clockOffsetSeverity(119_999)).toBe('ok');
    expect(clockOffsetSeverity(-120_000)).toBe('warning');
    expect(clockOffsetSeverity(600_000)).toBe('warning');
    expect(clockOffsetSeverity(600_001)).toBe('error');
    expect(clockOffsetSeverity(-900_000)).toBe('error');
  });
});

describe('connectedMachines', () => {
  it('keeps the machines that said hello within three minutes', () => {
    const paired = [
      machine('fresh', NOW - 10_000),
      machine('edge', NOW - CONNECTED_WITHIN_MS),
      machine('stale', NOW - CONNECTED_WITHIN_MS - 1),
      machine('never', null),
    ];

    expect(connectedMachines(paired, NOW).map((held) => held.label)).toEqual(['fresh', 'edge']);
  });
});

describe('formatLastSeen', () => {
  it('reads relative to now', () => {
    expect(formatLastSeen(null, NOW)).toBe('not seen yet');
    expect(formatLastSeen(NOW - 20_000, NOW)).toBe('just now');
    expect(formatLastSeen(NOW - 5 * 60_000, NOW)).toBe('5m ago');
  });
});

describe('describeClockOffset', () => {
  it('names the machine only when its clock is refused', () => {
    expect(describeClockOffset({ label: 'mac', clockOffsetMs: null })).toBeNull();
    expect(describeClockOffset({ label: 'mac', clockOffsetMs: 3_000 })).toEqual({
      severity: 'ok',
      text: 'Clock 3s ahead',
    });
    expect(describeClockOffset({ label: 'mac', clockOffsetMs: -4 * 60_000 })?.severity).toBe('warning');
    expect(describeClockOffset({ label: 'mac', clockOffsetMs: 15 * 60_000 })?.text).toContain(
      "mac's clock is 15m ahead",
    );
  });
});

describe('parseAddress', () => {
  it('reads a host with or without a port', () => {
    expect(parseAddress(' 192.168.1.20:52741 ')).toEqual({ kind: 'address', host: '192.168.1.20', port: 52741 });
    expect(parseAddress('macbook.local')).toEqual({ kind: 'address', host: 'macbook.local', port: null });
    expect(parseAddress('[fe80::1]:4000')).toEqual({ kind: 'address', host: 'fe80::1', port: 4000 });
  });

  it('refuses what names no host or a port out of range', () => {
    expect(parseAddress('')).toBeNull();
    expect(parseAddress('host:0')).toBeNull();
    expect(parseAddress('host:70000')).toBeNull();
    expect(parseAddress('a b')).toBeNull();
  });
});
