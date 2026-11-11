import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { sketchCells } from './probe-helpers.mjs';

const FIXTURE = pathToFileURL(new URL('./fixtures/probe-cells.html', import.meta.url).pathname).href;

let browser;
let cells;

before(async () => {
  browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(FIXTURE);
  await page.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0));
  cells = Object.fromEntries((await sketchCells(page)).map((cell) => [cell.key, cell]));
});

after(() => browser?.close());

test('a cell with a live frame is drawn', () => {
  assert.deepEqual(
    { probe: cells.live.probe, shows: cells.live.shows, gone: cells.live.gone },
    { probe: 'drawn', shows: true, gone: undefined },
  );
});

test('a cell with an empty frame is blank and shows nothing', () => {
  assert.deepEqual(
    { probe: cells.empty.probe, framed: cells.empty.framed, shows: cells.empty.shows, gone: cells.empty.gone },
    { probe: 'blank', framed: true, shows: false, gone: undefined },
  );
});

test('a frame removed between the listing and its probe is reported gone, not empty', () => {
  assert.deepEqual(
    { gone: cells.gone.gone, framed: cells.gone.framed, picture: cells.gone.picture, shows: cells.gone.shows },
    { gone: 'frame gone after the census', framed: false, picture: true, shows: true },
  );
});
