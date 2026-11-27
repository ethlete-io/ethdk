import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse, parseUnit, registryRuns } from '../../content/mods/plugins/e2e-progress/hooks/progress';

const fixture = (name: string) => readFileSync(resolve(__dirname, 'fixtures/e2e-progress', name), 'utf8');

describe('e2e-progress parse', () => {
  it('counts the ok, x and dash markers of a list reporter without unicode symbols (w20 run)', () => {
    const p = parse('run.log', fixture('w20.log'), new Set(), 0, 0, null);

    expect(p.workers).toBe(20);
    expect(p.total).toBe(1719);
    expect(p.passed).toBe(8);
    expect(p.failed).toBe(1);
    expect(p.skipped).toBe(2);
    expect(p.failures).toHaveLength(1);
  });

  it('reads a finished vitest run from its summary', () => {
    const p = parseUnit('run.log', fixture('vitest-unit.log'), 0, 0, false);

    expect(p).toMatchObject({ kind: 'unit', total: 28, passed: 28, failed: 0, isDone: true, duration: '291ms' });
  });

  it('counts the tests of the finished files while vitest still runs', () => {
    const live = fixture('vitest-unit.log').split('\n').slice(0, 4).join('\n');

    expect(parseUnit('run.log', live, 0, 0, false)).toMatchObject({ passed: 1, failed: 0, total: 0, isDone: false });
  });

  it('reads a node --test run from its summary, and from its ticks while it runs', () => {
    const text = fixture('node-test-unit.log');
    const live = text.slice(0, text.indexOf('ℹ tests'));

    expect(parseUnit('run.log', text, 0, 0, false)).toMatchObject({ total: 5, passed: 5, failed: 0, isDone: true });
    expect(parseUnit('run.log', live, 0, 0, false)).toMatchObject({ passed: 5, isDone: false });
    expect(parseUnit('run.log', '', 0, 0, true)).toMatchObject({ passed: 0, isDone: true });
    expect(parseUnit('run.log', '✔  nx run core:build:production\n', 0, 0, false)).toMatchObject({ passed: 0 });
  });
});

describe('e2e-progress registry', () => {
  it('lists only runs of the session and its project', async () => {
    const registry = '/tmp/ethlete-runs';
    const now = 100_000;
    const sdk = '/home/tom/dev/ethlete-sdk';
    const fifagg = '/home/tom/dev/fut-frontend';
    const entries = [
      { cwd: sdk + '/libs/agent-rules', pid: 1001 },
      { cwd: sdk, pid: 1007, sessionId: 'other-session' },
      { cwd: sdk, pid: 1008, sessionId: undefined },
      { cwd: fifagg, pid: 1002 },
      { cwd: sdk + '-other', pid: 1003 },
      { cwd: sdk, pid: 1004, endedAt: now - 1000 },
      { cwd: fifagg, pid: 1005, endedAt: now - 1000 },
      { pid: 1006 },
    ].map((entry) => ({
      sessionId: 'mine',
      ...entry,
      log: `${registry}/${entry.pid}.log`,
      machine: 'tank',
      label: 'playwright',
    }));
    const fs = {
      list: async () => entries.map(({ pid }) => ({ name: `${pid}.json`, kind: 'file' })),
      read: async (path: string) => JSON.stringify(entries.find(({ pid }) => path === `${registry}/${pid}.json`)),
      stat: async () => ({ mtimeMs: now }),
    };
    const runPids = async (projectRoot: string) =>
      (await registryRuns(fs, { nowMs: now, projectRoot, sessionId: 'mine' })).map(({ entry }) => entry.pid);

    expect(await runPids(sdk)).toEqual([1001, 1004]);
    expect(await runPids(fifagg)).toEqual([1002, 1005]);
  });
});
