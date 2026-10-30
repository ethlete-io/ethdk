import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { carryShared, productSharedChangesOf } from './merge-shared';
import { Sketch } from './sketch';

describe('carryShared', () => {
  it("takes the picked variant's own shared/ file over the sketch's", () => {
    const root = mkdtempSync(join(tmpdir(), 'cli-design-merge-shared-'));
    const sketch = { dir: join(root, 'sketch') } as Sketch;
    const targetDir = join(root, 'part');

    [join(sketch.dir, 'shared'), join(sketch.dir, 'b/shared'), targetDir].forEach((dir) =>
      mkdirSync(dir, { recursive: true }),
    );
    writeFileSync(join(sketch.dir, 'shared/pin.ts'), 'export const pin = "sketch";\n');
    writeFileSync(join(sketch.dir, 'shared/list.ts'), 'export const list = 1;\n');
    writeFileSync(join(sketch.dir, 'b/shared/pin.ts'), 'export const pin = "b";\n');
    writeFileSync(join(targetDir, 'part.ts'), "import { pin } from '@shared/pin';\n");

    carryShared({ sketch, variant: 'b', targetDir, product: { dir: join(root, 'product'), base: null } });

    expect(readFileSync(join(targetDir, 'shared/pin.ts'), 'utf8')).toContain('"b"');
    expect(readFileSync(join(targetDir, 'shared/list.ts'), 'utf8')).toContain('list');
    expect(readFileSync(join(targetDir, 'part.ts'), 'utf8')).toContain("'./shared/pin'");
  });

  it("leaves a file the product's shared/ holds to the product, and its @shared/ import as it is", () => {
    const root = mkdtempSync(join(tmpdir(), 'cli-design-merge-shared-'));
    const sketch = { dir: join(root, 'sketch') } as Sketch;
    const product = { dir: join(root, 'product'), base: null };
    const targetDir = join(root, 'part');

    [join(sketch.dir, 'shared'), join(product.dir, 'shared'), targetDir].forEach((dir) =>
      mkdirSync(dir, { recursive: true }),
    );
    writeFileSync(join(product.dir, 'shared/sheet.ts'), 'export const sheet = "product";\n');
    writeFileSync(join(sketch.dir, 'shared/sheet.ts'), 'export const sheet = "sketch";\n');
    writeFileSync(join(sketch.dir, 'shared/pin.ts'), 'export const pin = 1;\n');
    writeFileSync(
      join(targetDir, 'part.ts'),
      "import { sheet } from '@shared/sheet';\nimport { pin } from '@shared/pin';\n",
    );

    expect(productSharedChangesOf({ sketch, variant: 'a', product })).toEqual([
      { from: join(sketch.dir, 'shared/sheet.ts'), to: join(product.dir, 'shared/sheet.ts') },
    ]);

    carryShared({ sketch, variant: 'a', targetDir, product });

    expect(existsSync(join(targetDir, 'shared/sheet.ts'))).toBe(false);
    expect(readFileSync(join(targetDir, 'part.ts'), 'utf8')).toBe(
      "import { sheet } from '@shared/sheet';\nimport { pin } from './shared/pin';\n",
    );
  });
});
