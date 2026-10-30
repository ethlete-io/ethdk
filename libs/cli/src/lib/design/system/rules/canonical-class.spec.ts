import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { ruleProblemsOf } from '../check-system';
import { resolveProduct } from '../resolve-product';
import { canonicalClassesOf } from './canonical-class';

const write = (target: string, path: string, content: string) => {
  mkdirSync(dirname(join(target, DESIGN_DIR, path)), { recursive: true });
  writeFileSync(join(target, DESIGN_DIR, path), content);
};

const acme = (stylesheet: string) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-system-'));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });

  const config = readConfig(target) ?? {};

  write(
    target,
    'config.json',
    JSON.stringify({
      ...config,
      products: {
        ...config.products,
        acme: { ...config.products?.['acme'], styles: [`${DESIGN_DIR}/acme/styles.css`] },
      },
    }),
  );
  write(
    target,
    'acme/styles.css',
    `@import ${JSON.stringify(require.resolve('tailwindcss/index.css'))};\n${stylesheet}`,
  );

  return target;
};

const part = (markup: string) =>
  `import { definePart } from '@design-system';\nexport default definePart({ note: '', states: {}, render: () => ({ body: \`${markup}\`, styles: '' }) });\n`;

const messagesOf = (target: string) =>
  canonicalClassesOf(
    resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} }),
  ).map((problem) => `${problem.file.split('/').pop()}: ${problem.message}`);

describe('canonicalClassesOf', () => {
  it('flags a class with a canonical form in the markup of a part and of a file below it', () => {
    const target = acme('');

    write(target, 'acme/pages/home/home.ts', part('<div class="flex w-[420px] hover:mt-[16px]"></div>'));
    write(target, 'acme/pages/home/shared/row.ts', `export const row = 'grid-cols-[repeat(3,minmax(0,1fr))]';\n`);

    expect(messagesOf(target)).toEqual([
      'home.ts: The class `w-[420px]` can be written as `w-105`',
      'home.ts: The class `hover:mt-[16px]` can be written as `hover:mt-4`',
      'row.ts: The class `grid-cols-[repeat(3,minmax(0,1fr))]` can be written as `grid-cols-3`',
    ]);
  });

  it("flags a class in a file of the product's or the sketch's shared folder that a part imports", () => {
    const target = acme('');
    const sketchShared = join(target, DESIGN_DIR, 'acme/sketches/pages-home/shared');

    write(
      target,
      'acme/pages/home/home.ts',
      `import { row } from '@shared/row';\nimport { cell } from '@shared/cell';\n${part('<div></div>')}`,
    );
    write(target, 'acme/shared/row.ts', `export const row = 'w-[420px]';\n`);
    write(target, 'acme/shared/loose.ts', `export const loose = 'w-[420px]';\n`);
    write(target, 'acme/sketches/pages-home/shared/cell.ts', `export const cell = 'mt-[16px]';\n`);

    expect(
      canonicalClassesOf({
        ...resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} }),
        sharedDir: sketchShared,
      }).map((problem) => `${problem.file.split('/').pop()}: ${problem.message}`),
    ).toEqual([
      'row.ts: The class `w-[420px]` can be written as `w-105`',
      'cell.ts: The class `mt-[16px]` can be written as `mt-4`',
    ]);
  });

  it('runs as part of design check', () => {
    const target = acme('');

    write(target, 'acme/pages/home/home.ts', part('<div class="w-[420px]"></div>'));

    expect(
      ruleProblemsOf(
        resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} }),
      ).filter((problem) => problem.rule === 'CANONICAL-CLASS').length,
    ).toBe(1);
  });

  it('takes the rem base from the root font size of the product stylesheets', () => {
    const target = acme('html { font-size: 62.5%; }\n');

    write(target, 'acme/pages/home/home.ts', part('<div class="w-[420px]"></div>'));

    expect(messagesOf(target)).toEqual(['home.ts: The class `w-[420px]` can be written as `w-2xl`']);
  });

  it('passes canonical classes', () => {
    const target = acme('');

    write(target, 'acme/pages/home/home.ts', part('<div class="flex w-105 hover:mt-4 grid-cols-3 acme-home"></div>'));

    expect(messagesOf(target)).toEqual([]);
  });
});
