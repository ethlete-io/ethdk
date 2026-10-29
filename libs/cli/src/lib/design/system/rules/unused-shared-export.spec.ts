import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { unusedSharedExportsOf } from './unused-shared-export';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-system-'));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });

  return target;
};

const write = (target: string, path: string, content: string) => {
  mkdirSync(dirname(join(target, DESIGN_DIR, path)), { recursive: true });
  writeFileSync(join(target, DESIGN_DIR, path), content);
};

const prepend = (target: string, path: string, content: string) =>
  write(target, path, `${content}\n${readFileSync(join(target, DESIGN_DIR, path), 'utf8')}`);

const productOf = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const linesOf = (problems: { rule: string; file: string; message: string }[]) =>
  problems.map((problem) => `${problem.rule} ${problem.file.split('/').slice(-2).join('/')}: ${problem.message}`);

describe('unusedSharedExportsOf', () => {
  it("names each export of a part's shared/ file that no file of the part imports", () => {
    const target = acme();

    write(
      target,
      'acme/pages/home/shared/data.ts',
      [
        'export const rows = [];',
        'export const flowList = [];',
        'export function stepTree() {}',
        'export type Row = { id: string };',
        'export type Gone = { id: string };',
        'const local = 1;',
        'export { local as renamed };',
      ].join('\n'),
    );
    write(target, 'acme/pages/home/shared/more.ts', 'export const all = 1;\nexport default 2;');
    write(target, 'acme/pages/home/shared/re.ts', "export { renamed } from './data';\nexport const used = 1;");
    prepend(
      target,
      'acme/pages/home/home.ts',
      [
        "import { rows } from './shared/data';",
        "import * as more from './shared/more';",
        "import { used } from './shared/re';",
        "export type { Row } from './shared/data';",
        'void rows, more, used;',
      ].join('\n'),
    );

    expect(linesOf(unusedSharedExportsOf(productOf(target)))).toEqual([
      'UNUSED-EXPORT shared/data.ts: flowList is exported, but nothing imports it - delete it or drop the export',
      'UNUSED-EXPORT shared/data.ts: stepTree is exported, but nothing imports it - delete it or drop the export',
      'UNUSED-EXPORT shared/data.ts: Gone is exported, but nothing imports it - delete it or drop the export',
      'UNUSED-EXPORT shared/re.ts: renamed is exported, but nothing imports it - delete it or drop the export',
    ]);
  });

  it('passes a product without shared/ folders', () => {
    expect(unusedSharedExportsOf(productOf(acme()))).toEqual([]);
  });
});
