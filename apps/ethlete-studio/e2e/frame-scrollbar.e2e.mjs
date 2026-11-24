#!/usr/bin/env node
import { chromium } from 'playwright';
import { cpSync, mkdtempSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { probeFrame } from '../../../tools/client-run/frame-probe.mjs';
import { startDesignServer } from '../../../tools/scripts/verify-studio-headless.mjs';

const USAGE =
  'usage: node apps/ethlete-studio/e2e/frame-scrollbar.e2e.mjs [--checkout <dir> --product <p> --part <layer/name> --state <s> --widths <w,w> [--sketch <target> --variant <v>]] [--shots <prefix>]';
const root = resolve(import.meta.dirname, '../../..');
const args = process.argv.slice(2);
const valueOf = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const given = valueOf('--checkout');
const product = valueOf('--product') ?? (given ? undefined : 'app-a');
const part = valueOf('--part') ?? (given ? undefined : 'elements/card');
const state = valueOf('--state') ?? (given ? undefined : 'poster');
const widths = (valueOf('--widths') ?? (given ? undefined : '112,168'))?.split(',').map(Number);
const sketch = valueOf('--sketch');
const variant = valueOf('--variant');
const shots = valueOf('--shots');

if (!product || !part || !state || !widths) {
  console.error(USAGE);
  process.exit(2);
}

const fixtureCheckout = () => {
  const dir = mkdtempSync(join(tmpdir(), 'studio-frame-scrollbar-e2e-'));

  for (const entry of readdirSync(root)) {
    if (entry !== '.ethlete' && entry !== '.git') symlinkSync(join(root, entry), join(dir, entry));
  }
  cpSync(join(import.meta.dirname, 'fixtures/frame-scrollbar/.ethlete'), join(dir, '.ethlete'), { recursive: true });

  return dir;
};

const checkout = given ? resolve(given) : fixtureCheckout();

process.env['DE_PORT'] ??= '4479';

const stamp = (line) => console.log(`[frame-scrollbar] ${line}`);
const design = await startDesignServer(checkout, stamp);
const browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] });
let failed = 0;

try {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width: width + 40, height: 800 } });
    const search = new URLSearchParams({ product, part, state, ...(sketch ? { sketch, variant } : {}) });
    const { probe } = await probeFrame({ page, url: `http://localhost:${design.port}/frame.html?${search}`, width });

    if (shots) await page.locator('#cell').screenshot({ path: `${shots}-${width}.png` });
    await page.close();

    const bar = probe?.scrollbars.find((scrollbar) => scrollbar.element === 'html');
    const missing = probe?.texts.find(({ text }) => text.startsWith('design-explore:'))?.text;
    const ok = probe !== null && !missing && !bar;

    if (!ok) failed++;
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${part} ${state} · ${width}: ${
        missing
          ? `not drawn: ${missing}`
          : bar
            ? `frame scrollbar ${JSON.stringify(bar.bars)}, page ${bar.client.width}x${bar.client.height}`
            : 'no frame scrollbar'
      }`,
    );
  }
} finally {
  await browser.close();
  design.child.kill('SIGTERM');
  if (!given) rmSync(checkout, { recursive: true, force: true });
}

console.log(`\n${widths.length - failed}/${widths.length} passed`);
process.exit(failed ? 1 : 0);
