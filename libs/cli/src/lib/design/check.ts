import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { chromiumOf } from './browser';
import { writeCallsTsconfig } from './calls-tsconfig';
import { DEFAULT_PORT, portOf, readConfig } from './paths';
import { buildStampOf, serverProblemOf } from './stamp';
import { holdStatus, writeStatus } from './status';
import { inventoryWarningOf, systemWarningOf } from './system-use';

/**
 * A tool the checker shells out to, taken from the checkout first and from this package second, so
 * a checkout that keeps design calls need not install anything of its own. The path comes out of
 * the package's own `bin` field, because an `exports` map hides the file from a direct resolve.
 */
const binaryOf = (options: { target: string; pkg: string; bin: string }) => {
  const { target, pkg, bin } = options;

  try {
    const manifest = require.resolve(`${pkg}/package.json`, { paths: [target, __dirname] });
    const declared = (JSON.parse(readFileSync(manifest, 'utf8')) as { bin?: string | Record<string, string> }).bin;
    const path = typeof declared === 'string' ? declared : declared?.[bin];

    return path ? resolve(dirname(manifest), path) : null;
  } catch {
    return null;
  }
};

/** A bundler stack runs to hundreds of frames and says nothing. Keep the message. */
const trim = (text: string) =>
  [...new Set(text.split('\n').filter((line) => !/^\s+at /.test(line) && line.trim() !== ''))].slice(0, 12).join('\n');

const outputOf = (error: unknown) => {
  const shape = error as { stdout?: string; stderr?: string };

  return trim(`${shape.stdout ?? ''}${shape.stderr ?? ''}`);
};

type Flags = Record<string, string[]>;

type Fail = (message: string) => number;

/** A failure of the tool rather than of the call, such as no browser or no server. */
type Fails = { fail: Fail; unavailable: Fail };

const parse = (argv: string[], names: string[]): Flags => {
  const flags: Flags = {};
  let current: string | null = null;

  for (const argument of argv) {
    if (names.includes(argument)) {
      current = argument;
      flags[current] ??= [];
    } else if (current) {
      flags[current]?.push(argument);
    }
  }

  return flags;
};

const NO_BROWSER =
  'NO BROWSER - neither the checkout nor this package resolves playwright or playwright-core, so the ' +
  'render stage cannot run. Install one in the checkout: `npm i -D playwright-core && npx playwright-core install chromium`.';

const runBrowser = async (options: {
  target: string;
  base: string;
  slug: string;
  wanted?: string;
  fails: Fails;
}): Promise<number> => {
  const { target, base, slug, wanted, fails } = options;
  const serverProblem = await serverProblemOf({ base, own: buildStampOf() });

  if (serverProblem) return fails.unavailable(serverProblem);

  const chromium = await chromiumOf(target);

  if (!chromium) return fails.unavailable(NO_BROWSER);

  const browser = await chromium.launch().catch((error: unknown) => {
    fails.unavailable(`${NO_BROWSER}\n${trim(error instanceof Error ? error.message : String(error))}`);

    return null;
  });

  if (!browser) return 1;

  try {
    return await checkPage({
      page: await browser.newPage({ viewport: { width: 1600, height: 1000 } }),
      target,
      base,
      slug,
      wanted,
      fail: fails.fail,
    });
  } finally {
    await browser.close();
  }
};

type Declared =
  | null
  | { error: string }
  | {
      stage: string | null;
      rounds: string[];
      variants: { key: string; round: string }[];
      hasInventory: boolean;
    };

/**
 * Reads a call's declaration through the frame server's registry. A string, not a function: the
 * build would turn a function's dynamic `import()` into a `require()`, which no browser has.
 */
const declaredOf = (slug: string) => `(async (slug) => {
  const { calls } = await import('/@id/__x00__virtual:design-explore');
  if (!calls[slug]) return null;
  try {
    const call = (await calls[slug]()).default;
    return {
      stage: call.stage ?? null,
      rounds: (call.rounds ?? []).map((round) => round.key),
      variants: call.variants.map((variant) => ({ key: variant.key, round: variant.round ?? '' })),
      hasInventory: Boolean(call.inventory),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
})(${JSON.stringify(slug)})`;

/** Prose that no variant claims is stale prose, and it is the one thing the variants cannot show. */
const problemsOf = (declared: { rounds: string[]; variants: { round: string }[] }) => {
  const { rounds } = declared;
  const drawn = new Set(declared.variants.map((variant) => variant.round));

  return [
    ...[...new Set(rounds.filter((key, index) => rounds.indexOf(key) !== index))].map(
      (key) => `design-explore: two rounds share the key "${key}"`,
    ),
    ...rounds.filter((key) => !drawn.has(key)).map((key) => `design-explore: round "${key}" has no variants`),
  ];
};

const checkPage = async (options: {
  page: import('playwright').Page;
  target: string;
  base: string;
  slug: string;
  wanted?: string;
  fail: Fail;
}): Promise<number> => {
  const { page, target, base, slug, wanted, fail } = options;

  /** Angular throws at render time, and the overlay never shows those, so read the console too. */
  const consoleErrors: string[] = [];
  page.on('console', (message) => message.type() === 'error' && consoleErrors.push(message.text()));
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto(`${base}/frame.html`, { waitUntil: 'domcontentloaded' });

  const declared = (await page.evaluate(declaredOf(slug))) as Declared;

  if (declared === null) return fail(`NO CALL "${slug}" - pass the folder's path under .ethlete/design/calls.`);
  if ('error' in declared) return fail(`COMPILE ERROR on ${slug}\n${trim(declared.error)}`);

  const problems = problemsOf(declared);
  if (problems.length > 0) return fail(`BAD CALL ${slug}\n${problems.join('\n')}`);

  const keys = declared.variants.map((variant) => variant.key);
  const checked = wanted ? keys.filter((key) => key === wanted) : keys;

  if (checked.length === 0) {
    return fail(`NO VARIANT "${wanted}" on ${slug} - it declares ${keys.length > 0 ? keys.join(', ') : 'none'}.`);
  }

  for (const key of checked) {
    await page.goto(`${base}/frame.html?call=${encodeURIComponent(slug)}&variant=${encodeURIComponent(key)}`, {
      waitUntil: 'domcontentloaded',
    });

    const drew = await page
      .locator('#root > :not(style)')
      .first()
      .waitFor({ timeout: 15000 })
      .then(
        () => true,
        () => false,
      );

    const overlay = page.locator('vite-error-overlay');
    if ((await overlay.count()) > 0) {
      const text = await overlay
        .locator('.message-body')
        .innerText()
        .catch(() => '(overlay present, text unreadable)');

      return fail(`COMPILE ERROR on ${slug} variant ${key}\n${trim(text)}`);
    }

    if (!drew) {
      return fail(
        `EMPTY on ${slug} variant ${key} - #root never got a child.\n` +
          `An empty module with a 200 response means the tsconfig turned emit off.\n` +
          (consoleErrors.length > 0 ? trim(consoleErrors.join('\n')) : ''),
      );
    }

    const text = await page.locator('#root').innerText();
    if (text.startsWith('design-explore:')) return fail(`FRAME REFUSED on ${slug} variant ${key}\n${text}`);
  }

  if (consoleErrors.length > 0) return fail(`RENDERED WITH ERRORS on ${slug}\n${trim(consoleErrors.join('\n'))}`);

  const warnings = [
    systemWarningOf({ target, slug, stage: declared.stage }),
    inventoryWarningOf({ slug, stage: declared.stage, hasInventory: declared.hasInventory }),
  ];
  for (const warning of warnings) if (warning) console.warn(warning);

  console.log(`ok ${slug} (${checked.join(', ')})`);

  return 0;
};

const runChecks = async (options: {
  target: string;
  flags: Flags;
  invocation: string;
  fails: Fails;
}): Promise<number> => {
  const { target, flags, invocation, fails } = options;
  const { fail, unavailable } = fails;
  const lintFiles = flags['--lint'] ?? [];
  const slug = flags['--call']?.[0];
  const wanted = flags['--variant']?.[0];
  const tsconfig = '--tsconfig' in flags ? (flags['--tsconfig']?.[0] ?? writeCallsTsconfig(target)) : null;

  if (lintFiles.length === 0 && !tsconfig && !slug) {
    console.error(`usage: ${invocation} check [--lint <file>…] [--tsconfig [path]] [--call <slug> [--variant <key>]]`);

    return 2;
  }

  if (lintFiles.length > 0) {
    const eslint = binaryOf({ target, pkg: 'eslint', bin: 'eslint' });

    if (!eslint) return unavailable(`NO LINTER - ${target} installs no eslint, so --lint has nothing to run.`);

    try {
      execFileSync(process.execPath, [eslint, ...lintFiles], { cwd: target, encoding: 'utf8', stdio: 'pipe' });
    } catch (error) {
      return fail(`LINT\n${outputOf(error)}`);
    }
  }

  if (tsconfig) {
    /**
     * `TSC=@typescript/native-preview` runs the Go port, which is about a third faster - but it
     * rejects a `baseUrl` in the config, so a repository that still uses one cannot run it.
     */
    const native = process.env['TSC'];
    const tsc = native ? null : binaryOf({ target, pkg: 'typescript', bin: 'tsc' });

    if (!native && !tsc)
      return unavailable('NO TYPE CHECKER - neither the checkout nor this package resolves typescript.');

    const command = native
      ? { file: 'npx', args: ['-y', native, '--noEmit', '-p', tsconfig] }
      : { file: process.execPath, args: [tsc as string, '--noEmit', '-p', tsconfig] };

    try {
      execFileSync(command.file, command.args, { cwd: target, encoding: 'utf8', stdio: 'pipe' });
    } catch (error) {
      return fail(`TYPE ERROR\n${outputOf(error)}`);
    }
  }

  if (!slug) {
    console.log('ok');

    return 0;
  }

  const config = readConfig(target);
  const base = process.env['DE_URL'] ?? `http://localhost:${config ? portOf(config) : DEFAULT_PORT}`;

  return runBrowser({ target, base, slug, wanted, fails });
};

/**
 * Finds out why a call does not render, in the cheapest order: eslint on the named files, then
 * `tsc --noEmit` over the checkout's calls, then the live page in a headless browser. A compile
 * error draws an overlay on top of the drawing, so a screenshot of one looks like a design -
 * never screenshot before this says `ok`. With `--call`, the call's status follows the check, but
 * a check that cannot run (no browser, no server, a stale server) leaves the status it found.
 */
export const checkDesign = async (options: { target: string; argv: string[]; invocation: string }): Promise<number> => {
  const { target, argv, invocation } = options;
  const flags = parse(argv, ['--lint', '--tsconfig', '--call', '--variant']);
  const slug = flags['--call']?.[0];
  let failure = '';
  let blocked = false;
  const fails: Fails = {
    fail: (message) => {
      console.error(message);
      failure ||= message;

      return 1;
    },
    unavailable: (message) => {
      console.error(message);
      blocked = true;

      return 1;
    },
  };

  if (!slug) return runChecks({ target, flags, invocation, fails });

  const restore = holdStatus({ checkout: target, slug });

  writeStatus({ checkout: target, slug, state: 'checking' });

  try {
    const code = await runChecks({ target, flags, invocation, fails });

    if (blocked) {
      restore();
    } else {
      writeStatus({
        checkout: target,
        slug,
        ...(code === 0 ? { state: 'ready' } : { state: 'failed', message: failure }),
      });
    }

    return code;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (/net::ERR_/.test(message)) {
      restore();
      console.error(`NO SERVER - the page stopped answering: ${trim(message)}`);

      return 1;
    }

    writeStatus({ checkout: target, slug, state: 'failed', message });

    throw error;
  }
};
