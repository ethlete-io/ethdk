import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { recordPerf } from '../perf.fixtures';
import { entryOf, mapPackage } from './render-packages';

vi.mock('./system/build-running', () => ({ isBuildRunning: vi.fn(() => false) }));

describe('entryOf perf', () => {
  it('answers every module of a render.packages fixture within the budget', () => {
    const target = mkdtempSync(join(tmpdir(), 'cli-render-perf-'));
    const packages = { '@ethlete/*': 'dist/libs/*' };
    const budgetMs = 5000;
    const started = performance.now();

    const answers = Array.from({ length: 30 }, (_, index) => {
      const mapped = mapPackage({ specifier: `@ethlete/core/part-${index}`, packages, target });

      try {
        return mapped ? entryOf(mapped) : '';
      } catch (error) {
        return (error as Error).message;
      }
    });
    const elapsedMs = performance.now() - started;

    recordPerf('render-missing-dist-modules', { elapsedMs, budgetMs, modules: answers.length });

    expect(elapsedMs).toBeLessThan(budgetMs);
  });
});
