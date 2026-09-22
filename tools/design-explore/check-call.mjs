/**
 * Find out why a call does not render, in the cheapest order.
 *
 * A compile error draws an overlay on top of the drawing, so a screenshot of it looks like
 * a design. Run this first, and never screenshot before it says `ok`.
 *
 * Run it from the repository root, so Node resolves `playwright` from there:
 *
 *   node tools/design-explore/check-call.mjs --lint <file>…                     # ~1s
 *   node tools/design-explore/check-call.mjs --tsconfig tools/design-explore/tsconfig.json
 *   node tools/design-explore/check-call.mjs --call timetrack/kerbe/03-narrow-lane        # + the render
 *   node tools/design-explore/check-call.mjs --call timetrack/kerbe/03-narrow-lane --option b
 *   DE_URL=http://localhost:4402 node tools/design-explore/check-call.mjs --call <slug>
 *
 * Three stages, because they cost three different amounts:
 *
 * 1. `eslint` on the files you changed, about a second. Name the files - never a whole
 *    project, which is far slower and can fight the user's own editor.
 * 2. `tsc --noEmit` reads the source. It needs no dev server, waits for no rebuild, and
 *    catches every syntax and type error in a few seconds. Almost everything you break is
 *    caught here.
 * 3. The browser catches what the source cannot: an Angular template error, a runtime
 *    throw, an option key that no call declares. It costs a browser launch, and it can only
 *    see a build the dev server has already finished, so a fresh edit needs a second first.
 *
 * The Angular plugin transpiles without type checking, so stage 3 alone renders a file that
 * does not compile. That is why stage 2 exists.
 */
import { execFileSync } from 'node:child_process';

const BASE = process.env.DE_URL ?? 'http://localhost:4402';

/**
 * The type checker to run. `tsc` resolves the one the repository installed. Set
 * `TSC=@typescript/native-preview` for the Go port, which is about a third faster - but it
 * rejects a `baseUrl` in the config, so a repository that still uses one cannot run it.
 */
const TSC = process.env.TSC ?? null;

const flags = { '--lint': [], '--tsconfig': [], '--call': [], '--option': [] };
let current = null;

for (const arg of process.argv.slice(2)) {
  if (arg in flags) current = arg;
  else if (current) flags[current].push(arg);
}

const lintFiles = flags['--lint'];
const [tsconfig] = flags['--tsconfig'];
const [slug] = flags['--call'];
const [wanted] = flags['--option'];

if (lintFiles.length === 0 && !tsconfig && !slug) {
  console.error(
    'usage: node tools/design-explore/check-call.mjs [--lint <file>…] [--tsconfig <path>] [--call <slug> [--option <key>]]',
  );
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

if (!slug) {
  console.log('ok');
  process.exit(0);
}

const { chromium } = await import('playwright');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

/** Angular throws at render time, and the overlay never shows those, so read the console too. */
const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push(e.message));

const fail = async (message) => {
  await browser.close();
  console.error(message);
  process.exit(1);
};

/** The rounds view folds a settled round away, so only the contact sheet holds every option. */
await page.goto(`${BASE}/?call=${encodeURIComponent(slug)}&view=sheet`, { waitUntil: 'domcontentloaded' });

const onPage = await page
  .locator('nav a[aria-current]')
  .first()
  .waitFor({ timeout: 15000 })
  .then(
    () => true,
    () => false,
  );

if (!onPage)
  await fail(`NO CALL "${slug}" - the host drew no page for it. Check the folder under .ethlete/design/calls.`);

/** An unknown slug falls back to the first call, so read back which one the host actually drew. */
const drawn = await page
  .locator('nav a[aria-current="page"]')
  .first()
  .getAttribute('href')
  .then((href) => new URL(href ?? '', BASE).searchParams.get('call'));

if (drawn !== slug) {
  await fail(
    `NO CALL "${slug}" - the host fell back to "${drawn}". Pass the full slug, for example timetrack/kerbe/${slug}.`,
  );
}

const problems = await page.locator('.problem').allInnerTexts();
if (problems.length > 0) await fail(`BAD CALL ${slug}\n${problems.join('\n')}`);

const keys = await page.locator('iframe[data-option]').evaluateAll((frames) => frames.map((f) => f.dataset.option));
const checked = wanted ? keys.filter((key) => key === wanted) : keys;

if (checked.length === 0) {
  await fail(`NO OPTION "${wanted}" on ${slug} - it declares ${keys.length > 0 ? keys.join(', ') : 'none'}.`);
}

for (const key of checked) {
  /** A frame reloads on every edit, which detaches a `page.frames()` handle, so locate it each time. */
  const frame = page.frameLocator(`iframe[data-option="${key}"]`);

  const drawn = await frame
    .locator('#root > *')
    .first()
    .waitFor({ timeout: 15000 })
    .then(
      () => true,
      () => false,
    );

  const overlay = frame.locator('vite-error-overlay');
  if ((await overlay.count()) > 0) {
    const text = await overlay
      .locator('.message-body')
      .innerText()
      .catch(() => '(overlay present, text unreadable)');
    await fail(`COMPILE ERROR on ${slug} option ${key}\n${trim(text)}`);
  }

  if (!drawn) {
    await fail(
      `EMPTY on ${slug} option ${key} - #root never got a child.\n` +
        `An empty module with a 200 response means the tsconfig turned emit off.\n` +
        (consoleErrors.length > 0 ? trim(consoleErrors.join('\n')) : ''),
    );
  }

  const text = await frame.locator('#root').innerText();
  if (text.startsWith('design-explore:')) await fail(`FRAME REFUSED on ${slug} option ${key}\n${text}`);
}

await browser.close();

if (consoleErrors.length > 0) {
  console.error(`RENDERED WITH ERRORS on ${slug}\n${trim(consoleErrors.join('\n'))}`);
  process.exit(1);
}

console.log(`ok ${slug} (${checked.join(', ')})`);
