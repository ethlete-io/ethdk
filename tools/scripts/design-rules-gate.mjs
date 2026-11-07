import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONFIG = '.ethlete/design/config.json';
const DESIGN_DIR = '.ethlete/design';
const RULES_DIR = 'libs/cli/src/lib/design/';
const CLI = 'dist/libs/cli/src/index.js';

const asDir = (path) => (path.endsWith('/') ? path : `${path}/`);

/** The products whose design, base design or harness app `files` touch; every product when the design rules change. */
export const productsToCheck = (config, files) =>
  Object.entries(config?.products ?? {})
    .filter(([name, entry]) => {
      const dirs = [
        `${DESIGN_DIR}/${name}/`,
        ...(entry.base ? [asDir(entry.base)] : []),
        ...(entry.harness?.app ? [asDir(entry.harness.app)] : []),
        RULES_DIR,
      ];

      return files.some((file) => file === CONFIG || dirs.some((dir) => file.startsWith(dir)));
    })
    .map(([name]) => name);

const run = (root, command, args) =>
  spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, NX_NO_CLOUD: 'true', NX_DAEMON: 'false' },
  });

const report = (result) => {
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
};

/** The baseline entries a passing check printed, so a green push still lists them (ADR 0205). */
export const baselinedLines = (result) =>
  `${result.stdout ?? ''}\n${result.stderr ?? ''}`.split('\n').filter((line) => line.startsWith('baselined ('));

/** The products the summary line of a failed check names; all `products` when the check printed none. */
export const failingProductsOf = (result, products) => {
  const named = /^\d+ problem\(s\) in (.+)\.$/mu.exec(result.stdout ?? '')?.[1];

  return named === undefined ? products : named.split(', ');
};

export const checkDesignRules = (root, base, head) => {
  const configPath = join(root, CONFIG);

  if (!existsSync(configPath)) return 0;

  const changed = run(root, 'git', ['diff', '--name-only', base, head]).stdout.split('\n').filter(Boolean);
  const products = productsToCheck(JSON.parse(readFileSync(configPath, 'utf8')), changed);

  if (products.length === 0) return 0;

  const build = run(root, 'npx', ['nx', 'build', 'cli', '--outputStyle=static']);

  if (build.status !== 0) {
    report(build);
    console.error('design-rules-gate: the cli does not build (above).');

    return 1;
  }

  const check = run(root, 'node', [
    CLI,
    'design',
    'check',
    '--product',
    ...products,
    '--rules',
    '--base',
    `${base}..${head}`,
  ]);

  if (check.status === 0) {
    const baselined = baselinedLines(check);

    if (baselined.length > 0) console.log(baselined.join('\n'));

    return 0;
  }

  report(check);
  console.error(
    `design-rules-gate: design check --rules fails for ${failingProductsOf(check, products).join(', ')} (above).`,
  );

  return 1;
};

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const RULES_SOURCE = 'libs/cli/src/lib/design/system/check-system.ts';

const loadRulesFromSource = async () => {
  const { build } = await import('esbuild');
  const dir = join(REPO, 'tmp', `design-rules-staged-${process.pid}`);
  const outfile = join(dir, 'check-system.cjs');

  try {
    await build({
      entryPoints: [join(REPO, RULES_SOURCE)],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      packages: 'external',
      outfile,
      logLevel: 'error',
    });

    return createRequire(import.meta.url)(outfile);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const stagedFilesOf = (root) =>
  run(root, 'git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR']).stdout.split('\n').filter(Boolean);

const uncomparedMessageOf = (config, found) =>
  found
    .flatMap(({ product, lines, parts = [] }) => [
      `A commit that changes UI in ${config.products?.[product]?.harness?.app ?? product} needs a green design compare (ADR 0011).`,
      ...lines,
      ...(parts.length > 0 ? [`${parts.length} implemented part(s) not compared: ${parts.join(', ')} (ADR 0203)`] : []),
    ])
    .join('\n');

export const checkStagedUncompared = async (root, { files = stagedFilesOf(root), invocation } = {}) => {
  const configPath = join(root, CONFIG);

  if (!existsSync(configPath)) return 0;

  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const products = productsToCheck(config, files);

  if (products.length === 0) return 0;

  const { uncomparedLinesOf } = await loadRulesFromSource();
  const found = uncomparedLinesOf({ target: root, config, products, changed: files, invocation });

  if (found.length === 0) return 0;

  console.error(uncomparedMessageOf(config, found));

  return 1;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const [base, head] = process.argv.slice(2);

  if (base === '--staged') process.exit(await checkStagedUncompared(process.cwd()));

  const code = checkDesignRules(process.cwd(), base, head);
  const flattened = process.cwd().replace(/[^A-Za-z0-9]/gu, '-');
  const receipt = join(tmpdir(), 'ethlete-studio-checks', `${flattened}.push-gate.json`);
  const sha = run(process.cwd(), 'git', ['rev-parse', head ?? 'HEAD']).stdout.trim();

  mkdirSync(dirname(receipt), { recursive: true });
  writeFileSync(receipt, JSON.stringify({ head: sha, ok: code === 0, at: new Date().toISOString() }));
  process.exit(code);
}
