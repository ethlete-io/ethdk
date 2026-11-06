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

const runOf = async (port: number, token = 't', argv = ['compare']) => {
  const response = await fetch(`http://127.0.0.1:${port}/run`, {
    method: 'POST',
    headers: { [TOKEN_HEADER]: token },
    body: JSON.stringify({ argv, invocation: 'et design', env: {} }),
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

  it('aborts the run of a client that closes its connection and starts the next request at once', async () => {
    const seen: boolean[] = [];
    const { port } = await serverOf({
      run: async ({ signal }) => {
        if (seen.length > 0) return 0;

        await Promise.race([
          delay(3_000),
          new Promise((done) => signal?.addEventListener('abort', done, { once: true })),
        ]);
        seen.push(signal?.aborted ?? false);

        return 0;
      },
    });
    const client = new AbortController();
    const first = fetch(`http://127.0.0.1:${port}/run`, {
      method: 'POST',
      headers: { [TOKEN_HEADER]: 't' },
      body: JSON.stringify({ argv: ['compare'], invocation: 'et design', env: {} }),
      signal: client.signal,
    }).then((response) => response.text());

    first.catch(() => undefined);
    await delay(100);
    client.abort();

    const asked = performance.now();
    const second = await runOf(port);

    expect(performance.now() - asked).toBeLessThan(1_000);
    expect(second.body).toContain('{"exit":0}');
    expect(seen[0]).toBe(true);
  });

  it('runs a waiting compare between two parts of a running check, each with its own output', async () => {
    const PART_MS = 100;
    const events: string[] = [];
    let compareWaitedMs = Infinity;
    const { port } = await serverOf({
      jumps: ({ argv }) => argv[0] === 'compare',
      run: async ({ argv, yieldTurn, waitedMs }) => {
        if (argv[0] === 'compare') {
          compareWaitedMs = waitedMs ?? Infinity;
          events.push('compare');
          process.stdout.write('compared\n');

          return 0;
        }

        for (let part = 0; part < 5; part++) {
          await yieldTurn?.();
          events.push(`part ${part}`);
          process.stdout.write(`part ${part}\n`);
          await delay(PART_MS);
        }

        return 1;
      },
    });

    const check = runOf(port, 't', ['check', '--product', 'studio']);

    await delay(PART_MS / 2);

    const compare = await runOf(port);

    expect(events).not.toContain('part 4');
    expect(compareWaitedMs).toBeLessThan(PART_MS * 1.5);
    expect(compare.body).toContain('compared');
    expect(compare.body).not.toContain('part ');

    const checked = await check;

    expect(events.indexOf('compare')).toBeGreaterThan(0);
    expect(checked.body).toContain('part 4');
    expect(checked.body).not.toContain('compared');
    expect(checked.body).toContain('{"exit":1}');
  });

  it('keeps a waiting request that does not jump behind the running one', async () => {
    const events: string[] = [];
    const { port } = await serverOf({
      jumps: () => false,
      run: async ({ argv, yieldTurn }) => {
        if (argv[0] === 'compare') {
          events.push('compare');

          return 0;
        }

        for (let part = 0; part < 3; part++) {
          await yieldTurn?.();
          events.push(`part ${part}`);
          await delay(50);
        }

        return 0;
      },
    });

    const check = runOf(port, 't', ['check', '--product', 'studio']);

    await delay(25);
    await runOf(port);
    await check;

    expect(events).toEqual(['part 0', 'part 1', 'part 2', 'compare']);
  });
});
