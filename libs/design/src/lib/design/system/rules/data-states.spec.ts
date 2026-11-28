import { describe, expect, it } from 'vitest';
import { ResolvedProduct } from '../resolve-product';
import { listPartsWithoutDataStatesOf } from './data-states';

const productOf = (...sources: string[]) =>
  ({
    parts: sources.map((source, index) => ({ file: `/p/part-${index}.ts`, origin: 'product', source })),
  }) as unknown as ResolvedProduct;

const part = (fields: string) =>
  `import { definePart } from '@design-system';\nexport default definePart({ note: '',${fields} states: { rest: {} }, render: () => null });\n`;

describe('listPartsWithoutDataStatesOf (B251)', () => {
  it('rejects a list part without a full literal dataStates map', () => {
    expect(
      listPartsWithoutDataStatesOf(
        productOf(part(" data: 'list',"), part(" data: 'list', dataStates: { loading: 'rest', error: 'rest' },")),
      ),
    ).toEqual([
      expect.objectContaining({ rule: 'DATA-STATES', file: '/p/part-0.ts' }),
      expect.objectContaining({ rule: 'DATA-STATES', file: '/p/part-1.ts' }),
    ]);
  });

  it('passes a list part with the map and a part without data', () => {
    expect(
      listPartsWithoutDataStatesOf(
        productOf(
          part(" data: 'list', dataStates: { loading: 'rest', error: 'failed', empty: 'none' },"),
          part(''),
          part(" dataStates: { loading: 'rest', error: 'failed', empty: 'none' },"),
        ),
      ),
    ).toEqual([]);
  });
});
