import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { writeCallsTsconfig } from './calls-tsconfig';
import { DEFAULT_PORT, portOf, readConfig } from './paths';

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

const runBrowser = async (options: { base: string; slug: string; wanted?: string }): Promise<number> => {
  const { base, slug, wanted } = options;
  const playwright = await import('playwright').catch(() => null);

  if (!playwright) {
    console.error(
      'NO BROWSER - neither the checkout nor this package resolves playwright, so the render stage cannot run.',
    );

    return 1;
  }

  const browser = await playwright.chromium.launch();

  try {
    return await checkPage({
      page: await browser.newPage({ viewport: { width: 1600, height: 1000 } }),
      base,
      slug,
      wanted,
    });
  } finally {
    await browser.close();
  }
};

type Declared = null | { error: string } | { rounds: string[]; variants: { key: string; round: string }[] };

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
      rounds: (call.rounds ?? []).map((round) => round.key),
      variants: call.variants.map((variant) => ({ key: variant.key, round: variant.round ?? '' })),
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
  base: string;
  slug: string;
  wanted?: string;
}): Promise<number> => {
  const { page, base, slug, wanted } = options;

  /** Angular throws at render time, and the overlay never shows those, so read the console too. */
  const consoleErrors: string[] = [];
  page.on('console', (message) => message.type() === 'error' && consoleErrors.push(message.text()));
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  const fail = (message: string) => {
    console.error(message);

    return 1;
  };

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

  if (consoleErrors.length > 0) {
    console.error(`RENDERED WITH ERRORS on ${slug}\n${trim(consoleErrors.join('\n'))}`);

    return 1;
  }

  console.log(`ok ${slug} (${checked.join(', ')})`);

  return 0;
};

/**
 * Finds out why a call does not render, in the cheapest order: eslint on the named files, then
 * `tsc --noEmit` over the checkout's calls, then the live page in a headless browser. A compile
 * error draws an overlay on top of the drawing, so a screenshot of one looks like a design -
 * never screenshot before this says `ok`.
 */
export const checkDesign = async (options: { target: string; argv: string[]; invocation: string }): Promise<number> => {
  const { target, argv, invocation } = options;
  const flags = parse(argv, ['--lint', '--tsconfig', '--call', '--variant']);

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

    if (!eslint) {
      console.error(`NO LINTER - ${target} installs no eslint, so --lint has nothing to run.`);

      return 1;
    }

    try {
      execFileSync(process.execPath, [eslint, ...lintFiles], { cwd: target, encoding: 'utf8', stdio: 'pipe' });
    } catch (error) {
      console.error(`LINT\n${outputOf(error)}`);

      return 1;
    }
  }

  if (tsconfig) {
    /**
     * `TSC=@typescript/native-preview` runs the Go port, which is about a third faster - but it
     * rejects a `baseUrl` in the config, so a repository that still uses one cannot run it.
     */
    const native = process.env['TSC'];
    const tsc = native ? null : binaryOf({ target, pkg: 'typescript', bin: 'tsc' });

    if (!native && !tsc) {
      console.error('NO TYPE CHECKER - neither the checkout nor this package resolves typescript.');

      return 1;
    }

    const command = native
      ? { file: 'npx', args: ['-y', native, '--noEmit', '-p', tsconfig] }
      : { file: process.execPath, args: [tsc as string, '--noEmit', '-p', tsconfig] };

    try {
      execFileSync(command.file, command.args, { cwd: target, encoding: 'utf8', stdio: 'pipe' });
    } catch (error) {
      console.error(`TYPE ERROR\n${outputOf(error)}`);

      return 1;
    }
  }

  if (!slug) {
    console.log('ok');

    return 0;
  }

  const config = readConfig(target);
  const base = process.env['DE_URL'] ?? `http://localhost:${config ? portOf(config) : DEFAULT_PORT}`;

  return runBrowser({ base, slug, wanted });
};
