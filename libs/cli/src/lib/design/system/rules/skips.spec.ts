import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../design-config';
import { resolveProduct } from '../resolve-product';
import { badSkipsOf } from './skips';

const problemsOf = (markup: string) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-system-'));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });

  const file = join(target, DESIGN_DIR, 'acme/elements/hero/hero.ts');

  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(
    file,
    `import { definePart } from '@design-system';\nexport default definePart({ note: '', states: {}, render: () => ({ body: ${JSON.stringify(markup)}, styles: '' }) });\n`,
  );

  return badSkipsOf(resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} })).map(
    ({ message }) => message,
  );
};

describe('badSkipsOf', () => {
  it('passes a skip that names a known reason class, several of them too', () => {
    expect(problemsOf('<div data-et-skip="CLIPPED"></div><p data-et-skip="WRAP COVERED"></p>')).toEqual([]);
  });

  it('flags an empty skip, a bare attribute and an unknown class', () => {
    expect(problemsOf('<div data-et-skip=""></div><p data-et-skip=></p><i data-et-skip="CUT"></i>')).toEqual([
      expect.stringContaining('names no reason class'),
      expect.stringContaining('names no reason class'),
      expect.stringContaining('names "CUT"'),
    ]);
  });
});
