#!/usr/bin/env node
import { resolve } from 'node:path';
import { withStudio } from '../../../tools/scripts/verify-studio-headless.mjs';

const root = resolve(import.meta.dirname, '../../..');
const args = process.argv.slice(2);
const built = args.includes('--built') ? resolve(args[args.indexOf('--built') + 1]) : undefined;

process.env['DE_PORT'] ??= '4474';

const TRIGGER = 'ethlete-studio-menu button[aria-label="Studio-Menü"]';

const radii = (page) =>
  page.evaluate((selector) => {
    const button = document.querySelector(selector);
    const svg = button.querySelector('svg');
    const rect = svg.querySelector('rect');
    const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
    const style = getComputedStyle(button);

    return {
      button: parseFloat(style.borderTopLeftRadius),
      outline: style.outlineStyle,
      mark: Number(rect.getAttribute('rx')) * scale,
    };
  }, TRIGGER);

const STATES = [
  { name: 'rest', enter: async () => undefined },
  { name: 'hover', enter: (page) => page.hover(TRIGGER) },
  {
    name: 'focus-visible',
    enter: async (page) => {
      await page.keyboard.press('Shift');
      await page.focus(TRIGGER);
    },
  },
  {
    name: 'open',
    enter: async (page) => {
      await page.click(TRIGGER);
      await page.waitForSelector('et-menu[aria-label="Studio"]');
      await page.mouse.move(800, 800);
    },
  },
];

const results = await withStudio(
  async ({ page, studioUrl }) => {
    const rows = [];

    for (const state of STATES) {
      await page.goto(studioUrl);
      await page.evaluate((checkout) => {
        localStorage.clear();
        localStorage.setItem(
          'ethlete-studio.call-view',
          JSON.stringify({ checkout, systemProduct: 'studio', systemEntry: 'pages/system' }),
        );
      }, root);
      await page.goto(studioUrl);
      await page.waitForSelector(TRIGGER, { timeout: 60000 });
      await page.waitForTimeout(1500);
      await state.enter(page);
      await page.waitForTimeout(400);

      const measured = await radii(page);
      const ok = Math.abs(measured.button - measured.mark) < 0.01;

      rows.push({ state: state.name, ok });
      console.log(
        `${ok ? 'PASS' : 'FAIL'}  trigger ${state.name.padEnd(14)} button radius ${measured.button}px, mark radius ${measured.mark}px`,
      );
    }

    return rows;
  },
  { built },
);

const failed = results.filter((row) => !row.ok);

console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
