#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { withStudio } from '../../../tools/scripts/verify-studio-headless.mjs';
import { placeSketchDraft } from './sketch-comment-draft.mjs';

const args = process.argv.slice(2);
const valueOf = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
const checkout = resolve(valueOf('--checkout', resolve(import.meta.dirname, '../../..')));
const built = args.includes('--built') ? resolve(valueOf('--built')) : undefined;
const product = valueOf('--product', 'studio');
const target = valueOf('--sketch', 'pages/system');
const shot = valueOf('--shot');
const afterShot = resolve(valueOf('--after-shot', '/tmp/kommentar-senden/after.png'));
const commentsRoot = join(checkout, '.ethlete/design');
const commentFiles = (dir = commentsRoot) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : commentFiles(path);

    return entry.name.endsWith('.json') && dir.endsWith('/comments') ? [path] : [];
  });

const result = await withStudio(
  async ({ page, studioUrl }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(studioUrl);
    await page.evaluate(
      ({ checkout, systemProduct, systemEntry }) => {
        localStorage.clear();
        localStorage.setItem('ethlete-studio.call-view', JSON.stringify({ checkout, systemProduct, systemEntry }));
      },
      { checkout, systemProduct: product, systemEntry: `sketch:${target}` },
    );
    await page.goto(studioUrl);
    await page.waitForSelector('ethlete-sketches [data-sk-frame]', { timeout: 120_000 });
    await page.waitForTimeout(5000);

    const placed = await placeSketchDraft(page);

    if (shot) await page.screenshot({ path: shot });
    if (!placed.ok) return placed;

    const text = `e2e Kommentar ${Date.now()}`;
    const list = page.locator('ethlete-sketches ethlete-comment-list');
    const before = existsSync(commentsRoot) ? commentFiles() : [];
    const textarea = page.locator('ethlete-sketches ethlete-comment-draft textarea');
    const send = page.locator('ethlete-sketches ethlete-comment-draft button[et-button]', {
      hasText: /^\s*Senden\s*$/,
    });

    await textarea.fill(text);
    await send.click();
    await page.waitForTimeout(2000);
    mkdirSync(dirname(afterShot), { recursive: true });
    await page.screenshot({ path: afterShot });

    const written = commentFiles().filter(
      (file) => !before.includes(file) && readFileSync(file, 'utf8').includes(text),
    );
    const listed = await list.innerText().catch(() => '');

    written.forEach((file) => rmSync(file));

    const onDisk = written.length === 1;
    const shown = /1\s*offen/.test(listed) && listed.includes(text);

    return {
      ok: onDisk && shown,
      detail: `${placed.detail}; Senden: on disk ${onDisk ? written[0] : 'no'}, list ${JSON.stringify(listed.replace(/\s+/g, ' ').trim().slice(0, 120))}`,
    };
  },
  { checkout, built },
);

console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${product} sketch ${target}: ${result.detail}`);
console.log(`\n${result.ok ? 1 : 0}/1 passed`);
process.exit(result.ok ? 0 : 1);
