import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../../design-config';
import { initGitRepo } from '../git-repo.fixtures';
import { importProblemsOf } from '../imports';
import { partKeyOf, resolveProduct } from '../resolve-product';
import { openEditSketch } from './edit-sketch';
import { recordMerged } from './merged-parts';
import { overlaySketch } from './overlay';
import { Sketch } from './sketch';

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
});
