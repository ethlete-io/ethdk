import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { ResolvedPart } from '../resolve-product';
import { optionValuesChecker } from './option-values';

const fixture = (omits = '') => {
  const target = mkdtempSync(join(tmpdir(), 'option-values-'));
  writeFileSync(join(target, 'mock.ts'), "export type ButtonMockOptions = { size?: 'sm' | 'md' | 'lg' };\n");
  const file = join(target, 'part.ts');
  const source = `import { ButtonMockOptions } from './mock';\nexport default definePart<ButtonMockOptions>({ states: {}, ${omits} render: () => '' });`;
  writeFileSync(file, source);
  const part = { file, source } as ResolvedPart;
  const check = optionValuesChecker({ target, config: {}, parts: [part] });
  const definition = {
    states: { small: { size: 'sm' }, hidden: { size: 'lg' } },
    grid: { columns: ['rest'], rows: { small: { rest: 'small', unused: 'hidden' } } },
  };
  return check(part, definition);
};

describe('mock option coverage', () => {
  it('reports values absent from the grid', () => {
    expect(fixture()).toEqual([
      { code: 'OPTION-VALUE-MISSING', detail: expect.stringContaining('size is missing md, lg') },
    ]);
  });
  it('accepts omissions with reasons', () => {
    expect(
      fixture(
        "omits: [{ option: 'size', value: 'md', reason: 'No medium.' }, { option: 'size', value: 'lg', reason: 'No large.' }],",
      ),
    ).toEqual([]);
  });
  it('rejects unknown values and empty reasons', () => {
    expect(fixture("omits: [{ option: 'size', value: 'huge', reason: '' }],").map((problem) => problem.code)).toEqual([
      'OPTION-OMITS-REASON',
      'OPTION-OMITS-VALUE',
      'OPTION-VALUE-MISSING',
    ]);
  });
});
