import { describe, expect, it } from 'vitest';
import { ResolvedProduct } from '../resolve-product';
import { logoPartsWithoutSectionsOf } from './logo-sections';

const productOf = (layer: string, name: string, states: string[]) =>
  ({
    parts: [
      {
        layer,
        name,
        file: `/p/${layer}/${name}.ts`,
        origin: 'product',
        source: `import { definePart } from '@design-system';\nexport default definePart({ note: '', states: { ${states.map((state) => `'${state}': {}`).join(', ')} }, render: () => null });\n`,
      },
    ],
  }) as unknown as ResolvedProduct;

describe('logoPartsWithoutSectionsOf (B677)', () => {
  it('reports each missing section of a merged logo part', () => {
    const problems = logoPartsWithoutSectionsOf(productOf('foundations', 'logo', ['sizes', 'anatomy', 'motion']));

    expect(problems.map((problem) => problem.message)).toEqual([
      expect.stringContaining('"clear-space"'),
      expect.stringContaining('"minimum-size"'),
      expect.stringContaining('"colour-variants"'),
      expect.stringContaining('"misuse"'),
    ]);
    expect(problems[0]).toMatchObject({ rule: 'LOGO-SECTION', file: '/p/foundations/logo.ts' });
  });

  it('passes a logo part with all six sections and ignores other parts', () => {
    const all = ['anatomy', 'clear-space', 'minimum-size', 'colour-variants', 'misuse', 'motion'];

    expect(logoPartsWithoutSectionsOf(productOf('foundations', 'logo', all))).toEqual([]);
    expect(logoPartsWithoutSectionsOf(productOf('elements', 'logo', ['rest']))).toEqual([]);
  });
});
