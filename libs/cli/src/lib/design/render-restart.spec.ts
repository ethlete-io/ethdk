import { describe, expect, it, vi } from 'vitest';
import { createRenderer } from './render';
import { DesignConfig } from './paths';

const workers: { workerData: { packages: Record<string, string> }; terminate: () => void }[] = [];

vi.mock('worker_threads', () => ({
  Worker: class {
    constructor(_file: string, options: { workerData: { packages: Record<string, string> } }) {
      workers.push({ workerData: options.workerData, terminate: vi.fn() });
    }
    on() {
      return this;
    }
    postMessage() {
      return undefined;
    }
    terminate() {
      workers.at(-1)?.terminate();
    }
  },
}));

describe('createRenderer', () => {
  it('starts a new worker once render.packages changes in the shared config', () => {
    const config: DesignConfig = { render: { packages: { a: 'one' } } };
    const render = createRenderer({ target: '/tmp/x', config });
    const ask = { call: 'app/one', template: '<p></p>', imports: [] };

    void render(ask);
    void render(ask);

    expect(workers).toHaveLength(1);

    config.render = { packages: { a: 'two' } };
    void render(ask);

    expect(workers).toHaveLength(2);
    expect(workers[1]?.workerData.packages).toEqual({ a: 'two' });
  });

  it('stops its worker and settles open renders on close', async () => {
    workers.length = 0;

    const render = createRenderer({ target: '/tmp/x', config: {} });
    const open = render({ call: 'app/one', template: '<p></p>', imports: [] });

    await render.close();

    expect(workers[0]?.terminate).toHaveBeenCalledOnce();
    await expect(open).resolves.toEqual({ error: 'design-explore: the renderer closed' });
  });
});
