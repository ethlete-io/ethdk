import { describe, expect, it, vi } from 'vitest';
import { Chromium } from './browser';
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
});
