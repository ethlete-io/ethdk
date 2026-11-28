#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import type { AgentApiDayRows } from '../agent-api/model';
import { askTimetrack, timetrackDiscoveryPath } from './client.mts';
import { diffLines, diffSnapshots, snapshotDayOf } from './snapshot-format.mts';
import type { Snapshot } from './snapshot-format.mts';

const COMMAND = 'node libs/timetrack/src/lib/agent-mcp/timetrack-snapshot.mts';
const USAGE = `Record and compare the running Timetrack app's day rows.

  ${COMMAND} [from] [to] [--out <file>]
  ${COMMAND} --compare <file>

Dates use YYYY-MM-DD and default to the last 7 days. Comparisons read the snapshot's days
and exit 1 if any row or day total changed. Use --json for JSON output or --root <dir>
to select the checkout and resolve relative paths.`;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const pad = (value: number) => String(value).padStart(2, '0');

const dayKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const shiftDay = (day: string, byDays: number) => {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];

  return dayKey(new Date(year, month - 1, date + byDays));
};

const plain = (line: string) =>
  [...line]
    .map((character) => {
      const code = character.codePointAt(0) ?? 0;
      const control = code < 0x20 ? code !== 0x09 && code !== 0x0a : code >= 0x7f && code <= 0x9f;

      return control ? `\\x${code.toString(16).padStart(2, '0')}` : character;
    })
    .join('');

const daysBetween = (from: string, to: string) => {
  const days: string[] = [];

  for (let day = from; day <= to && days.length < 92; day = shiftDay(day, 1)) days.push(day);

  return days;
};

const gitState = (root: string) => {
  const git = (args: string[]) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 256 * 1024 * 1024,
    }).trim();

  try {
    const uncommitted = git(['status', '--porcelain'])
      .split('\n')
      .filter(Boolean)
      .map((line) => line.slice(3));

    return { head: git(['rev-parse', 'HEAD']), uncommitted };
  } catch {
    return {};
  }
};

const takeSnapshot = async (options: { days: string[]; root: string; now: Date }): Promise<Snapshot> => {
  const snapshot: Snapshot = { takenAt: options.now.toISOString(), ...gitState(options.root), days: [] };

  for (const day of options.days) {
    snapshot.days.push(snapshotDayOf(await askTimetrack<AgentApiDayRows>({ op: 'day.rows', day })));
  }

  return snapshot;
};

const defaultSnapshotPath = (now: Date) => {
  const dir = process.env['TIMETRACK_SNAPSHOT_DIR']?.trim() || join(dirname(timetrackDiscoveryPath()), 'snapshots');

  return join(dir, `${now.toISOString().replace(/[:.]/g, '-')}.json`);
};

export const runSnapshot = async (args: string[], now = new Date()) => {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      compare: { type: 'string' },
      out: { type: 'string' },
      root: { type: 'string' },
      json: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const say = (line: string) => console.log(plain(line));

  if (values.help) {
    say(USAGE);

    return 0;
  }

  const root = values.root ?? process.cwd();

  if (values.compare !== undefined) {
    const recorded = JSON.parse(await readFile(resolve(root, values.compare), 'utf8')) as Snapshot;
    const current = await takeSnapshot({ days: recorded.days.map((entry) => entry.day), root, now });
    const diff = diffSnapshots(recorded, current);

    if (values.json) console.log(JSON.stringify(diff, null, 2));
    else diffLines(diff).forEach(say);

    return diff.changedDays ? 1 : 0;
  }

  const to = positionals[1] ?? dayKey(now);
  const from = positionals[0] ?? shiftDay(to, -6);

  if (!DAY.test(from)) throw new Error(`Pass a day as YYYY-MM-DD, not ${from}.`);
  if (!DAY.test(to)) throw new Error(`Pass a day as YYYY-MM-DD, not ${to}.`);

  const path = resolve(root, values.out ?? defaultSnapshotPath(now));
  const recorded = await takeSnapshot({ days: daysBetween(from, to), root, now });

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(recorded, null, 2), { mode: 0o600 });

  if (values.json) console.log(JSON.stringify({ path, days: recorded.days.length }));
  else {
    const rows = recorded.days.reduce((sum, day) => sum + day.rows.length, 0);

    say(`Recorded ${recorded.days.length} day(s), ${rows} row(s) in ${path}`);
  }

  return 0;
};

if (import.meta.main) {
  try {
    process.exitCode = await runSnapshot(process.argv.slice(2));
  } catch (error) {
    console.error(plain(error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  }
}
