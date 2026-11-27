import { execFileSync } from 'child_process';
import { describe, expect, it, vi } from 'vitest';
import { Chromium, chromiumOf } from './browser';
import { chromeProcessesOf } from './heap-watch';
import { sharedChromiumOf } from './shared-chromium';

const fakeChromium = () => {
  const closed = vi.fn(async () => undefined);
  const browser = { close: closed, once: vi.fn(), newContext: vi.fn(async () => 'context') };
  const launch = vi.fn(async () => browser);

  return {
    launch,
    closed,
    resolve: async () => ({ chromium: { launch } as unknown as Chromium, from: 'playwright' }),
  };
};

describe('sharedChromiumOf', () => {
  it('starts one Chromium for every launch and ends it with the last lease', async () => {
    const fake = fakeChromium();
    const shared = sharedChromiumOf(fake.resolve);
    const first = await (await shared('/a'))?.chromium.launch();
    const second = await (await shared('/a'))?.chromium.launch();

    expect(fake.launch).toHaveBeenCalledTimes(1);
    expect(await second?.newContext()).toBe('context');

    await first?.close();
    await first?.close();

    expect(fake.closed).not.toHaveBeenCalled();

    await second?.close();

    expect(fake.closed).toHaveBeenCalledTimes(1);

    await (await shared('/a'))?.chromium.launch();

    expect(fake.launch).toHaveBeenCalledTimes(2);
  });

  it('starts a Chromium of its own for other launch args', async () => {
    const fake = fakeChromium();
    const shared = sharedChromiumOf(fake.resolve);
    const plain = await (await shared('/a'))?.chromium.launch({ args: ['--a'] });
    const fast = await (await shared('/a'))?.chromium.launch({ args: ['--a', '--b'] });

    expect(fake.launch).toHaveBeenCalledTimes(2);

    await fast?.close();

    expect(fake.closed).toHaveBeenCalledTimes(1);

    await (await shared('/a'))?.chromium.launch({ args: ['--a'] });

    expect(fake.launch).toHaveBeenCalledTimes(2);

    await plain?.close();
  });

  it('closeAll ends a browser whose lease is still held and forgets it', async () => {
    const fake = fakeChromium();
    const shared = sharedChromiumOf(fake.resolve);

    await (await shared('/a'))?.chromium.launch();
    await shared.closeAll();

    expect(fake.closed).toHaveBeenCalledTimes(1);

    await (await shared('/a'))?.chromium.launch();

    expect(fake.launch).toHaveBeenCalledTimes(2);
  });

  it('leaves no Chrome process of this test behind when closeAll runs while a shot holds its lease', async () => {
    if (!(await chromiumOf(process.cwd()))) return;

    const chromeBelow = (root: number) => {
      const ps = execFileSync('ps', ['-eo', 'pid=,ppid=,stat=,comm='], { encoding: 'utf8' });
      const rows = ps.split('\n').map((line) => line.trim().split(/\s+/));
      const mine = new Set([String(root)]);

      for (let grew = true; grew;) {
        grew = false;

        for (const [pid, ppid] of rows) {
          if (pid && ppid && mine.has(ppid) && !mine.has(pid)) {
            mine.add(pid);
            grew = true;
          }
        }
      }

      return chromeProcessesOf(
        rows
          .filter(([pid]) => pid && mine.has(pid))
          .map((row) => row.join(' '))
          .join('\n'),
      );
    };

    const shared = sharedChromiumOf();
    const lease = await (await shared(process.cwd()))?.chromium.launch();
    const page = await (await lease?.newContext())?.newPage();

    expect(chromeBelow(process.pid).live).toBeGreaterThan(0);

    const shot = page?.goto('data:text/html,<p>x</p>').catch(() => undefined);

    await shared.closeAll();
    await shot;
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(chromeBelow(process.pid)).toEqual({ live: 0, zombie: 0, roots: 0, orphans: 0 });
  }, 30_000);
});
