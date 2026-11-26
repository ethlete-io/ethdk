import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execPlain, plainEnv, spawnPlain, stripAnsi } from './plain-output';

const colourful = `process.stdout.write(process.env.NO_COLOR + '|' + process.env.FORCE_COLOR + '|\\u001b[31mred\\u001b[0m\\n')`;

describe('plain output of a child process', () => {
  const before = process.env['FORCE_COLOR'];

  beforeEach(() => {
    process.env['FORCE_COLOR'] = '1';
  });

  afterEach(() => {
    if (before === undefined) delete process.env['FORCE_COLOR'];
    else process.env['FORCE_COLOR'] = before;
  });

  it('strips colour codes and links', () => {
    expect(stripAnsi('\u001b[1m\u001b[31mfile.ts\u001b[0m:1 \u001b]8;;http://x\u0007link\u001b]8;;\u0007')).toBe(
      'file.ts:1 link',
    );
  });

  it('asks for no colour even when the parent forces it', () => {
    expect(plainEnv()['FORCE_COLOR']).toBe('0');
    expect(plainEnv()['NO_COLOR']).toBe('1');
  });

  it('captures stdout without ANSI under FORCE_COLOR=1', () => {
    const result = spawnPlain([process.execPath, '-e', colourful]);

    expect(result.stdout).toBe('1|0|red\n');
  });

  it('strips the ANSI a child prints regardless of its env', () => {
    const output = execPlain([process.execPath, '-e', `process.stdout.write('\\u001b[31mred\\u001b[0m')`]);

    expect(output).toBe('red');
  });

  it('throws with plain stdout and stderr when the child fails', () => {
    const run = () =>
      execPlain([process.execPath, '-e', `process.stderr.write('\\u001b[31mboom\\u001b[0m'); process.exit(3)`]);

    expect(run).toThrow(expect.objectContaining({ stderr: 'boom', status: 3 }));
  });
});
