#!/usr/bin/env node
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { withStudio } from '../../../tools/scripts/verify-studio-headless.mjs';
import { copyPart } from './copy-part.mjs';

const root = resolve(import.meta.dirname, '../../..');
const args = process.argv.slice(2);
const built = args.includes('--built') ? resolve(args[args.indexOf('--built') + 1]) : undefined;
const shot = args.includes('--shot') ? resolve(args[args.indexOf('--shot') + 1]) : undefined;

process.env['DE_PORT'] ??= '4477';

const SKETCH_TARGET = 'components/zoom-chip';
const SKETCH_VIEW = { systemProduct: 'studio', systemEntry: `sketch:${SKETCH_TARGET}` };
const LINK = '<a href="/" data-home-link>Home</a>';
const DRAWN_TIMEOUT_MS = 180000;
const LIVE_TIMEOUT_MS = 10000;
const NAVIGATION_SETTLE_MS = 2000;

const checkout = mkdtempSync(join(tmpdir(), 'studio-frame-link-e2e-'));

for (const entry of readdirSync(root)) {
  if (entry !== '.ethlete' && entry !== '.git') symlinkSync(join(root, entry), join(checkout, entry));
}

cpSync(join(root, '.ethlete/design'), join(checkout, '.ethlete/design'), { recursive: true });
rmSync(join(checkout, '.ethlete/design/studio/sketches'), { recursive: true, force: true });

const sketchFolder = join(checkout, '.ethlete/design/studio/sketches', SKETCH_TARGET.replace('/', '-'));

mkdirSync(join(sketchFolder, 'a', dirname(SKETCH_TARGET)), { recursive: true });
copyPart(join(checkout, '.ethlete/design/studio', SKETCH_TARGET), join(sketchFolder, 'a', SKETCH_TARGET));

const variantFile = join(sketchFolder, 'a', SKETCH_TARGET, 'zoom-chip.ts');
const source = readFileSync(variantFile, 'utf8');
const linked = source.replace(/data-canvas-zoom\s*>/, (tag) => `${tag}${LINK}`);

if (linked === source) throw new Error(`${variantFile}: no \`data-canvas-zoom>\` to put the link after`);

writeFileSync(variantFile, linked);
writeFileSync(
  join(sketchFolder, 'sketch.json'),
  JSON.stringify({
    target: SKETCH_TARGET,
    targets: [SKETCH_TARGET],
    status: 'ready',
    createdAt: '2026-01-01T00:00:00.000Z',
    rounds: [{ key: 'r1', title: '', note: 'frame-link e2e' }],
    variantInfo: { a: { authors: ['frame-link-e2e'], round: 'r1' } },
  }),
);

const linkStaysInFrame = async ({ page, studioUrl }) => {
  await page.goto(studioUrl);
  await page.evaluate(
    ({ view, checkout }) => {
      localStorage.clear();
      localStorage.setItem('ethlete-studio.call-view', JSON.stringify({ checkout, ...view }));
    },
    { view: SKETCH_VIEW, checkout },
  );
  await page.goto(studioUrl);

  const cell = page.locator('ethlete-sketch-view [data-sk-frame^="a "]').first();

  await cell.locator('iframe[data-painted]').first().waitFor({ state: 'attached', timeout: DRAWN_TIMEOUT_MS });

  const key = await cell.getAttribute('data-sk-frame');
  const box = await cell.boundingBox();

  if (!box) return { ok: false, detail: `frame "${key}" has no box` };

  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);

  const live = page.locator(`[data-sk-frame="${key}"] iframe:not(.opacity-0)`).first();
  const deadline = Date.now() + LIVE_TIMEOUT_MS;

  while (
    Date.now() < deadline &&
    (await live.evaluate((frame) => getComputedStyle(frame).pointerEvents).catch(() => 'none')) === 'none'
  )
    await page.waitForTimeout(250);

  const frame = await (await live.elementHandle())?.contentFrame();

  if (!frame) return { ok: false, detail: `frame "${key}" has no live iframe` };

  const link = frame.locator('[data-home-link]');
  const linkBox = await link.boundingBox();

  if (!linkBox) return { ok: false, detail: `frame "${key}" shows no link` };

  await page.mouse.click(linkBox.x + linkBox.width / 2, linkBox.y + linkBox.height / 2);
  await page.waitForTimeout(NAVIGATION_SETTLE_MS);

  const url = new URL(frame.url());
  const body = ((await frame.evaluate(() => document.body?.innerText ?? '').catch(() => '')) || '').trim();

  if (shot) await page.screenshot({ path: shot });

  return {
    ok: url.pathname.endsWith('/frame.html') && body.length > 0,
    detail: `"${key}" after a link click: ${url.pathname}, body ${body.length ? `"${body.slice(0, 40)}"` : 'empty'}`,
  };
};

let failed = 0;

try {
  await withStudio(
    async (context) => {
      const result = await linkStaysInFrame(context);

      if (!result.ok) failed++;
      console.log(`${result.ok ? 'PASS' : 'FAIL'}  link click in a live frame: ${result.detail}`);
    },
    { checkout, built, build: !built },
  );
} finally {
  rmSync(checkout, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);
