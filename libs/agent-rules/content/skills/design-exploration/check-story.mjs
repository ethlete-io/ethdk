/**
 * Find out why a story does not render, in the cheapest order.
 *
 * A compile error renders as an overlay on top of the story, so a screenshot of it looks
 * like a design. Run this first, and never screenshot before it says `ok`.
 *
 * Copy to the repository root - Node resolves `playwright` from the working directory.
 *
 *   node check-story.mjs --lint <file>… --tsconfig <path>        # ~4s, no browser
 *   node check-story.mjs --tsconfig <path> --story <story-id>    # + the render
 *   SB_URL=http://localhost:4401 node check-story.mjs --story <story-id>
 *
 * Three stages, because they cost three different amounts:
 *
 * 1. `eslint` on the files you changed, about a second. Name the files - never a whole
 *    project, which is far slower and can fight the user's own editor.
 * 2. `tsc --noEmit` reads the source. It needs no dev server, waits for no rebuild, and
 *    catches every syntax and type error in about three seconds. Almost everything you
 *    break is caught here.
 * 3. The browser catches what the source cannot: an Angular template error, a runtime
 *    throw, a missing story id. It costs a browser launch, and it can only see a build the
 *    dev server has already finished, so a fresh edit needs a few seconds first.
 *
 * A type error does not stop this repo's Storybook - it transpiles without checking - so
 * stage 2 alone will report `ok` on a file that does not compile. That is why stage 1 exists.
 */
import { execFileSync } from 'node:child_process';

const BASE = process.env.SB_URL ?? 'http://localhost:4400';

/**
 * The type checker to run. `tsc` resolves the one the repository installed. Set
 * `TSC=@typescript/native-preview` for the Go port, which is about a third faster - but it
 * rejects a `baseUrl` in the config, so a repository that still uses one cannot run it.
 */
const TSC = process.env.TSC ?? null;

const flags = { '--lint': [], '--tsconfig': [], '--story': [] };
let current = null;

for (const arg of process.argv.slice(2)) {
  if (arg in flags) current = arg;
  else if (current) flags[current].push(arg);
}

const lintFiles = flags['--lint'];
const [tsconfig] = flags['--tsconfig'];
const [id] = flags['--story'];

if (lintFiles.length === 0 && !tsconfig && !id) {
  console.error('usage: node check-story.mjs [--lint <file>…] [--tsconfig <path>] [--story <id>]');
  process.exit(2);
}

/** A bundler stack runs to hundreds of frames and says nothing. Keep the message. */
const trim = (text) =>
  [...new Set(text.split('\n').filter((line) => !/^\s+at /.test(line) && line.trim() !== ''))].slice(0, 12).join('\n');

if (lintFiles.length > 0) {
  try {
    execFileSync('npx', ['eslint', ...lintFiles], { encoding: 'utf8', stdio: 'pipe' });
  } catch (error) {
    console.error(`LINT\n${trim(`${error.stdout ?? ''}${error.stderr ?? ''}`)}`);
    process.exit(1);
  }
}

if (tsconfig) {
  try {
    const cmd = TSC ? ['-y', TSC] : ['tsc'];
    execFileSync('npx', [...cmd, '--noEmit', '-p', tsconfig], { encoding: 'utf8', stdio: 'pipe' });
  } catch (error) {
    console.error(`TYPE ERROR\n${trim(`${error.stdout ?? ''}${error.stderr ?? ''}`)}`);
    process.exit(1);
  }
}

if (!id) {
  console.log('ok');
  process.exit(0);
}

const { chromium } = await import('playwright');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

/** Angular throws at render time; the overlay never shows those, so read the console too. */
const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push(e.message));

await page.goto(`${BASE}/iframe.html?id=${id}&viewMode=story`, { waitUntil: 'domcontentloaded' });

const rendered = await page
  .locator('#storybook-root > *')
  .first()
  .waitFor({ timeout: 15000 })
  .then(
    () => true,
    () => false,
  );

/** The overlay is an iframe, so its text is only reachable through a frame locator. */
const overlay = page.locator('#webpack-dev-server-client-overlay');
const overlayText =
  (await overlay.count()) > 0
    ? await page
        .frameLocator('#webpack-dev-server-client-overlay')
        .locator('body')
        .innerText()
        .catch(() => '(overlay present, text unreadable)')
    : '';

await browser.close();

if (overlayText) {
  console.error(`COMPILE ERROR on ${id}\n${trim(overlayText)}`);
  process.exit(1);
}

if (!rendered) {
  console.error(`EMPTY on ${id} - #storybook-root never got a child.`);
  if (consoleErrors.length > 0) console.error(trim(consoleErrors.join('\n')));
  process.exit(1);
}

if (consoleErrors.length > 0) {
  console.error(`RENDERED WITH ERRORS on ${id}\n${trim(consoleErrors.join('\n'))}`);
  process.exit(1);
}

console.log(`ok ${id}`);
