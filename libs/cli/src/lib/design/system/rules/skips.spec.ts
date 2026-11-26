import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../design-config';
import { resolveProduct } from '../resolve-product';
import { addedSkipMarksOf, badSkipsOf } from './skips';

const problemsOf = (markup: string, { product = 'acme', part = 'elements/hero' } = {}) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-system-'));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });

  if (product !== 'acme')
    cpSync(join(target, DESIGN_DIR, 'acme'), join(target, DESIGN_DIR, product), { recursive: true });

  const file = join(target, DESIGN_DIR, `${product}/${part}/${part.split('/')[1]}.ts`);

  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(
    file,
    `import { definePart } from '@design-system';\nexport default definePart({ note: '', states: {}, render: () => ({ body: ${JSON.stringify(markup)}, styles: '' }) });\n`,
  );

  return badSkipsOf(
    resolveProduct({ target, name: product, config: readConfig(target)?.products?.['acme'] ?? {} }),
  ).map(({ message }) => message);
};

describe('badSkipsOf', () => {
  it('passes a skip that names a known reason class, several of them too', () => {
    expect(problemsOf('<div data-et-skip="CLIPPED"></div><p data-et-skip="WRAP CONTROL-HEIGHT"></p>')).toEqual([]);
  });

  it.each([
    'ACTION-UNDECLARED',
    'NESTED-SURFACE',
    'CONTRAST',
    'LOST-SURFACE',
    'NESTED-SCROLL',
    'CUT-CONTROL',
    'SKIP-SCOPE',
    'UNBOUND-INPUT',
    'OFF-CENTRE',
    'DISABLED-INTERACTION',
    'UNREACHABLE',
    'COVERED',
  ])('flags %s, a rule design check no longer runs', (name) => {
    expect(problemsOf(`<div data-et-skip="CLIPPED ${name}"></div>`)).toEqual([
      expect.stringContaining(`names "${name}"`),
    ]);
  });

  it('ignores OFF-CENTRE on studio foundations/type only, until B503 lets that part go through a sketch', () => {
    expect(
      problemsOf('<div data-et-skip="OFF-CENTRE"></div>', { product: 'studio', part: 'foundations/type' }),
    ).toEqual([]);
  });

  it.each([
    { product: 'studio', part: 'foundations/colors' },
    { product: 'acme', part: 'foundations/type' },
  ])('flags OFF-CENTRE on $product $part', (where) => {
    expect(problemsOf('<div data-et-skip="OFF-CENTRE"></div>', where)).toEqual([
      expect.stringContaining('names "OFF-CENTRE"'),
    ]);
  });

  it('flags another removed id on studio foundations/type', () => {
    expect(problemsOf('<div data-et-skip="COVERED"></div>', { product: 'studio', part: 'foundations/type' })).toEqual([
      expect.stringContaining('names "COVERED"'),
    ]);
  });

  it('flags an empty skip, a bare attribute and an unknown class', () => {
    expect(problemsOf('<div data-et-skip=""></div><p data-et-skip=></p><i data-et-skip="CUT"></i>')).toEqual([
      expect.stringContaining('names no reason class'),
      expect.stringContaining('names no reason class'),
      expect.stringContaining('names "CUT"'),
    ]);
  });
});

describe('addedSkipMarksOf', () => {
  const source = (markup: string) => `export default definePart({ render: () => ({ body: \`${markup}\` }) });`;

  it('lists each marker the new source adds, a second copy of a kept one too', () => {
    expect(
      addedSkipMarksOf(
        source('<p data-et-skip="WRAP"></p>'),
        source('<p data-et-skip="WRAP"></p><i data-et-skip="WRAP"></i><b data-et-skip="CLIPPED  WRAP"></b>'),
      ),
    ).toEqual(['WRAP', 'CLIPPED WRAP']);
  });

  it('lists nothing for kept or removed markers, and every marker of a new part', () => {
    expect(addedSkipMarksOf(source('<p data-et-skip="WRAP"></p>'), source('<p data-et-skip="WRAP"></p>'))).toEqual([]);
    expect(addedSkipMarksOf(source('<p data-et-skip="WRAP"></p>'), source('<p></p>'))).toEqual([]);
    expect(addedSkipMarksOf(null, source('<p data-et-skip="WRAP"></p>'))).toEqual(['WRAP']);
  });
});
