import type { Progress } from '../types';

export const count = (text: string, re: RegExp) => (text.match(re) ?? []).length;
export const summary = (text: string, word: string) => {
  const hit = text.match(new RegExp(`^\\s+(\\d+) ${word}\\b`, 'm'));
  return hit ? Number(hit[1]) : undefined;
};

export const doneOf = (p: Progress) => p.passed + p.failed + p.skipped;

const FAIL_LISTED = /(?:✘|^\s+x)\s+\d+\s+\[/;
export const FAIL_LINE = /(?:✘|^\s+x)\s+\d+\s+\[[^\]]+\]\s+›\s+(\S+?):(\d+):\d+\s+›\s+(.*)$/;

export const parse = (
  path: string,
  text: string,
  expected: Set<string>,
  mtimeMs: number,
  nowMs: number,
  last: Progress | null,
): Progress => {
  const isDone = /^\s+\d+ (passed|failed|did not run)\b/m.test(text) || /^EXIT \d+/m.test(text);
  const lines = text.split('\n');
  const listFailures = lines
    .filter((line) => FAIL_LISTED.test(line) && !expected.has(line))
    .map((line) => line.replace(/^(?:.*?✘|\s+x)\s+\d+\s+\[[^\]]+\]\s+›\s+/, '').replace(/\s+@\S+.*$/, ''));
  const lineFailures = new Map<string, string>();
  for (const line of lines) {
    const hit = line.match(/^\s+(\d+)\) \[[^\]]+\] › (.*)$/);
    if (hit?.[1] && hit[2]) lineFailures.set(hit[1], hit[2].replace(/\s+@\S+.*$/, '').replace(/\s*─+\s*$/, ''));
  }
  const failures = isDone && lineFailures.size > 0 ? [...lineFailures.values()] : listFailures;
  const started = Math.max(0, ...[...text.matchAll(/^\[(\d+)\/\d+\]/gm)].map((m) => Number(m[1])));
  const ticks = count(text, /✓/g) + count(text, /^\s+ok\s+\d+\s+\[/gm);
  const p = {
    path,
    total: Number(text.match(/Running (\d+) tests?/)?.[1] ?? 0),
    passed: summary(text, 'passed') ?? (ticks > 0 ? ticks + expected.size : Math.max(0, started - failures.length)),
    failed: summary(text, 'failed') ?? failures.length,
    skipped: summary(text, 'skipped') ?? (ticks > 0 ? count(text, /^\s+-\s+\d+\s/gm) : 0),
    flaky: summary(text, 'flaky') ?? 0,
    didNotRun: summary(text, 'did not run') ?? 0,
    workers: Number(text.match(/Running \d+ tests? using (\d+) workers?/)?.[1] ?? 1),
    duration: text.match(/^\s+\d+ passed \(([^)]+)\)/m)?.[1],
    expected: expected.size,
    isDone,
    failures,
    mtimeMs,
    firstSeenMs: nowMs,
    firstDone: 0,
  };
  const isSameRun =
    last !== null &&
    last.path === path &&
    !last.isDone &&
    Number.isFinite(last.firstSeenMs) &&
    Number.isFinite(last.firstDone) &&
    doneOf(p) >= last.firstDone;
  return isSameRun
    ? { ...p, firstSeenMs: last.firstSeenMs, firstDone: last.firstDone }
    : { ...p, firstDone: doneOf(p) };
};
