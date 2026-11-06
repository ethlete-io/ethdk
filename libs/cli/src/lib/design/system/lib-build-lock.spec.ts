import { mkdtempSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { setTimeout as delay } from 'timers/promises';
import { describe, expect, it } from 'vitest';
import { LockSystem } from '../../api/lock';
import { readFreshLibBuild } from './lib-build-lock';

const systemOf = (pid: number, dead: number[] = []): LockSystem => ({
  now: () => Date.now(),
  sleep: async () => void (await delay(5)),
  kill: (target) => {
    if (dead.includes(target)) throw Object.assign(new Error('dead'), { code: 'ESRCH' });
  },
  hostname: () => 'host',
  pid,
});

const fakeBuild = () => {
  const state = { stale: true, builds: 0, active: 0, maxActive: 0 };
  const rebuild = async () => {
    state.builds += 1;
    state.active += 1;
    state.maxActive = Math.max(state.maxActive, state.active);
    await delay(40);
    state.active -= 1;
    state.stale = false;

    return true;
  };

  return { state, stale: () => state.stale, rebuild };
};

describe('readFreshLibBuild', () => {
  it('lets two design calls that start at once both pass, one rebuild at a time, the second waiting', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'cli-lib-build-lock-'));
    const { state, stale, rebuild } = fakeBuild();
    const lines: string[] = [];
    const call = (pid: number) =>
      readFreshLibBuild({ directory, stale, rebuild, env: {}, log: (line) => lines.push(line), system: systemOf(pid) });

    const [first, second] = await Promise.all([call(101), call(102)]);

    expect([first.ok, second.ok]).toEqual([true, true]);
    expect(state.maxActive).toBe(1);
    expect(state.builds).toBe(1);
    expect(lines).toEqual(['waiting for the lib build of pid 101']);

    first.release();
    second.release();
    expect(readdirSync(join(directory, 'readers'))).toEqual([]);
  });

  it('does not rebuild while another design call still reads the build', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'cli-lib-build-lock-'));
    const { state, stale, rebuild } = fakeBuild();
    const lines: string[] = [];

    state.stale = false;

    const reader = await readFreshLibBuild({ directory, stale, rebuild, env: {}, system: systemOf(101) });

    state.stale = true;

    const pending = readFreshLibBuild({
      directory,
      stale,
      rebuild,
      env: {},
      log: (line) => lines.push(line),
      system: systemOf(102),
    });

    await delay(60);
    expect(state.builds).toBe(0);

    reader.release();

    expect((await pending).ok).toBe(true);
    expect(state.builds).toBe(1);
    expect(lines).toEqual(['waiting for the design runs of pid 101 to finish reading the lib build']);
  });

  it('rebuilds past the reader file of a dead design call', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'cli-lib-build-lock-'));
    const { state, stale, rebuild } = fakeBuild();

    await readFreshLibBuild({ directory, stale: () => false, rebuild, env: {}, system: systemOf(101) });

    expect((await readFreshLibBuild({ directory, stale, rebuild, env: {}, system: systemOf(102, [101]) })).ok).toBe(
      true,
    );
    expect(state.builds).toBe(1);
  });

  it('skips the lock in a design call started by one that already reads the build', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'cli-lib-build-lock-'));
    const { state, stale, rebuild } = fakeBuild();
    const env: NodeJS.ProcessEnv = {};
    const parent = await readFreshLibBuild({ directory, stale, rebuild, env, system: systemOf(101) });

    state.stale = true;

    expect((await readFreshLibBuild({ directory, stale, rebuild, env: { ...env }, system: systemOf(102) })).ok).toBe(
      true,
    );
    expect(state.builds).toBe(1);

    parent.release();
    expect(env).toEqual({});
  });
});
