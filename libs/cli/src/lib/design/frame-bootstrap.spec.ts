import { spawnSync } from 'child_process';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

type Result = {
  initial: { evaluated: boolean; body: string; messages: { type: string }[] };
  body: string;
  error: string | null;
  pageFill: string;
  styles: string[];
  messages: { type: string; errored?: boolean }[];
  imports: number;
  frames: number;
};

const bootstrap = (outcome: 'resolve' | 'reject', tokens?: 'tokens', query = '', failedImports = 0): Result => {
  const result = spawnSync(
    process.execPath,
    [
      '--experimental-vm-modules',
      resolve(__dirname, '__fixtures__/frame-bootstrap.mjs'),
      resolve(__dirname, '../../../design/web/frame.ts'),
      outcome,
      ...(tokens ? [tokens] : []),
    ],
    {
      encoding: 'utf8',
      timeout: 10000,
      env: { ...process.env, FRAME_QUERY: query, FRAME_FAILED_IMPORTS: String(failedImports) },
    },
  );

  expect(result.status, result.stderr).toBe(0);

  return JSON.parse(result.stdout) as Result;
};

describe('design frame bootstrap', () => {
  it('finishes module evaluation while the drawing environment is still loading', () => {
    const result = bootstrap('resolve');

    expect(result.initial).toEqual({ evaluated: true, body: '', messages: [{ type: 'design-explore:loading' }] });
    expect(result.body).toBe('<b>Ready</b>');
    expect(result.messages.at(-2)).toMatchObject({ type: 'design-explore:height' });
  });

  it('reports the page painted two frames after its first height report', () => {
    const result = bootstrap('resolve');

    expect(result.messages.map(({ type }) => type)).toEqual([
      'design-explore:loading',
      'design-explore:height',
      'design-explore:painted',
    ]);
    expect(result.frames).toBe(2);
  });

  it('shows and reports an environment failure after synchronous module evaluation', () => {
    const result = bootstrap('reject');

    expect(result.initial.evaluated).toBe(true);
    expect(result.body).toContain('Environment failed');
    expect(result.error).toContain('Environment failed');
    expect(result.messages.at(-2)).toMatchObject({ type: 'design-explore:height', errored: true });
    expect(result.messages.at(-1)).toMatchObject({ type: 'design-explore:painted' });
  });

  it("loads the product's tokens once, before the part's own styles", () => {
    expect(bootstrap('resolve', 'tokens').styles).toEqual([':root{--token:1}', '.part{}']);
  });

  it('adds only the part styles when the product has no tokens', () => {
    expect(bootstrap('resolve').styles).toEqual(['.part{}']);
  });

  it('paints the page with the token `fill` names in place of the product fill', () => {
    expect(bootstrap('resolve', undefined, '&fill=surface').pageFill).toBe('var(--surface)');
  });

  it('leaves the page fill to the product without `fill`', () => {
    expect(bootstrap('resolve').pageFill).toBe('');
  });

  it('draws the part when its import fails once while the part file changes', () => {
    const result = bootstrap('resolve', undefined, '', 2);

    expect(result.body).toBe('<b>Ready</b>');
    expect(result.error).toBeNull();
  });

  it('shows the import error once the retries fail too', () => {
    const result = bootstrap('resolve', undefined, '', 99);

    expect(result.error).toContain('Failed to fetch dynamically imported module');
    expect(result.imports).toBe(6);
  });
});
