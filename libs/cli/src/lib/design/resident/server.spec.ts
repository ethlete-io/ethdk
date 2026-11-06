import { setTimeout as delay } from 'timers/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startResidentServer, TOKEN_HEADER } from './server';

const closers: (() => Promise<void>)[] = [];

afterEach(async () => {
  await Promise.all(closers.splice(0).map((close) => close()));
});

const serverOf = async (options: Partial<Parameters<typeof startResidentServer>[0]> = {}) => {
  const onExit = vi.fn();
  const server = await startResidentServer({
    token: 't',
    identity: { pid: 1 },
    run: async () => 0,
    onExit,
    ...options,
  });

  closers.push(server.close);

  return { ...server, onExit };
};

const runOf = async (port: number, token = 't') => {
  const response = await fetch(`http://127.0.0.1:${port}/run`, {
    method: 'POST',
    headers: { [TOKEN_HEADER]: token },
    body: JSON.stringify({ argv: ['compare'], invocation: 'et design', env: {} }),
  });

  return { status: response.status, body: await response.text() };
};

describe('startResidentServer', () => {
  it('exits after the idle time without a request, counted from the end of the last request', async () => {
    const { port, onExit } = await serverOf({
      idleMs: 150,
      run: async () => {
        await delay(200);

        return 0;
      },
    });

    await delay(100);
    await runOf(port);
    await delay(100);

    expect(onExit).not.toHaveBeenCalled();

    await delay(100);

    expect(onExit).toHaveBeenCalledWith('idle');
  });

  it('refuses a request without the token of its discovery file', async () => {
    const run = vi.fn(async () => 0);
    const { port } = await serverOf({ run });

    expect((await runOf(port, 'other')).status).toBe(403);
    expect(run).not.toHaveBeenCalled();
  });

  it('runs one request at a time and tells the later caller it waits', async () => {
    let active = 0;
    let most = 0;
    const { port } = await serverOf({
      run: async () => {
        active++;
        most = Math.max(most, active);
        await delay(50);
        active--;

        return 0;
      },
    });

    const [, second] = await Promise.all([runOf(port), delay(10).then(() => runOf(port))]);

    expect(most).toBe(1);
    expect(second.body.split('\n')[0]).toBe(
      JSON.stringify({ e: 'waiting for an earlier request to the resident design process\n' }),
    );
    expect(second.body).toContain('{"exit":0}');
  });

  it('answers the exit code of a run that throws as 1 with the error on stderr', async () => {
    const { port } = await serverOf({
      run: async () => {
        throw new Error('boom');
      },
    });
    const { body } = await runOf(port);

    expect(body).toContain('boom');
    expect(body.trim().split('\n').at(-1)).toBe('{"exit":1}');
  });
});
