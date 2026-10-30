import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, relative } from 'path';
import { describe, expect, it } from 'vitest';
import { carryShared, productSharedChangesOf, sharedPlanOf } from './merge-shared';
import { Sketch } from './sketch';

type Part = { layer: string; name: string; file: string };
type Plan = Exclude<ReturnType<typeof sharedPlanOf>, string>;

const write = (file: string, source: string) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, source);
};

const twoTargets = () => {
  const root = mkdtempSync(join(tmpdir(), 'cli-design-merge-shared-'));
  const sketch = { dir: join(root, 'sketch'), targets: ['components/pin', 'pages/flows'] } as Sketch;
  const product = { dir: join(root, 'product'), base: null, parts: [] as Part[] };
  const partOf = (layer: string, name: string, source: string) => {
    const file = join(sketch.dir, 'a', layer, name, `${name}.ts`);

    write(file, source);

    return { layer, name, file };
  };
  const parts = [
    partOf('components', 'pin', "import { pin } from '@shared/pin';\n"),
    partOf('pages', 'flows', "import { flow } from '@shared/flow';\n"),
  ];

  write(join(sketch.dir, 'shared/pin.ts'), "export { dot as pin } from './dot';\n");
  write(join(sketch.dir, 'shared/dot.ts'), 'export const dot = 1;\n');
  write(join(sketch.dir, 'shared/flow.ts'), 'export const flow = 1;\n');

  return { root, sketch, product, parts };
};

describe('sharedPlanOf', () => {
  it('gives each target only the shared/ files it reaches through its imports', () => {
    const { sketch, product, parts } = twoTargets();
    const plan = sharedPlanOf({ sketch, variant: 'a', parts, product });

    expect(plan).toEqual({
      carry: [
        { targetDir: join(product.dir, 'components/pin'), paths: ['dot.ts', 'pin.ts'] },
        { targetDir: join(product.dir, 'pages/flows'), paths: ['flow.ts'] },
      ],
    });

    for (const { targetDir, paths } of (plan as Plan).carry) {
      cpSync(join(sketch.dir, 'a', relative(product.dir, targetDir)), targetDir, { recursive: true });
      carryShared({ sketch, variant: 'a', targetDir, paths, product });
    }

    expect(readdirSync(join(product.dir, 'pages/flows/shared'))).toEqual(['flow.ts']);
    expect(readFileSync(join(product.dir, 'components/pin/shared/pin.ts'), 'utf8')).toContain("from './dot'");
  });

  it('gives a file nobody imports back to the target whose shared/ held it in the product, and refuses one held by none', () => {
    const { sketch, product, parts } = twoTargets();
    const flows = join(product.dir, 'pages/flows/flows.ts');

    write(join(sketch.dir, 'shared/old.ts'), 'export const old = 1;\n');

    expect(sharedPlanOf({ sketch, variant: 'a', parts, product })).toContain('shared/old.ts is imported by no target');

    write(flows, '');
    write(join(product.dir, 'pages/flows/shared/old.ts'), 'export const old = 1;\n');
    product.parts.push({ layer: 'pages', name: 'flows', file: flows });

    expect(sharedPlanOf({ sketch, variant: 'a', parts, product })).toEqual({
      carry: [
        { targetDir: join(product.dir, 'components/pin'), paths: ['dot.ts', 'pin.ts'] },
        { targetDir: join(product.dir, 'pages/flows'), paths: ['flow.ts', 'old.ts'] },
      ],
    });
  });

  it("still gives a one-target sketch every shared/ file, the variant's own winning", () => {
    const root = mkdtempSync(join(tmpdir(), 'cli-design-merge-shared-'));
    const sketch = { dir: join(root, 'sketch'), targets: ['elements/part'] } as Sketch;
    const product = { dir: join(root, 'product'), base: null, parts: [] };
    const file = join(sketch.dir, 'b/elements/part/part.ts');
    const targetDir = join(product.dir, 'elements/part');

    write(file, "import { pin } from '@shared/pin';\n");
    write(join(sketch.dir, 'shared/pin.ts'), 'export const pin = "sketch";\n');
    write(join(sketch.dir, 'shared/list.ts'), 'export const list = 1;\n');
    write(join(sketch.dir, 'b/shared/pin.ts'), 'export const pin = "b";\n');

    const plan = sharedPlanOf({ sketch, variant: 'b', parts: [{ layer: 'elements', name: 'part', file }], product });

    expect(plan).toEqual({ carry: [{ targetDir, paths: ['list.ts', 'pin.ts'] }] });

    cpSync(dirname(file), targetDir, { recursive: true });
    carryShared({ sketch, variant: 'b', targetDir, paths: ['list.ts', 'pin.ts'], product });

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

    carryShared({ sketch, variant: 'a', targetDir, paths: ['pin.ts'], product });

    expect(existsSync(join(targetDir, 'shared/sheet.ts'))).toBe(false);
    expect(readFileSync(join(targetDir, 'part.ts'), 'utf8')).toBe(
      "import { sheet } from '@shared/sheet';\nimport { pin } from './shared/pin';\n",
    );
  });
});
