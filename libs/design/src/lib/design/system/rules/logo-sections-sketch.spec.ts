import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR } from '../../design-config';
import { resolveProduct } from '../resolve-product';
import { variantProblemsOf } from '../sketch/check-sketches';
import { listSketches } from '../sketch/sketch';

const FIXTURE = join(__dirname, '__fixtures__/logo-tomflix-1642');

const tomflixWithLogoSketch = (decision?: object) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-logo-sections-'));
  const config = { styles: [], schemes: ['dark'] as 'dark'[], accent: '#e50914' };
  const productDir = join(target, DESIGN_DIR, 'tomflix');
  const sketch = join(productDir, 'sketches/foundations-logo');
  const variant = join(sketch, 'a/foundations/logo');

  mkdirSync(variant, { recursive: true });
  mkdirSync(join(sketch, 'a/assets'), { recursive: true });
  writeFileSync(join(target, DESIGN_DIR, 'config.json'), JSON.stringify({ products: { tomflix: config } }));
  cpSync(join(FIXTURE, 'logo.ts.txt'), join(variant, 'logo.ts'));
  cpSync(join(FIXTURE, 'logo.css'), join(variant, 'logo.css'));
  cpSync(join(FIXTURE, 'logo.svg'), join(sketch, 'a/assets/logo.svg'));
  writeFileSync(
    join(sketch, 'sketch.json'),
    JSON.stringify({
      ...JSON.parse(readFileSync(join(FIXTURE, 'sketch.json'), 'utf8')),
      ...(decision ? { decision } : {}),
    }),
  );

  const product = resolveProduct({ target, name: 'tomflix', config });
  const [loaded] = listSketches({ productDir, product: 'tomflix' });

  if (typeof loaded === 'string' || !loaded) throw new Error('sketch unreadable');

  return { product, sketch: loaded };
};

const logoSectionsOf = (options: ReturnType<typeof tomflixWithLogoSketch>) =>
  variantProblemsOf({ ...options, productProblems: [] })
    .filter(({ variant }) => variant === 'a')
    .flatMap(({ problems }) => problems.filter((problem) => problem.rule === 'LOGO-SECTION'));

describe('the tomflix logo sketch of client run 1642', () => {
  it('is not asked for the six logo sections before the human picks a variant', () => {
    expect(logoSectionsOf(tomflixWithLogoSketch())).toEqual([]);
  });

  it('is asked for them once variant a is picked', () => {
    const picked = tomflixWithLogoSketch({ kind: 'pick', variant: 'a', decidedAt: '2026-11-24T16:00:00.000Z' });

    expect(logoSectionsOf(picked).length).toBeGreaterThan(0);
  });
});
