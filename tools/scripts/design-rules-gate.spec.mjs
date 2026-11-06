import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { baselinedLines, checkStagedUncompared, failingProductsOf, productsToCheck } from './design-rules-gate.mjs';

const config = {
  products: {
    sdk: { harness: { app: 'apps/docs-examples' } },
    studio: { base: '.ethlete/design/sdk', harness: { app: 'apps/ethlete-studio' } },
    lab: {},
  },
};

test('checks the product whose harness app changes', () => {
  assert.deepEqual(productsToCheck(config, ['apps/ethlete-studio/src/app/x.component.ts']), ['studio']);
});

test('checks a product and the products built on it when its design changes', () => {
  assert.deepEqual(productsToCheck(config, ['.ethlete/design/sdk/components/button/button.ts']), ['sdk', 'studio']);
  assert.deepEqual(productsToCheck(config, ['.ethlete/design/lab/pages/home/home.ts']), ['lab']);
});

test('checks every product when the design rules or the config change', () => {
  assert.deepEqual(productsToCheck(config, ['libs/cli/src/lib/design/serve.ts']), ['sdk', 'studio', 'lab']);
  assert.deepEqual(productsToCheck(config, ['.ethlete/design/config.json']), ['sdk', 'studio', 'lab']);
});

test('checks nothing for a range outside every product', () => {
  assert.deepEqual(productsToCheck(config, ['apps/ethlete-studio-e2e/x.ts', 'libs/components/src/a.ts']), []);
  assert.deepEqual(productsToCheck(undefined, ['apps/ethlete-studio/x.ts']), []);
});

test('keeps the baseline lines of a passing check from either stream', () => {
  const result = {
    stdout: 'checked 12 parts\nbaselined (ADR 0205): pages/system - finding 495\n',
    stderr: 'baselined (ADR 0205): pages/sketches - finding 495\n',
  };

  assert.deepEqual(baselinedLines(result), [
    'baselined (ADR 0205): pages/system - finding 495',
    'baselined (ADR 0205): pages/sketches - finding 495',
  ]);
  assert.deepEqual(baselinedLines({ stdout: 'ok\n' }), []);
});

test('names only the products with problems, not a clean product checked next to them', () => {
  const products = ['studio-lab', 'sdk', 'studio'];

  assert.deepEqual(failingProductsOf({ stdout: 'baselined (ADR 0205): x\n27 problem(s) in studio.\n' }, products), [
    'studio',
  ]);
  assert.deepEqual(failingProductsOf({ stdout: '3 problem(s) in sdk, studio.\n' }, products), ['sdk', 'studio']);
  assert.deepEqual(failingProductsOf({ stdout: '' }, products), products);
});

const CHIP = 'apps/a/chip/chip.component';

const stagedFixture = () => {
  const root = mkdtempSync(join(tmpdir(), 'design-rules-staged-'));
  const write = (path, source) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), source);
  };
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });

  write('.ethlete/design/config.json', JSON.stringify({ products: { 'app-a': { harness: { app: 'apps/a' } } } }));
  write(
    '.ethlete/design/app-a/components/chip/chip.ts',
    `export default definePart({ implements: '${CHIP}.ts', states: { default: {} } });\n`,
  );
  write(
    `${CHIP}.ts`,
    "@Component({ templateUrl: './chip.component.html', styleUrl: './chip.component.css' })\nexport class ChipComponent {}\n",
  );
  write(`${CHIP}.html`, '<span></span>\n');
  write(`${CHIP}.css`, 'span {}\n');
  write('apps/a/other.ts', 'export const other = 1;\n');
  write('tsconfig.base.json', '{}\n');

  const hash = (path) =>
    createHash('sha256')
      .update(readFileSync(join(root, path)))
      .digest('hex')
      .slice(0, 16);
  const app = Object.fromEntries(['css', 'html', 'ts'].map((ext) => [`${CHIP}.${ext}`, hash(`${CHIP}.${ext}`)]));

  write(
    '.ethlete/design/app-a/implemented.json',
    JSON.stringify({ 'components/chip': { hash: 'h', at: '2026-11-01T00:00:00.000Z', states: { default: 'd' }, app } }),
  );
  git('init', '-q');
  git('add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'x');

  return { root, write, git };
};

const refusalOf = async (root) => {
  const errors = [];
  const { error, log } = console;
  console.error = (line) => errors.push(String(line));
  console.log = () => undefined;

  try {
    return { status: await checkStagedUncompared(root, { invocation: 'et design' }), errors: errors.join('\n') };
  } finally {
    Object.assign(console, { error, log });
  }
};

test('refuses a staged app file of an implemented part with the compare and verify commands', async () => {
  const { root, write, git } = stagedFixture();

  write(`${CHIP}.html`, '<span><b></b></span>\n');
  write(`${CHIP}.css`, 'span { color: red; }\n');
  git('add', `${CHIP}.html`);

  assert.deepEqual(await refusalOf(root), {
    status: 1,
    errors: [
      'A commit that changes UI in apps/a needs a green design compare (ADR 0011).',
      `IMPLEMENTATION-UNCOMPARED ${CHIP}.html: changed since components/chip was recorded as implemented (2026-11-01T00:00:00.000Z) - run et design compare components/chip --product app-a, then et design task components/chip --product app-a --verify <rev> to record it`,
    ].join('\n'),
  });
});

test('passes a commit that stages no app file an implemented part reaches', async () => {
  const { root, write, git } = stagedFixture();

  write(`${CHIP}.html`, '<span><b></b></span>\n');
  write('apps/a/other.ts', 'export const other = 2;\n');
  git('add', 'apps/a/other.ts');

  assert.deepEqual(await refusalOf(root), { status: 0, errors: '' });
});
