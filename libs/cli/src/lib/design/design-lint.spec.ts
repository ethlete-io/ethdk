import { spawnSync } from 'child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readConfig } from './design-config';
import {
  changedLintFilesOf,
  LINT_BASELINE_FILE,
  lintGateLinesOf,
  lintKeyOf,
  readLintBaseline,
  variantLintFilesOf,
} from './design-lint';
import { originOf } from './system/write-origin';
import { resolveProduct } from './system/resolve-product';
import { mergeSketch } from './system/sketch/merge';
import { createSketch, decideSketch, markSketchReady, Sketch, variantDirOf } from './system/sketch/sketch';

const BANG = "const plus = ICONS.find((each) => each === 'et-plus')!;\n";
const FAILED = "const plus = ICONS.find((each) => each === 'et-plus') ?? fail('no et-plus');\n";
const PRELUDE =
  "const ICONS = ['et-plus'];\nconst fail = (message: string): never => {\n  throw new Error(message);\n};\n";

const eslintConfig = () => {
  const tseslint = pathToFileURL(require.resolve('typescript-eslint')).href;

  return [
    `import tseslint from '${tseslint}';`,
    '',
    'export default [',
    '  {',
    "    files: ['**/*.ts'],",
    '    languageOptions: { parser: tseslint.parser },',
    "    plugins: { '@typescript-eslint': tseslint.plugin },",
    "    rules: { '@typescript-eslint/no-non-null-assertion': 'warn' },",
    '  },',
    '];',
    '',
  ].join('\n');
};

const git = (target: string, ...args: string[]) =>
  spawnSync('git', ['-c', 'user.name=spec', '-c', 'user.email=spec@example.com', ...args], {
    cwd: target,
    encoding: 'utf8',
  });

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-lint-'));

  cpSync(join(__dirname, 'system', '__fixtures__'), target, { recursive: true });
  writeFileSync(join(target, '.prettierrc'), '{ "singleQuote": true }');
  writeFileSync(join(target, 'eslint.config.mjs'), eslintConfig());
  git(target, 'init', '-q');
  git(target, 'add', '-A');
  git(target, 'commit', '-qm', 'acme');

  return target;
};

const acmeProduct = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const heroFile = (dir: string) => join(dir, 'elements', 'hero', 'icon.ts');

const heroSketch = (target: string) => {
  const product = acmeProduct(target);
  const sketch = createSketch({ product, sketch: { layer: 'elements', name: 'hero' }, variants: ['a', 'b'] }) as Sketch;

  return { product, sketch };
};

const gateOf = (target: string, sketch: Sketch, variants = sketch.variants) =>
  lintGateLinesOf({ target, productDir: acmeProduct(target).dir, files: variantLintFilesOf(sketch, variants) });

describe('the design lint gate', { timeout: 60_000 }, () => {
  afterEach(() => vi.restoreAllMocks());

  it('fails a sketch variant with a non-null assertion and passes it with ?? fail()', () => {
    const target = acme();
    const { sketch } = heroSketch(target);

    writeFileSync(heroFile(variantDirOf(sketch, 'a')), PRELUDE + BANG);
    writeFileSync(heroFile(variantDirOf(sketch, 'b')), PRELUDE + FAILED);

    const lines = gateOf(target, sketch);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(
      /^LINT .*sketches\/elements-hero\/a\/elements\/hero\/icon\.ts:5:\d+ @typescript-eslint\/no-non-null-assertion/u,
    );

    writeFileSync(heroFile(variantDirOf(sketch, 'a')), PRELUDE + FAILED);

    expect(gateOf(target, sketch)).toEqual([]);
  });

  it('lets a variant keep the old findings of its part the baseline holds, not one more', () => {
    const target = acme();
    const { product, sketch } = heroSketch(target);

    writeFileSync(
      join(product.dir, LINT_BASELINE_FILE),
      JSON.stringify({ 'elements/hero/icon.ts': { '@typescript-eslint/no-non-null-assertion': 1 } }),
    );
    writeFileSync(heroFile(variantDirOf(sketch, 'a')), PRELUDE + BANG);

    expect(gateOf(target, sketch, ['a'])).toEqual([]);

    writeFileSync(heroFile(variantDirOf(sketch, 'a')), PRELUDE + BANG + BANG.replace('plus', 'again'));

    expect(gateOf(target, sketch, ['a'])).toEqual([
      expect.stringMatching(/:5:\d+ .*the baseline allows 1\)$/u),
      expect.stringMatching(/:6:\d+ .*the baseline allows 1\)$/u),
    ]);
  });

  it('shrinks the baseline to what fires now and refuses one grown after its first commit', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = acme();
    const product = acmeProduct(target);
    const part = heroFile(product.dir);
    const baselineFile = join(product.dir, LINT_BASELINE_FILE);
    const rule = '@typescript-eslint/no-non-null-assertion';

    writeFileSync(part, PRELUDE + BANG + BANG.replace('plus', 'again'));
    writeFileSync(baselineFile, JSON.stringify({ 'elements/hero/icon.ts': { [rule]: 2 } }));
    git(target, 'add', '-A');
    git(target, 'commit', '-qm', 'baseline');

    writeFileSync(part, PRELUDE + BANG);

    expect(lintGateLinesOf({ target, productDir: product.dir, files: [part], shrink: true })).toEqual([]);
    expect(readLintBaseline(product.dir)).toEqual({ 'elements/hero/icon.ts': { [rule]: 1 } });

    git(target, 'commit', '-qam', 'shrink');
    writeFileSync(baselineFile, JSON.stringify({ 'elements/hero/icon.ts': { [rule]: 2 } }));

    expect(lintGateLinesOf({ target, productDir: product.dir, files: [part] })).toEqual([
      expect.stringMatching(/^LINT-BASELINE lint-baseline\.json: elements\/hero\/icon\.ts .* grew/u),
    ]);
  });

  it('lists only the part and variant files that differ from HEAD', () => {
    const target = acme();
    const { product, sketch } = heroSketch(target);

    writeFileSync(
      join(product.dir, 'elements', 'hero', 'hero.ts'),
      `${readFileSync(join(product.dir, 'elements', 'hero', 'hero.ts'), 'utf8')}\n`,
    );
    mkdirSync(join(product.dir, 'elements', 'other'), { recursive: true });
    writeFileSync(join(product.dir, 'elements', 'other', 'other.ts'), 'export const other = 1;\n');

    const keys = (part?: string) =>
      changedLintFilesOf({ target, productDir: product.dir, part })
        .map((file) => lintKeyOf(product.dir, file))
        .sort();

    expect(keys('elements/hero')).toEqual(['elements/hero/hero.ts', 'elements/hero/hero.ts', 'elements/hero/hero.ts']);
    expect(keys()).toContain('elements/other/other.ts');
    expect(variantLintFilesOf(sketch, ['a']).map((file) => lintKeyOf(product.dir, file))).toEqual([
      'elements/hero/hero.ts',
    ]);
  });

  it('refuses to merge a picked variant with a new warning', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = acme();
    const { product, sketch } = heroSketch(target);

    writeFileSync(heroFile(variantDirOf(sketch, 'b')), PRELUDE + BANG);

    const ready = markSketchReady({ checkout: target, sketch }) as Sketch;
    const picked = decideSketch({
      sketch: ready,
      decision: { kind: 'pick', variant: 'b', ...originOf('spec') },
    }) as Sketch;
    const result = mergeSketch({ target, config: readConfig(target) ?? {}, product, sketch: picked });

    expect(Array.isArray(result) ? result : result.reason).toMatch(
      /no-non-null-assertion[^\n]*\nelements\/hero variant b adds lint warnings - fix them before a merge$/u,
    );
  });
});
