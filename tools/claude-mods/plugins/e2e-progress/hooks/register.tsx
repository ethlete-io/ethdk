import { atom, read, update } from 'claude-code';
import type { EngineInterface, Register, Timer } from 'claude-code';

import type { Progress } from '../types';

const PANE = 'e2e-progress';
const HANDOFFS = '.claude/handoffs';
const WORKTREES = '.claude/worktrees';
const TICK_MS = 5000;
const STALE_MS = 15_000;
const HIDE_AFTER_MS = 60_000;
const MIN_ETA_TESTS = 5;
const MIN_ETA_MS = 30_000;
const MAX_CANDIDATES = 12;
const STALLED_MS = 15 * 60_000;
const runs = atom({ plugin: 'e2e-progress', key: 'runs' } as const, []);
const pinnedPath = atom({ plugin: 'e2e-progress', key: 'path' } as const, null);

const count = (text: string, re: RegExp) => (text.match(re) ?? []).length;
const summary = (text: string, word: string) => {
  const hit = text.match(new RegExp(`^\\s+(\\d+) ${word}\\b`, 'm'));
  return hit ? Number(hit[1]) : undefined;
};

const doneOf = (p: Progress) => p.passed + p.failed + p.skipped;

const FAIL_LINE = /✘\s+\d+\s+\[[^\]]+\]\s+›\s+(\S+?):(\d+):\d+\s+›\s+(.*)$/;
const TEST_DECLARATION = /\btest(\.\w+)?\(/;
const indentOf = (line: string) => line.length - line.trimStart().length;

const titleOf = (rest: string) =>
  (
    rest
      .replace(/\s+@\S+.*$/, '')
      .replace(/\s+\([\d.]+m?s\)$/, '')
      .split(' › ')
      .pop() ?? ''
  ).trim();

const declaresAt = (source: string[], index: number, title: string) => {
  if (!TEST_DECLARATION.test(source[index] ?? '')) return false;
  const head = source.slice(index, index + 3).join('\n');
  return head.includes(title.slice(0, 25)) || head.includes('`');
};

const callsTestFail = (source: string[], index: number) => {
  const declaration = source[index] ?? '';
  if (/\btest\.fail\(/.test(declaration)) return true;
  const indent = indentOf(declaration);
  for (const line of source.slice(index + 1)) {
    if (line.trim() !== '' && indentOf(line) <= indent && !/=>\s*\{\s*$/.test(line)) return false;
    if (/\btest\.fail\(/.test(line)) return true;
  }
  return false;
};

const sourceCache = new Map<string, string[] | null>();

async function sourceOf($: EngineInterface, path: string) {
  if (!sourceCache.has(path))
    sourceCache.set(
      path,
      await $.fs.read(path).then(
        (t) => t.split('\n'),
        () => null,
      ),
    );
  return sourceCache.get(path) ?? null;
}

async function rootsFor($: EngineInterface, logPath: string) {
  const at = logPath.indexOf(HANDOFFS);
  const own = at > 0 ? logPath.slice(0, at) : '';
  const worktrees = await $.fs.list(WORKTREES).catch(() => []);
  const all = [own, '', ...worktrees.filter((d) => d.kind === 'dir').map((d) => `${WORKTREES}/${d.name}/`)];
  return [...new Set(all)];
}

async function expectedFailures($: EngineInterface, logPath: string, text: string) {
  const expected = new Set<string>();
  const failLines = text.split('\n').filter((line) => FAIL_LINE.test(line));
  if (failLines.length === 0) return expected;
  const roots = await rootsFor($, logPath);
  for (const line of failLines) {
    const [, file = '', lineNo = '0', rest = ''] = line.match(FAIL_LINE) ?? [];
    const index = Number(lineNo) - 1;
    const title = titleOf(rest);
    for (const root of roots) {
      const source = await sourceOf($, `${root}${file}`);
      if (source === null || !declaresAt(source, index, title)) continue;
      if (callsTestFail(source, index)) expected.add(line);
      break;
    }
  }
  return expected;
}

const parse = (
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
    .filter((line) => line.includes('✘') && !expected.has(line))
    .map((line) => line.replace(/^.*?✘\s+\d+\s+\[[^\]]+\]\s+›\s+/, '').replace(/\s+@\S+.*$/, ''));
  const lineFailures = new Map<string, string>();
  for (const line of lines) {
    const hit = line.match(/^\s+(\d+)\) \[[^\]]+\] › (.*)$/);
    if (hit?.[1] && hit[2]) lineFailures.set(hit[1], hit[2].replace(/\s+@\S+.*$/, '').replace(/\s*─+\s*$/, ''));
  }
  const failures = isDone && lineFailures.size > 0 ? [...lineFailures.values()] : listFailures;
  const started = Math.max(0, ...[...text.matchAll(/^\[(\d+)\/\d+\]/gm)].map((m) => Number(m[1])));
  const ticks = count(text, /✓/g);
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

const FAILURES_FILE_LINE = /^\[failure-reporter\] Writing failures to (.+)$/m;

type FailureRecord = { test: string; location: string; error?: string };

const recordsOf = (text: string): FailureRecord[] =>
  text.split('\n').flatMap((line) => {
    if (line.trim() === '') return [];
    try {
      const record = JSON.parse(line);
      return typeof record?.test === 'string' && typeof record?.location === 'string' ? [record] : [];
    } catch {
      return [];
    }
  });

const firstErrorLine = (error: string | undefined) =>
  (error ?? '')
    .split('\n')
    .find((line) => line.trim() !== '')
    ?.replace(/^Error:\s*/, '')
    .trim() ?? '';

const failuresOf = (records: FailureRecord[]) => {
  const latest = new Map<string, FailureRecord>();
  for (const record of records) latest.set(`${record.location} › ${record.test}`, record);
  return [...latest].map(([key, record]) => {
    const error = firstErrorLine(record.error);
    return error ? `${key} — ${error}` : key;
  });
};

async function withRecords($: EngineInterface, p: Progress, text: string): Promise<Progress> {
  const file = text.match(FAILURES_FILE_LINE)?.[1]?.trim();
  if (!file) return p;
  const records = await $.fs.read(file).then(recordsOf, () => undefined);
  if (records === undefined) return p;
  const failures = failuresOf(records);
  return { ...p, failures, failed: summary(text, 'failed') ?? failures.length };
}

const remainingMs = (p: Progress, nowMs: number) => {
  const doneSince = doneOf(p) - p.firstDone;
  const elapsed = nowMs - p.firstSeenMs;
  if (p.isDone || doneSince < MIN_ETA_TESTS || elapsed < MIN_ETA_MS) return undefined;
  return ((p.total - doneOf(p)) / doneSince) * elapsed;
};

const formatEta = (ms: number | undefined) => {
  if (ms === undefined) return '';
  const minutes = Math.round(ms / 60_000);
  return minutes < 1 ? ' ~<1m left' : ` ~${minutes}m left`;
};

type LogFile = { path: string; mtimeMs: number };

async function logsUnder($: EngineInterface, dir: string, depth: number): Promise<LogFile[]> {
  const entries = await $.fs.list(dir).catch(() => []);
  const files = entries
    .filter((f) => f.kind === 'file' && f.name.endsWith('.log'))
    .map((f) => ({ path: `${dir}/${f.name}`, mtimeMs: f.mtimeMs }));
  if (depth === 0) return files;
  const nested = await Promise.all(
    entries.filter((d) => d.kind === 'dir').map((d) => logsUnder($, `${dir}/${d.name}`, depth - 1)),
  );
  return [...files, ...nested.flat()];
}

async function baseDirs($: EngineInterface) {
  const bases = new Set([await $.session.root()]);
  let dir = await $.session.cwd();
  for (let up = 0; up <= 3 && dir !== ''; up++) {
    bases.add(dir);
    dir = dir.slice(0, dir.lastIndexOf('/'));
  }
  return [...bases];
}

async function handoffDirs($: EngineInterface) {
  const perBase = await Promise.all(
    (await baseDirs($)).map(async (base) => {
      const worktrees = await $.fs.list(`${base}/${WORKTREES}`).catch(() => []);
      return [
        `${base}/${HANDOFFS}`,
        ...worktrees.filter((d) => d.kind === 'dir').map((d) => `${base}/${WORKTREES}/${d.name}/${HANDOFFS}`),
      ];
    }),
  );
  return perBase.flat();
}

const nameOf = (path: string) => (path.split('/').pop() ?? path).replace(/\.log$/, '');

const isRunLog = (text: string) => /^Running \d+ tests?/m.test(text);

const notRunLogs = new Map<string, number>();

async function candidateLogs($: EngineInterface) {
  const perDir = await Promise.all((await handoffDirs($)).map((dir) => logsUnder($, dir, 2)));
  const unique = new Map(perDir.flat().map((log) => [log.path, log]));
  return [...unique.values()].sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, MAX_CANDIDATES);
}

async function newestLog($: EngineInterface) {
  for (const log of await candidateLogs($)) {
    if (isRunLog(await $.fs.read(log.path).catch(() => ''))) return log;
  }
  return undefined;
}

async function pinnedLog($: EngineInterface): Promise<LogFile | undefined> {
  const pinned = await read($, pinnedPath);
  if (pinned === null) return undefined;
  const stat = await $.fs.stat(pinned).catch(() => undefined);
  const newest = await newestLog($);
  if (newest !== undefined && newest.path !== pinned && (stat === undefined || newest.mtimeMs > stat.mtimeMs)) {
    await update($, pinnedPath, () => null);
    return undefined;
  }
  return stat === undefined ? undefined : { path: pinned, mtimeMs: stat.mtimeMs };
}

const isVisible = (p: Progress, nowMs: number) =>
  p.isDone ? nowMs - p.mtimeMs <= HIDE_AFTER_MS : nowMs - p.mtimeMs <= STALLED_MS;

let isHidden = false;
let timer: Timer | undefined;
let lastTickMs = 0;
let shownStatus: string | undefined | null = null;

function setStatus($: EngineInterface, text: string | undefined) {
  if (text === shownStatus) return;
  shownStatus = text;
  $.ui.status(text);
}

const statusOf = (p: Progress, nowMs: number) =>
  `${nameOf(p.path)} w${p.workers} ${p.isDone ? `done ${p.duration ?? ''}`.trim() : `${doneOf(p)}/${p.total}`} ✓${p.passed} ✘${p.failed}` +
  `${p.flaky ? ` ~${p.flaky}` : ''}${p.skipped ? ` -${p.skipped}` : ''}${p.didNotRun ? ` ⊘${p.didNotRun}` : ''}${formatEta(remainingMs(p, nowMs))}`;

async function tick($: EngineInterface) {
  const nowMs = await $.clock.now();
  const pinned = await pinnedLog($);
  const logs = pinned ? [pinned] : await candidateLogs($);
  const last = new Map((await read($, runs)).map((p) => [p.path, p]));
  const next: Progress[] = [];
  for (const log of logs) {
    const previous = last.get(log.path);
    if (previous?.mtimeMs === log.mtimeMs) {
      next.push(previous);
      continue;
    }
    if (notRunLogs.get(log.path) === log.mtimeMs) continue;
    const text = await $.fs.read(log.path).catch(() => '');
    if (!isRunLog(text)) {
      notRunLogs.set(log.path, log.mtimeMs);
      continue;
    }
    sourceCache.clear();
    const parsed = parse(
      log.path,
      text,
      await expectedFailures($, log.path, text),
      log.mtimeMs,
      nowMs,
      previous ?? null,
    );
    next.push(await withRecords($, parsed, text));
  }
  const visible = next.filter((p) => isVisible(p, nowMs)).sort((a, b) => a.path.localeCompare(b.path));
  await update($, runs, () => visible);

  if (visible.length === 0) {
    setStatus($, undefined);
    if (!isHidden) {
      isHidden = true;
      await $.ui.close({ id: PANE }).catch(() => undefined);
    }
    return;
  }

  isHidden = false;
  setStatus($, `e2e ${visible.map((p) => statusOf(p, nowMs)).join('  │  ')}`);
}

async function run($: EngineInterface) {
  lastTickMs = await $.clock.now();
  try {
    await tick($);
  } catch (error) {
    setStatus($, `e2e-progress failed: ${String(error)}`);
  }
}

function start($: EngineInterface) {
  timer?.cancel();
  timer = $.clock.every(TICK_MS, () => run($));
}

async function revive($: EngineInterface) {
  if ((await $.clock.now()) - lastTickMs < STALE_MS) return;
  start($);
  await run($);
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'e2e',
      description:
        'Show e2e run progress. Optional arg: a log path to pin; "auto" removes the pin; "off" clears the status',
    });
    start($);
    return next(e);
  });

  on('prompt.submit', async ($, e, next) => {
    await revive($);
    return next(e);
  });

  on('tool.call', async ($, e, next) => {
    await revive($);
    return next(e);
  });

  on('turn.complete', async ($, e, next) => {
    await revive($);
    return next(e);
  });

  on('command.run', { command: 'e2e' }, async ($, e) => {
    const arg = e.args.trim();
    if (arg === 'off') {
      setStatus($, undefined);
      return { text: 'e2e status cleared until the log changes.' };
    }
    if (arg === 'auto') {
      await update($, pinnedPath, () => null);
      start($);
      await run($);
      return { text: `Pin removed. Watching the newest logs under ${HANDOFFS}.` };
    }
    if (arg !== '') await update($, pinnedPath, () => arg);
    start($);
    await $.ui.open({ id: PANE, title: 'E2E progress' });
    return { text: arg ? `Watching ${arg}.` : 'E2E progress pane opened.' };
  });

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e);
    const shown = await read($, runs);
    if (shown.length === 0)
      return (
        <Text dimColor>
          No active run log under {HANDOFFS} or {WORKTREES}/*/{HANDOFFS}.
        </Text>
      );

    const nowMs = await $.clock.now();
    const room = Math.max(1, Math.floor(((e.viewport?.rows ?? 24) - 6 * shown.length) / shown.length));
    return (
      <Box flexDirection="column">
        {shown.map((p) => {
          const done = doneOf(p);
          return (
            <Box flexDirection="column" marginBottom={1}>
              <Text bold>
                {nameOf(p.path)} <Text dimColor>· {p.workers} workers</Text>
              </Text>
              <Text dimColor wrap="truncate-start">
                {p.path}
              </Text>
              <Text>
                {p.isDone ? `finished in ${p.duration ?? '?'}` : `${done} / ${p.total}`}
                {p.total > 0 && !p.isDone ? ` (${Math.round((done / p.total) * 100)}%)` : ''}
                {formatEta(remainingMs(p, nowMs))}
              </Text>
              <Text>
                <Text color="green">✓ {p.passed}</Text> <Text color="red">✘ {p.failed}</Text>{' '}
                <Text dimColor>- {p.skipped} skipped</Text>
                {p.didNotRun > 0 ? <Text color="yellow"> ⊘ {p.didNotRun} did not run</Text> : ''}
                {p.flaky > 0 ? <Text color="yellow"> ~ {p.flaky} flaky</Text> : ''}
              </Text>
              {p.expected > 0 && <Text dimColor>{p.expected} expected failures (test.fail) counted as passed</Text>}
              {p.failures.slice(-room).map((f) => (
                <Text color="red" wrap="truncate-end">
                  ✘ {f}
                </Text>
              ))}
            </Box>
          );
        })}
      </Box>
    );
  });
};
