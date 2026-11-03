#!/usr/bin/env node
import { resolve } from 'node:path';
import { withStudio } from '../../../tools/scripts/verify-studio-headless.mjs';

const root = resolve(import.meta.dirname, '../../..');
const args = process.argv.slice(2);
const built = args.includes('--built') ? resolve(args[args.indexOf('--built') + 1]) : undefined;

process.env['DE_PORT'] ??= '4475';

const CHROME = { os: 'linux', left: [], right: ['minimize', 'maximize', 'close'], preferNoCsd: false };
const CHROME_DELAY_MS = 80;
const WATCH_MS = 1200;
const STEPS = ['Sketches', 'Inbox', 'System'];
const CONTENT = 'ethlete-shell-main nav';

const contentTop = (page) =>
  page.evaluate((selector) => document.querySelector(selector)?.getBoundingClientRect().top ?? null, CONTENT);

const watchAfterClick = (page, label) =>
  page.evaluate(
    ({ selector, label, watchMs }) =>
      new Promise((done) => {
        const tops = [];
        const started = performance.now();
        const sample = () => {
          const nav = document.querySelector(selector);

          tops.push({
            top: nav?.getBoundingClientRect().top ?? null,
            titleBar: !!document.querySelector('ethlete-title-bar'),
          });
          if (performance.now() - started < watchMs) requestAnimationFrame(sample);
          else done(tops);
        };

        document.querySelector(`${selector} button[aria-label="${label}"]`).click();
        requestAnimationFrame(sample);
      }),
    { selector: CONTENT, label, watchMs: WATCH_MS },
  );

const results = await withStudio(
  async ({ page, studioUrl }) => {
    const rows = [];

    await page.goto(studioUrl);
    await page.evaluate((checkout) => {
      localStorage.clear();
      localStorage.setItem(
        'ethlete-studio.call-view',
        JSON.stringify({ checkout, systemProduct: 'studio', systemEntry: 'pages/system' }),
      );
    }, root);
    await page.goto(studioUrl);
    await page.waitForSelector('ethlete-title-bar', { timeout: 60000 });
    await page.waitForTimeout(1500);

    const expected = await contentTop(page);

    rows.push({ ok: expected > 0, line: `title bar drawn, content top ${expected}px` });

    for (const label of STEPS) {
      const frames = await watchAfterClick(page, label);
      const off = frames.filter((frame) => frame.top !== null && frame.top !== expected);
      const missing = frames.filter((frame) => frame.top === null);
      const ok = off.length === 0 && missing.length === 0;

      rows.push({
        ok,
        line: `-> ${label.padEnd(9)} ${frames.length} frames, ${off.length} off ${expected}px (${[...new Set(off.map((frame) => frame.top))].join(', ') || '-'}), ${missing.length} without content, ${frames.filter((frame) => !frame.titleBar).length} without title bar`,
      });
      await page.waitForTimeout(400);
    }

    return rows;
  },
  { built, chrome: { value: CHROME, delayMs: CHROME_DELAY_MS } },
);

for (const row of results) console.log(`${row.ok ? 'PASS' : 'FAIL'}  ${row.line}`);

const failed = results.filter((row) => !row.ok);

console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length || !results.length ? 1 : 0);
