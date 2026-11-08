import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEADLINE_EXIT_CODE, deadlineMsOf, noteStep, withRunDeadline } from './run-deadline';

const dirs: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe('withRunDeadline', () => {
  it('ends a run that never settles with a log of its last step and output', async () => {
    const logDir = mkdtempSync(join(tmpdir(), 'run-deadline-'));
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const exited = new Promise<number>((done) =>
      withRunDeadline({ argv: ['shot', 'components/button'], ms: 30, logDir, exit: done }, () => {
        noteStep('shot of hover');
        process.stdout.write('drew rest\n');

        return new Promise<number>(() => undefined);
      }),
    );

    dirs.push(logDir);

    expect(await exited).toBe(DEADLINE_EXIT_CODE);

    const named = /log: (\S+)/.exec(stderr.mock.calls.map(([line]) => String(line)).join(''))?.[1];

    expect(named && existsSync(named)).toBe(true);

    const log = readFileSync(named ?? '', 'utf8');

    expect(log).toContain('design shot components/button passed its deadline');
    expect(log).toContain('last step: shot of hover');
    expect(log).toContain('drew rest');
  });

  it('returns the exit code of a run that ends in time and leaves the streams as they were', async () => {
    const exit = vi.fn();
    const write = process.stdout.write;

    expect(await withRunDeadline({ argv: ['check'], ms: 1000, exit }, async () => 3)).toBe(3);
    expect(exit).not.toHaveBeenCalled();
    expect(process.stdout.write).toBe(write);
  });
});

describe('deadlineMsOf', () => {
  it('gives shot and check a deadline, other commands none, and takes ETHLETE_DESIGN_DEADLINE_MS over it', () => {
    expect(deadlineMsOf('shot', {})).toBeGreaterThan(0);
    expect(deadlineMsOf('check', {})).toBeGreaterThan(0);
    expect(deadlineMsOf('status', {})).toBeNull();
    expect(deadlineMsOf('shot', { ETHLETE_DESIGN_DEADLINE_MS: '250' })).toBe(250);
  });
});
