/**
 * Screenshot one Storybook story, with optional forced pseudo-states.
 *
 * Copy to the repository root - Node resolves `playwright` from the working directory.
 *
 *   node shoot.mjs <story-id> [width] [height] [out.png]
 *
 * To hold :hover / :focus-visible / :active open at the same time, fill FORCED below with
 * one entry per element. A CSS selector is matched inside the story's document.
 */
import { chromium } from 'playwright';

const BASE = process.env.SB_URL ?? 'http://localhost:4400';

/** @type {{ selector: string, states: ('hover'|'focus'|'focus-visible'|'active')[] }[]} */
const FORCED = [
  // { selector: '[data-state="hover"] .the-band', states: ['hover'] },
];

const [id, width = '1100', height = '760', out = 'shot.png'] = process.argv.slice(2);

if (!id) {
  console.error('usage: node shoot.mjs <story-id> [width] [height] [out.png]');
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: Number(width), height: Number(height) },
  deviceScaleFactor: 2,
});

await page.goto(`${BASE}/iframe.html?id=${id}&viewMode=story`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#storybook-root > *', { timeout: 15000 });

const overlays = await page.locator('#webpack-dev-server-client-overlay, vite-error-overlay').count();
if (overlays > 0) {
  console.error('compile error overlay is present - the image would lie');
  await browser.close();
  process.exit(1);
}

if (FORCED.length > 0) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });

  for (const { selector, states } of FORCED) {
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector });
    for (const nodeId of nodeIds) {
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: states });
    }
  }
}

await page.waitForTimeout(400);
await page.screenshot({ path: out });
await browser.close();

console.log(out);
