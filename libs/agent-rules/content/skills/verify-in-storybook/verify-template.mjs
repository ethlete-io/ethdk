// Headless Storybook verification template.
// Copy into a scratch directory, adjust STORY_ID + the assertions, then run:
//   node <scratch>/verify.mjs
//
// Playwright is CommonJS and lives in the repo's node_modules, so resolve it
// through createRequire from the repo root rather than importing it by name.
import { createRequire } from 'node:module';

const require = createRequire(`${process.cwd()}/`);
const { chromium } = require('playwright');

const STORY_ID = 'components-button--default'; // <-- change me
const url = `{%storybookUrl%}/iframe.html?viewMode=story&id=${STORY_ID}`;

const browser = await chromium.launch(); // headless by default
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });

// domcontentloaded, NOT networkidle (Storybook's HMR socket never goes idle)
await page.goto(url, { waitUntil: 'domcontentloaded' });

// state:'attached' so intentionally-hidden elements don't time out on 'visible'
await page.waitForSelector('.et-some-component', { state: 'attached' });

// Inspect rendered DOM + computed styles. textContent (not childElementCount)
// is the reliable signal for ng-content / portal-projected text.
const state = await page.$eval('.et-some-component', (el) => {
  const cs = getComputedStyle(el);
  return {
    visibility: cs.visibility,
    opacity: cs.opacity,
    height: el.offsetHeight,
    text: el.textContent.trim(),
  };
});
console.log('state:', JSON.stringify(state));

// Example interaction: click, wait out a CSS transition, re-read.
// await page.click('.et-some-trigger');
// await page.waitForTimeout(500); // >= transition duration
// console.log('after:', JSON.stringify(await page.$eval('.et-some-component', ...)));

await browser.close();
