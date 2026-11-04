import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { callTopLevelAwaitsOf, topLevelAwaitLinesOf, topLevelAwaitsOf } from './top-level-await';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-tla-'));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });

  return target;
};

const write = (target: string, path: string, content: string) => {
  mkdirSync(dirname(join(target, DESIGN_DIR, path)), { recursive: true });
  writeFileSync(join(target, DESIGN_DIR, path), content);
};

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const filesOf = (target: string) =>
  topLevelAwaitsOf(resolveAcme(target)).map((problem) => problem.file.split(`${DESIGN_DIR}/acme/`)[1]);

describe('topLevelAwaitLinesOf', () => {
  it('finds every await that runs while the module evaluates, a sync value included', () => {
    const source = [
      'const a = await Promise.resolve(1);',
      'const b = 2;',
      'const c = { d: await b };',
      'for await (const e of []) {}',
      'if (b) { await null; }',
    ].join('\n');

    expect(topLevelAwaitLinesOf(source)).toEqual([1, 3, 4, 5]);
  });

  it('passes an await inside a function, an arrow, a method or a static block', () => {
    const source = [
      'const a = async () => await 1;',
      'async function b() { await 1; }',
      'const c = { async d() { await 1; } };',
      'class E { static async f() { await 1; } }',
      'export default { render: async () => ({ body: await a() }) };',
    ].join('\n');

    expect(topLevelAwaitLinesOf(source)).toEqual([]);
  });
});

describe('topLevelAwaitsOf', () => {
  it('passes the clean fixture', () => {
    expect(topLevelAwaitsOf(resolveAcme(acme()))).toEqual([]);
  });

  it('flags a part and a file it imports that await at the top level, with the lines', () => {
    const target = acme();

    write(target, 'acme/pages/home/shared/chip.ts', 'export const chip = await Promise.resolve("<b></b>");\n');
    write(
      target,
      'acme/elements/hero/hero.ts',
      "import { definePart } from '@design-system';\nimport { chip } from '../../pages/home/shared/chip';\n\nconst body = await Promise.resolve(chip);\nexport default definePart({ note: '', states: { default: {} }, render: () => ({ body, styles: '' }) });\n",
    );

    expect(filesOf(target).sort()).toEqual(['elements/hero/hero.ts', 'pages/home/shared/chip.ts']);
    expect(topLevelAwaitsOf(resolveAcme(target)).find((problem) => problem.file.endsWith('hero.ts'))?.message).toBe(
      'design module uses top-level await (line 4); WebKit can hang for good when a frame is removed during its evaluation - await inside render instead',
    );
  });
});

describe('callTopLevelAwaitsOf', () => {
  it('flags a call variant that awaits at the top level and passes one that exports a promise', () => {
    const target = acme();

    write(target, 'calls/app/one/variant-a.ts', 'const body = await ng("<p></p>");\nexport default { body };\n');
    write(target, 'calls/app/one/variant-b.ts', 'export default ng("<p></p>").then((body) => ({ body }));\n');

    expect(
      callTopLevelAwaitsOf(join(target, DESIGN_DIR, 'calls')).map((problem) => problem.file.split('calls/')[1]),
    ).toEqual(['app/one/variant-a.ts']);
  });
});
