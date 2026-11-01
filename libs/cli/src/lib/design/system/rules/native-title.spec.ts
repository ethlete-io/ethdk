import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { nativeTitlesOf } from './native-title';

const acme = (code: string, nativeTitle?: 'deny') => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-system-'));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });

  const file = join(target, DESIGN_DIR, 'acme/pages/home/home.ts');

  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, code);

  return resolveProduct({
    target,
    name: 'acme',
    config: { ...readConfig(target)?.products?.['acme'], ...(nativeTitle ? { nativeTitle } : {}) },
  });
};

const hitsOf = (code: string, optIn = true) =>
  nativeTitlesOf(acme(code, optIn ? 'deny' : undefined)).map(
    (problem) => `${problem.rule} ${problem.message.split(':')[0]}`,
  );

describe('nativeTitlesOf', { timeout: 30_000 }, () => {
  it('reports a title attribute on an HTML element with its line', () => {
    expect(
      hitsOf('const a = 1;\nconst b = `\n<div class="x">\n  <button title="Close">x</button>\n</div>`;\n'),
    ).toEqual(['NATIVE-TITLE line 4']);
  });

  it('reports a title with an interpolated value, across holes that span lines', () => {
    expect(hitsOf('const b = `<p>${\n  a +\n  b\n}</p>\n<span title="${x}">y</span>`;\n')).toEqual([
      'NATIVE-TITLE line 5',
    ]);
  });

  it('reports a title on a tag spread over lines and one inside a plain string literal', () => {
    expect(
      hitsOf(
        'const b = `<span\n  class="x"\n  title="y"\n></span>`;\nconst c = \'<button title="Hide">x</button>\';\n',
      ),
    ).toEqual(['NATIVE-TITLE line 3', 'NATIVE-TITLE line 5']);
  });

  it('reports a title in a string that holds only the start of the tag', () => {
    expect(hitsOf('const parts = [\n  \'<button title="Hide" aria-label="x" \',\n  \'data-a>\',\n];\n')).toEqual([
      'NATIVE-TITLE line 2',
    ]);
  });

  it('exempts elements with a dash in their name', () => {
    expect(hitsOf('const b = `<et-button title="x">a</et-button><my-card title="${t}"></my-card>`;\n')).toEqual([]);
  });

  it('ignores object keys, function arguments and a data-title attribute', () => {
    expect(
      hitsOf(
        'const o = { title: "x" };\nconst f = (title: string) => title;\nf({ title: "y" });\nconst b = `<div data-title="x" aria-title="y"></div>`;\n',
      ),
    ).toEqual([]);
  });

  it('reports nothing unless the product opts in', () => {
    expect(hitsOf('const b = `<div title="x"></div>`;\n', false)).toEqual([]);
  });
});
