import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { designCommand } from '../design-command';
import { designMocksFresh, guardsDesignMocks, MOCKS_BUILD_COMMAND, staleDesignMocksOf } from './stale-design-mocks';

const write = (path: string, content: string) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
};

const checkout = (options: { source: string; built: string | null }) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-stale-mocks-'));

  write(join(target, 'libs/components/design/button.ts'), options.source);
  write(join(target, 'libs/components/design/button.spec.ts'), 'spec');

  if (options.built !== null) write(join(target, 'dist/libs/components/design/button.ts'), options.built);

  return target;
};

describe('staleDesignMocksOf', () => {
  it('is null while every mock is built identically', () => {
    expect(staleDesignMocksOf({ target: checkout({ source: 'a', built: 'a' }) })).toBeNull();
  });

  it('names a mock whose build differs and the command that rebuilds it', () => {
    const stale = staleDesignMocksOf({ target: checkout({ source: 'b', built: 'a' }) });

    expect(stale?.stale).toEqual(['button.ts']);
    expect(stale?.message).toContain(`run ${MOCKS_BUILD_COMMAND}`);
  });

  it('names a mock with no build at all', () => {
    expect(staleDesignMocksOf({ target: checkout({ source: 'a', built: null }) })?.stale).toEqual(['button.ts']);
  });

  it('says in one line that the built folder is missing, not that it differs', () => {
    expect(staleDesignMocksOf({ target: checkout({ source: 'a', built: null }) })?.message).toBe(
      `REFUSED MISSING DESIGN MOCKS - dist/libs/components/design is missing; the drawings need the built mocks - run ${MOCKS_BUILD_COMMAND}`,
    );
  });

  it('is null in a checkout without mocks', () => {
    expect(staleDesignMocksOf({ target: mkdtempSync(join(tmpdir(), 'cli-design-no-mocks-')) })).toBeNull();
  });
});

describe('guardsDesignMocks', () => {
  it('covers check, sketch check, sketch ready and shot only', () => {
    expect(guardsDesignMocks(['check'])).toBe(true);
    expect(guardsDesignMocks(['shot', 'x/y'])).toBe(true);
    expect(guardsDesignMocks(['sketch', 'check'])).toBe(true);
    expect(guardsDesignMocks(['sketch', 'ready', 'a'])).toBe(true);
    expect(guardsDesignMocks(['sketch', 'list'])).toBe(false);
    expect(guardsDesignMocks(['compare', 'x/y'])).toBe(false);
    expect(guardsDesignMocks(['check', '--product', 'studio', '--app-classes'])).toBe(false);
    expect(guardsDesignMocks(['check', '--product', 'studio', '--rules'])).toBe(false);
  });
});

describe('designCommand with stale mocks', () => {
  it.each([['check'], ['shot', 'x/y'], ['sketch', 'check'], ['sketch', 'ready', 'a', '--by', 'm']])(
    'refuses %j with a non-zero exit and the build command',
    async (...argv) => {
      const target = checkout({ source: 'b', built: 'a' });
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const code = await designCommand({ root: target, argv: argv.flat(), invocation: 'et design' });

      expect(code).toBe(1);
      expect(error.mock.calls.flat().join('\n')).toContain(`run ${MOCKS_BUILD_COMMAND}`);

      error.mockRestore();
    },
  );
});

describe('designMocksFresh', () => {
  it('waits while a build of components runs and passes once the mocks are built', () => {
    const target = checkout({ source: 'a', built: null });
    let polls = 0;
    const sleep = () => {
      polls += 1;
      if (polls === 3) write(join(target, 'dist/libs/components/design/button.ts'), 'a');
    };

    expect(designMocksFresh({ target, buildRunning: () => true, sleep, pollMs: 1, waitMs: 100 })).toBe(true);
    expect(polls).toBe(3);
  });

  it('refuses once the build ended without the mocks, and when no build runs', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const target = checkout({ source: 'a', built: null });
    const sleep = vi.fn();

    expect(designMocksFresh({ target, buildRunning: () => false, sleep })).toBe(false);
    expect(sleep).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('stops waiting after the timeout', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const sleep = vi.fn();

    expect(
      designMocksFresh({
        target: checkout({ source: 'a', built: null }),
        buildRunning: () => true,
        sleep,
        pollMs: 1,
        waitMs: 3,
      }),
    ).toBe(false);
    expect(sleep).toHaveBeenCalledTimes(3);
    error.mockRestore();
  });
});
