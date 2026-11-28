import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../../design-config';
import { commitAll, initGitRepo } from '../git-repo.fixtures';
import { importProblemsOf } from '../imports';
import { typecheckVariant } from './check-sketches';
import { partKeyOf, resolveProduct } from '../resolve-product';
import { openEditSketch, refreshEditOld } from './edit-sketch';
import { recordMerged } from './merged-parts';
import { overlaySketch } from './overlay';
import { readSketch, Sketch } from './sketch';

const resolveAppA = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const appA = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-edit-old-base-app-a-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  const product = resolveAppA(target);

  mkdirSync(join(product.dir, 'components', 'chip'), { recursive: true });
  writeFileSync(join(product.dir, 'components', 'chip', 'chip.ts'), "export default 'chip at head';\n");
  writeFileSync(
    join(product.dir, 'elements', 'hero', 'hero.ts'),
    `import chip from '@system/components/chip';\n${readFileSync(join(product.dir, 'elements', 'hero', 'hero.ts'), 'utf8')}`,
  );
  recordMerged({ product, parts: ['elements/hero'] });
  initGitRepo(target, 'base');

  return { target, dir: product.dir };
};

describe('the old side of an edit sketch', () => {
  it('draws the parts it holds no copy of as HEAD held them when the sketch opened, not as later edits left them', async () => {
    const { target, dir } = appA();
    const button = join(dir, 'components', 'button', 'button.ts');
    const headButton = readFileSync(button, 'utf8');

    writeFileSync(join(dir, 'elements', 'hero', 'hero.css'), '.acme-hero { padding: 0; }\n');

    const sketch = (await openEditSketch({ target, product: resolveAppA(target), part: 'elements/hero' })) as Sketch;

    expect(JSON.parse(readFileSync(join(sketch.dir, 'sketch.json'), 'utf8')).editOldCommit).toMatch(/^[0-9a-f]{40}$/u);
    writeFileSync(button, "export default 'button edited later';\n");
    rmSync(join(dir, 'components', 'chip'), { recursive: true });
    mkdirSync(join(dir, 'components', 'badge'), { recursive: true });
    writeFileSync(join(dir, 'components', 'badge', 'badge.ts'), "export default 'badge added later';\n");

    const old = overlaySketch({ product: resolveAppA(target), sketch, variant: 'old' });
    const partOf = (key: string) => old.parts.find((part) => partKeyOf(part) === key);

    expect(partOf('components/button')?.source).toBe(headButton);
    expect(partOf('components/chip')?.source).toBe("export default 'chip at head';\n");
    expect(partOf('components/badge')).toBeUndefined();
    expect(importProblemsOf(old)).toEqual([]);

    const fresh = overlaySketch({ product: resolveAppA(target), sketch, variant: 'new' });

    expect(fresh.parts.find((part) => partKeyOf(part) === 'components/button')?.source).toBe(
      "export default 'button edited later';\n",
    );
  });

  it('reads the files outside the product its old parts import as the old commit held them, not as later edits left them', async () => {
    const target = mkdtempSync(join(tmpdir(), 'cli-design-edit-old-base-outside-'));

    cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

    const configFile = join(target, '.ethlete', 'design', 'config.json');
    const config = JSON.parse(readFileSync(configFile, 'utf8'));

    config.products.acme.harness = { app: 'app', map: 'app/parts.ts', shared: ['app/i18n/**'] };
    writeFileSync(configFile, JSON.stringify(config));

    const product = resolveAppA(target);
    const labels = join(target, 'app', 'i18n', 'labels.ts');
    const partReading = (name: string, key: string) => {
      mkdirSync(join(product.dir, 'components', name), { recursive: true });
      writeFileSync(
        join(product.dir, 'components', name, `${name}.ts`),
        `import { LABELS } from '../../../../../app/i18n/labels';\nexport default LABELS.agent.${key};\n`,
      );
    };

    mkdirSync(join(target, 'app', 'i18n'), { recursive: true });
    writeFileSync(labels, "export const LABELS = { agent: { failed: 'failed', waiting: 'waiting', done: 'done' } };\n");
    partReading('status', 'failed');
    partReading('pill', 'waiting');
    recordMerged({ product, parts: ['elements/hero'] });
    initGitRepo(target, 'base');
    writeFileSync(join(product.dir, 'elements', 'hero', 'hero.css'), '.acme-hero { padding: 0; }\n');

    const sketch = (await openEditSketch({ target, product: resolveAppA(target), part: 'elements/hero' })) as Sketch;

    writeFileSync(labels, "export const LABELS = { agent: { done: 'done' } };\n");
    partReading('status', 'done');

    expect(typecheckVariant({ target, product: resolveAppA(target), sketch, variant: 'old' })).toEqual({ kind: 'ok' });
    expect(importProblemsOf(overlaySketch({ product: resolveAppA(target), sketch, variant: 'old' }))).toEqual([]);
  }, 120_000);

  it('keeps the old side on the commit it was taken from when a check redraws it over a later commit and an uncommitted change', async () => {
    const { target, dir } = appA();
    const css = join(dir, 'elements', 'hero', 'hero.css');
    const ts = join(dir, 'elements', 'hero', 'hero.ts');
    const mergedCss = readFileSync(css, 'utf8');

    writeFileSync(css, '.acme-hero { padding: 0; }\n');

    const sketch = (await openEditSketch({ target, product: resolveAppA(target), part: 'elements/hero' })) as Sketch;
    const sketchFile = join(sketch.dir, 'sketch.json');
    const editOldCommit = JSON.parse(readFileSync(sketchFile, 'utf8')).editOldCommit;

    commitAll(target, 'the edit');
    writeFileSync(ts, `${readFileSync(ts, 'utf8')}export const halfDone = true;\n`);

    const open = readSketch({ product: 'acme', dir: sketch.dir }) as Sketch;

    expect(refreshEditOld({ product: resolveAppA(target), sketch: open })).toBeNull();
    expect(JSON.parse(readFileSync(sketchFile, 'utf8')).editOldCommit).toBe(editOldCommit);
    expect(readFileSync(join(sketch.dir, 'old', 'elements', 'hero', 'hero.css'), 'utf8')).toBe(mergedCss);
  });
});
