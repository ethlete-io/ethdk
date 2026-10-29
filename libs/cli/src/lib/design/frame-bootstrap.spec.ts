import { spawnSync } from 'child_process';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

type Result = {
  initial: { evaluated: boolean; body: string; messages: { type: string }[] };
  body: string;
  error: string | null;
  styles: string[];
  messages: { type: string; errored?: boolean }[];
};

const bootstrap = (outcome: 'resolve' | 'reject', tokens?: 'tokens'): Result => {
  const result = spawnSync(
    process.execPath,
    [
      '--experimental-vm-modules',
      resolve(__dirname, '__fixtures__/frame-bootstrap.mjs'),
      resolve(__dirname, '../../../design/web/frame.ts'),
      outcome,
      ...(tokens ? [tokens] : []),
    ],
    { encoding: 'utf8', timeout: 10000 },
  );

  expect(result.status, result.stderr).toBe(0);

  return JSON.parse(result.stdout) as Result;
};

describe('design frame bootstrap', () => {
  it('finishes module evaluation while the drawing environment is still loading', () => {
    const result = bootstrap('resolve');

    expect(result.initial).toEqual({ evaluated: true, body: '', messages: [{ type: 'design-explore:loading' }] });
    expect(result.body).toBe('<b>Ready</b>');
    expect(result.messages.at(-1)).toMatchObject({ type: 'design-explore:height' });
  });

  it('shows and reports an environment failure after synchronous module evaluation', () => {
    const result = bootstrap('reject');

    expect(result.initial.evaluated).toBe(true);
    expect(result.body).toContain('Environment failed');
    expect(result.error).toContain('Environment failed');
    expect(result.messages.at(-1)).toMatchObject({ type: 'design-explore:height', errored: true });
  });

  it("loads the product's tokens once, before the part's own styles", () => {
    expect(bootstrap('resolve', 'tokens').styles).toEqual([':root{--token:1}', '.part{}']);
  });

  it('adds only the part styles when the product has no tokens', () => {
    expect(bootstrap('resolve').styles).toEqual(['.part{}']);
  });
});
