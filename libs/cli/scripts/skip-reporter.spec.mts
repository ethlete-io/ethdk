import type { TestModule } from 'vitest/node';
import { browserSkipSummary, countBrowserSkips } from '../vitest.skip-reporter.mjs';

const moduleWith = (...notes: (string | undefined)[]) =>
  ({
    children: {
      allTests: () => notes.map((note) => ({ result: () => ({ state: 'skipped', note }) })),
    },
  }) as unknown as TestModule;

describe('countBrowserSkips', () => {
  it('counts only the skipped specs whose reason names a missing browser', () => {
    const modules = [moduleWith('no browser', "Executable doesn't exist at /x/chromium", 'other reason', undefined)];

    expect(countBrowserSkips(modules)).toBe(2);
  });

  it('adds up the skips of every module', () => {
    expect(countBrowserSkips([moduleWith('no browser'), moduleWith('no browser')])).toBe(2);
  });

  it('words the summary line', () => {
    expect(browserSkipSummary(3)).toBe('3 browser specs skipped: no Chromium');
  });
});
