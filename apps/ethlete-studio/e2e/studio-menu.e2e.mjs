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

    await page.goto(studioUrl);
    await page.waitForSelector(TRIGGER, { timeout: 60000 });
    await page.evaluate(() => {
      const internals = window.__TAURI_INTERNALS__;
      const invoke = internals.invoke;

      window.__hostCalls = [];
      internals.invoke = (command, args) => {
        window.__hostCalls.push(command);
        if (command === 'help_open') return Promise.resolve(null);
        if (command === 'plugin:app|version') return Promise.resolve('0.2.0-e2e.1');

        return invoke(command, args);
      };
    });
    await page.waitForTimeout(1500);

    const check = (name, ok, detail = '') => {
      rows.push({ state: name, ok });
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`);
    };
    const pick = async (label) => {
      await page.click(TRIGGER);
      await page.waitForSelector('et-menu[aria-label="Studio"]');
      await page.getByRole('menuitem', { name: label, exact: true }).click();
      await page.waitForTimeout(400);
    };
    const closeWithEscape = async (selector) => {
      await page.keyboard.press('Escape');
      await page.waitForSelector(selector, { state: 'detached', timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(300);

      return page.evaluate(
        ({ selector, trigger }) => ({
          gone: !document.querySelector(selector),
          focusOnTrigger: document.activeElement === document.querySelector(trigger),
        }),
        { selector, trigger: TRIGGER },
      );
    };

    await pick('Tastenkürzel');
    const shortcutRows = await page.locator('ethlete-shortcuts-dialog dt').count();
    check('row Tastenkürzel opens the dialog', shortcutRows === 7, `${shortcutRows} shortcut rows`);
    const shortcutsClosed = await closeWithEscape('ethlete-shortcuts-dialog');
    check(
      'Tastenkürzel closes on Escape, focus on the tile',
      shortcutsClosed.gone && shortcutsClosed.focusOnTrigger,
      JSON.stringify(shortcutsClosed),
    );

    await pick('Über Studio');
    const about = (await page.locator('ethlete-about-dialog').textContent())?.replace(/\s+/g, ' ') ?? '';
    check(
      'row Über Studio shows the host version',
      about.includes('Version 0.2.0-e2e.1') && about.includes('MIT-Lizenz'),
      about.trim(),
    );
    const aboutClosed = await closeWithEscape('ethlete-about-dialog');
    check(
      'Über Studio closes on Escape, focus on the tile',
      aboutClosed.gone && aboutClosed.focusOnTrigger,
      JSON.stringify(aboutClosed),
    );

    await pick('Hilfe');
    const calls = await page.evaluate(() => window.__hostCalls);
    check('row Hilfe asks the host to open the docs', calls.includes('help_open'), calls.join(','));

    await page.mouse.click(600, 400);
    await page.keyboard.press('Control+/');
    await page.waitForTimeout(400);
    const byKey = await page.locator('ethlete-shortcuts-dialog').count();
    check('Ctrl+/ opens Tastenkürzel', byKey === 1, `${byKey} dialogs`);
    await page.keyboard.press('Escape');

    return rows;
  },
  { built },
);

const failed = results.filter((row) => !row.ok);

console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length || !results.length ? 1 : 0);
