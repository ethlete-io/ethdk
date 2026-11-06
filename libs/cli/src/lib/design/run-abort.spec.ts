import { EventEmitter } from 'events';
import { describe, expect, it, vi } from 'vitest';
import { RunAbortedError, withRunSignal } from './run-abort';
import { createDrawQueue } from './thumb';

const contextOf = () => Object.assign(new EventEmitter(), { close: vi.fn(async () => undefined) });

const queueOf = (contexts: ReturnType<typeof contextOf>[]) =>
  createDrawQueue({
    target: '/co',
    chromiumOf: async () => ({
      chromium: {
        launch: async () => ({
          close: async () => undefined,
          newContext: async () => {
            const context = contextOf();

            contexts.push(context);

            return context;
          },
        }),
      } as never,
      from: '/co/node_modules/playwright/index.js',
    }),
  });

describe('a draw of an aborted design run', () => {
  it('closes the contexts the run opened and refuses the run its later draws', async () => {
    const contexts: ReturnType<typeof contextOf>[] = [];
    const queue = queueOf(contexts);
    const gone = new AbortController();
    let opened: () => void = () => undefined;
    const ready = new Promise<void>((done) => (opened = done));

    const { later } = await withRunSignal(gone.signal, async () => {
      const running = queue.run(async (browser) => {
        await browser.newContext();
        opened();

        await new Promise((done) => setTimeout(done, 5_000));
      });

      running.catch(() => undefined);
      await ready;
      gone.abort();

      return { later: queue.run(async () => 'drawn') };
    });

    expect(contexts[0]?.close).toHaveBeenCalled();
    await expect(later).rejects.toBeInstanceOf(RunAbortedError);
  });

  it('draws as before outside an aborted run', async () => {
    const contexts: ReturnType<typeof contextOf>[] = [];
    const queue = queueOf(contexts);

    expect(
      await queue.run(async (browser) => {
        await browser.newContext();

        return 'drawn';
      }),
    ).toBe('drawn');
    expect(contexts[0]?.close).not.toHaveBeenCalled();
  });
});
