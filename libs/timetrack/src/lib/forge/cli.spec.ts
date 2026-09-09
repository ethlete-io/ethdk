import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ProcessResult, ProcessSpec, TimetrackProcessRunner } from '../transport/ports';
import { ForgeRequestError, forgeApi$, forgeApiPaged$, isMissingCliError } from './cli';

const runnerOf = (results: ProcessResult[]) => {
  const specs: ProcessSpec[] = [];
  let call = 0;
  const runner: TimetrackProcessRunner = {
    run$: vi.fn((spec: ProcessSpec) => {
      specs.push(spec);
      const result = results[call] ?? results.at(-1)!;
      call += 1;

      return of(result);
    }),
  };

  return { runner, specs };
};

const ok = (body: unknown): ProcessResult => ({ code: 0, stdout: JSON.stringify(body), stderr: '' });

const read = <T>(runner: TimetrackProcessRunner, query?: Record<string, string>) => {
  const seen = vi.fn();
  const failed = vi.fn();

  forgeApi$<T>({
    runner,
    cli: 'glab',
    hostname: 'git.example.com',
    path: '/events',
    query,
    describe: 'your activity',
  }).subscribe({ next: seen, error: failed });

  return { body: seen.mock.calls[0]?.[0] as T | undefined, error: failed.mock.calls[0]?.[0] as Error | undefined };
};

describe('forgeApi$', () => {
  it('calls the CLI with the endpoint, the host and no leading slash', () => {
    const { runner, specs } = runnerOf([ok([])]);

    read(runner, { after: '2026-08-10' });

    expect(specs[0]).toMatchObject({
      command: 'glab',
      args: ['api', '--hostname', 'git.example.com', 'events?after=2026-08-10'],
    });
  });

  it('reads the status out of the line the CLI puts on stderr', () => {
    const { runner } = runnerOf([{ code: 1, stdout: '{"message":"404"}', stderr: 'glab: 404 Not Found (HTTP 404)' }]);
    const { error } = read(runner);

    expect((error as ForgeRequestError).status).toBe(404);
    expect(error?.message).toContain('your activity');
  });

  it('says a 401 is a login problem, because a shell-out holds no token this app could have expired', () => {
    const { runner } = runnerOf([{ code: 1, stdout: '', stderr: 'glab: 401 Unauthorized (HTTP 401)' }]);

    expect(read(runner).error?.message).toContain('not logged in');
  });

  it('reports a failure with no status line as unreachable, and strips the boxed error furniture', () => {
    const { runner } = runnerOf([
      { code: 1, stdout: '', stderr: '   \n   ERROR   \n\n  dial tcp: lookup git.example.com: no such host.   \n' },
    ]);
    const { error } = read(runner);

    expect((error as ForgeRequestError).status).toBe(0);
    expect(error?.message).toContain('dial tcp: lookup git.example.com: no such host.');
    expect(error?.message).not.toContain('ERROR');
  });

  it('refuses a body that is not JSON rather than handing back undefined', () => {
    const { runner } = runnerOf([{ code: 0, stdout: 'not json at all', stderr: '' }]);

    expect(read(runner).error?.message).toContain('not JSON');
  });
});

describe('forgeApiPaged$', () => {
  const paged = (results: ProcessResult[], maxPages = 20) => {
    const { runner, specs } = runnerOf(results);
    const seen = vi.fn();

    forgeApiPaged$<number>({
      runner,
      cli: 'glab',
      hostname: 'git.example.com',
      path: '/events',
      describe: 'your activity',
      paging: { pageSize: 2, maxPages },
    }).subscribe(seen);

    return { items: (seen.mock.calls[0]?.[0] ?? []) as number[], specs };
  };

  it('reads on while a page comes back full, and stops on the first short one', () => {
    const { items, specs } = paged([ok([1, 2]), ok([3, 2]), ok([4])]);

    expect(items).toEqual([1, 2, 3, 2, 4]);
    expect(specs).toHaveLength(3);
    expect(specs[1]?.args.at(-1)).toContain('page=2');
  });

  it('stops at the cap, so a wide window cannot page forever against a rate-limited instance', () => {
    const { items, specs } = paged([ok([1, 2])], 3);

    expect(items).toHaveLength(6);
    expect(specs).toHaveLength(3);
  });
});

describe('isMissingCliError', () => {
  it('tells a missing binary apart by the prefix the host writes, and nothing else', () => {
    const missing = vi.fn();

    forgeApi$({
      runner: { run$: () => throwError(() => new Error('not installed: glab')) },
      cli: 'glab',
      hostname: 'git.example.com',
      path: '/events',
      describe: 'your activity',
    }).subscribe({ error: missing });

    expect(isMissingCliError(missing.mock.calls[0]?.[0])).toBe(true);
    expect(isMissingCliError(new Error('glab: 404 Not Found (HTTP 404)'))).toBe(false);
  });
});
