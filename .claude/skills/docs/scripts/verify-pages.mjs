// Verify built docs pages: h1 renders and every <StoryEmbed> reaches sb-show-main.
//
// Usage (repo root; requires a running `vitepress preview` + Storybook on :4400):
//   npx vitepress preview apps/docs --port 4873 &   # serves the LAST BUILD — rebuild first
//   node .claude/skills/docs/scripts/verify-pages.mjs /cdk/ /cdk/table /components/menu
//
// Exits 1 if any page misses its h1 or any embed fails to render.
import { createRequire } from 'node:module';
const { chromium } = createRequire(`${process.cwd()}/package.json`)('playwright');

const base = process.env.DOCS_BASE ?? 'http://localhost:4873';
const pages = process.argv.slice(2);
if (!pages.length) {
  console.error('Pass page paths, e.g. node verify-pages.mjs /cdk/ /cdk/table');
  process.exit(2);
}

const browser = await chromium.launch();
const page = await browser.newPage();
let failures = 0;

for (const path of pages) {
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
  const h1 = await page.locator('h1').first().textContent().catch(() => null);
  if (!h1) {
    console.log(`FAIL ${path}: no h1`);
    failures++;
    continue;
  }

  const embeds = page.locator('.story-embed');
  const count = await embeds.count();
  const results = [];
  for (let i = 0; i < count; i++) {
    const embed = embeds.nth(i);
    await embed.scrollIntoViewIfNeeded();
    const iframe = embed.locator('iframe');
    try {
      await iframe.waitFor({ state: 'attached', timeout: 5000 });
      const src = await iframe.getAttribute('src');
      const frame = await (await iframe.elementHandle()).contentFrame();
      // Generous timeout: the Storybook dev server compiles story chunks on demand.
      await frame.waitForSelector('body.sb-show-main', { timeout: 30000 });
      results.push(`ok:${src?.match(/id=([^&]+)/)?.[1]}`);
    } catch {
      results.push(`EMBED-FAIL(${i})`);
      failures++;
    }
  }
  console.log(`${path} — h1="${h1.trim().slice(0, 40)}" embeds=${count} ${results.join(' ')}`);
}

await browser.close();
process.exit(failures ? 1 : 0);
