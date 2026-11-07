import { existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawnPlain } from '../plain-output';

export type PushGateReceipt = {
  head: string;
  ok: boolean;
  at: string;
};

export type PushStatus = {
  base: string;
  unpushed: number;
  oldestAt: string | null;
  oldestAgeHours: number | null;
  gate: 'green' | 'red' | 'unknown';
  gateAt: string | null;
};

const flattened = (value: string) => value.replace(/[^A-Za-z0-9]/gu, '-');

/** Where `tools/scripts/design-rules-gate.mjs` leaves its result for one checkout. Both sides must agree. */
export const pushGateReceiptPath = (checkout: string) =>
  join(tmpdir(), 'ethlete-studio-checks', `${flattened(checkout)}.push-gate.json`);

const git = (cwd: string, args: string[]) => {
  const result = spawnPlain(['git', ...args], { cwd });

  return result.status === 0 ? result.stdout.trim() : null;
};

const upstreamOf = (cwd: string) => git(cwd, ['rev-parse', '--abbrev-ref', '@{u}']) ?? 'origin/next';

const receiptOf = (checkout: string): PushGateReceipt | null => {
  const path = pushGateReceiptPath(checkout);

  if (!existsSync(path)) return null;

  try {
    return JSON.parse(readFileSync(path, 'utf8')) as PushGateReceipt;
  } catch {
    return null;
  }
};

/** The commits of `checkout` the remote does not have yet, the age of the oldest, and the last push gate result for this head. */
export const pushStatusOf = (checkout: string, now = Date.now()): PushStatus | null => {
  const base = upstreamOf(checkout);
  const head = git(checkout, ['rev-parse', 'HEAD']);
  const stamps = git(checkout, ['log', '--format=%cI', `${base}..HEAD`]);

  if (head === null || stamps === null) return null;

  const dates = stamps.split('\n').filter(Boolean);
  const oldest = dates.map((date) => Date.parse(date)).sort((a, b) => a - b)[0];
  const receipt = receiptOf(checkout);
  const gate = receipt === null || receipt.head !== head ? 'unknown' : receipt.ok ? 'green' : 'red';

  return {
    base,
    unpushed: dates.length,
    oldestAt: oldest === undefined ? null : new Date(oldest).toISOString(),
    oldestAgeHours: oldest === undefined ? null : Math.round(((now - oldest) / 3_600_000) * 10) / 10,
    gate,
    gateAt: gate === 'unknown' ? null : (receipt?.at ?? null),
  };
};

export const pushStatusLines = (status: PushStatus) => [
  status.unpushed === 0
    ? `nothing unpushed (${status.base})`
    : `${status.unpushed} unpushed commit(s) on ${status.base}, oldest ${status.oldestAgeHours} h old`,
  `push gate: ${status.gate}${status.gate === 'red' ? ' - fix it before any feature slice' : ''}`,
];
