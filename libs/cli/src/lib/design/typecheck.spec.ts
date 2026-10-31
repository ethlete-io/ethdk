import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { processFailureOf, typecheck } from './typecheck';

const silentFailure = vi.hoisted(() => ({ active: false }));

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();

  return {
    ...actual,
    execFileSync: (...args: Parameters<typeof actual.execFileSync>) => {
      if (!silentFailure.active) return actual.execFileSync(...args);

      throw Object.assign(new Error('spawnSync npx EPERM'), { code: 'EPERM', stdout: '', stderr: '' });
    },
  };
});

describe('typecheck', { timeout: 60_000 }, () => {
  const dirs: string[] = [];
  const previousTsc = process.env['TSC'];

  const checkout = () => {
    const dir = mkdtempSync(join(tmpdir(), 'design-typecheck-'));

    dirs.push(dir);

    return dir;
  };

  afterEach(() => {
    dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));

    silentFailure.active = false;

    if (previousTsc === undefined) delete process.env['TSC'];
    else process.env['TSC'] = previousTsc;
  });

  it('reports compiler diagnostics as a failure', () => {
    const target = checkout();

    writeFileSync(join(target, 'broken.ts'), 'export const value: number = "text";\n');
    writeFileSync(
      join(target, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { strict: true, noEmit: true }, files: ['broken.ts'] }),
    );

    const result = typecheck({ target, tsconfig: 'tsconfig.json' });

    expect(result.kind).toBe('failed');
    expect(result.kind === 'failed' && result.output).toContain('TS2322');
  });

  it('reports a checker that printed nothing as not run, with the process error', () => {
    const target = checkout();

    process.env['TSC'] = '@typescript/native-preview';
    silentFailure.active = true;

    expect(typecheck({ target, tsconfig: 'tsconfig.json' })).toEqual({
      kind: 'unavailable',
      message:
        'TYPE CHECKER DID NOT RUN - npx -y @typescript/native-preview --noEmit -p tsconfig.json printed nothing (EPERM - spawnSync npx EPERM).',
    });
  });
});

describe('processFailureOf', () => {
  it('names the signal of a killed process', () => {
    expect(processFailureOf({ signal: 'SIGKILL', status: null, message: 'Command failed: tsc' })).toBe(
      'signal SIGKILL - Command failed: tsc',
    );
  });

  it('names the exit code and the spawn error', () => {
    expect(processFailureOf({ status: 2, message: 'Command failed' })).toBe('exit code 2 - Command failed');
    expect(processFailureOf({ code: 'EPERM', message: 'spawnSync node EPERM' })).toBe('EPERM - spawnSync node EPERM');
  });

  it('never returns an empty text', () => {
    expect(processFailureOf({})).toBe('no output');
  });
});
