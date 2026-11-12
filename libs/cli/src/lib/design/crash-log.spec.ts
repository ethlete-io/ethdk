import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crashLogPathOf, installCrashLog, lastCrashOf } from './crash-log';

describe('crash log', () => {
  let target: string;

  beforeEach(() => {
    target = mkdtempSync(join(tmpdir(), 'crash-log-'));
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-12T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    rmSync(target, { recursive: true, force: true });
  });

  const install = () => {
    const handlers: Record<string, (reason: unknown) => void> = {};
    const exit = vi.fn();
    const stderr = vi.fn();

    installCrashLog({
      target,
      port: () => 4402,
      pid: 77,
      on: (event, handler) => void (handlers[event] = handler),
      exit,
      stderr,
    });

    const fire = (event: string, reason: unknown) => handlers[event]?.(reason);

    return { fire, exit, stderr };
  };

  it('writes the stack, time, pid and port, prints the path and exits 1 on an uncaught exception', () => {
    const { fire, exit, stderr } = install();

    fire('uncaughtException', new Error('boom'));

    const log = readFileSync(crashLogPathOf(target), 'utf8');

    expect(log).toContain('2026-11-12T10:00:00.000Z pid 77 port 4402: Error: boom');
    expect(log).toContain('at ');
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining(crashLogPathOf(target)));
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('records an unhandled rejection with a non-error reason', () => {
    const { fire, exit } = install();

    fire('unhandledRejection', 'plain reason');

    expect(readFileSync(crashLogPathOf(target), 'utf8')).toContain('pid 77 port 4402: plain reason');
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('appends a later crash after a separator and reports the last one', () => {
    const { fire } = install();

    fire('uncaughtException', new Error('first'));
    vi.setSystemTime(new Date('2026-11-12T11:00:00.000Z'));
    fire('uncaughtException', new Error('second'));

    const log = readFileSync(crashLogPathOf(target), 'utf8');

    expect(log.split('\n---\n')).toHaveLength(2);
    expect(lastCrashOf(target)).toEqual({
      path: crashLogPathOf(target),
      summary: '2026-11-12T11:00:00.000Z pid 77 port 4402: Error: second',
    });
  });

  it('reports no crash when there is no log', () => {
    expect(lastCrashOf(target)).toBeNull();
  });
});
