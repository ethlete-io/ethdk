// Headless Storybook verification template.
// Copy into the scratchpad, adjust STORY_ID + the assertions, then run:
//   node <scratchpad>/verify.mjs
//
// Playwright is CommonJS and lives in the repo node_modules, so import the
// default export and destructure (a named import fails).
import pw from '/home/tom/dev/ethlete-sdk/node_modules/playwright/index.js';
const { chromium } = pw;

const STORY_ID = 'cdk-tabs-inline--default'; // <-- change me
const url = `http://localhost:4400/iframe.html?viewMode=story&id=${STORY_ID}`;

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
