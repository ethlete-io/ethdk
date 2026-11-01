import type { Reporter, TestModule } from 'vitest/node';

const browserSkip = /browser|chromium|playwright|executable doesn't exist/i;

export const countBrowserSkips = (modules: readonly TestModule[]) => {
  let skipped = 0;

  for (const module of modules) {
    for (const test of module.children.allTests('skipped')) {
      const result = test.result();
      const note = result.state === 'skipped' ? (result.note ?? '') : '';

      if (browserSkip.test(note)) skipped++;
    }
  }

  return skipped;
};

export const browserSkipSummary = (skipped: number) => `${skipped} browser specs skipped: no Chromium`;

export default class BrowserSkipReporter implements Reporter {
  onTestRunEnd(modules: readonly TestModule[]) {
    const skipped = countBrowserSkips(modules);

    if (skipped === 0) return;

    const summary = browserSkipSummary(skipped);

    process.stdout.write(`\n${summary}\n`);

    if (process.env['GITHUB_ACTIONS'] === 'true')
      process.stdout.write(`::warning title=Browser specs skipped::${summary}\n`);
  }
}
