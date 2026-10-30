import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { inlineSvgsOf } from './inline-svg';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-system-'));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });

  return target;
};

const write = (target: string, path: string, content: string) => {
  mkdirSync(dirname(join(target, DESIGN_DIR, path)), { recursive: true });
  writeFileSync(join(target, DESIGN_DIR, path), content);
};

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const part = (body: string) =>
  `import { definePart } from '@design-system';\n${body}\nexport default definePart({ note: '', states: {}, render: () => ({ body: '', styles: '' }) });\n`;

const filesOf = (target: string) =>
  inlineSvgsOf(resolveAcme(target)).map((problem) => problem.file.split(`${DESIGN_DIR}/acme/`)[1]);

describe('inlineSvgsOf', () => {
  it('passes the clean fixture', () => {
    expect(inlineSvgsOf(resolveAcme(acme()))).toEqual([]);
  });

  it('flags an svg with a viewBox in a part and in a file below its folder, also after a substitution', () => {
    const target = acme();

    write(target, 'acme/elements/hero/hero.ts', part('const a = `<svg width="${16}" viewBox="0 0 16 16"></svg>`;'));
    write(target, 'acme/pages/home/shared/icons.ts', 'export const b = \'<svg\\n  viewBox="0 0 24 24"/>\';\n');

    expect(filesOf(target)).toEqual(['elements/hero/hero.ts', 'pages/home/shared/icons.ts']);
    expect(inlineSvgsOf(resolveAcme(target))[0]?.message).toBe(
      'draws an <svg> icon inline - put it in assets/ and draw it with a helper of a foundations part',
    );
  });

  it('passes an svg without its own viewBox, and any svg in foundations', () => {
    const target = acme();

    write(
      target,
      'acme/pages/home/home.ts',
      part('const a = `<svg width="${40}"><marker viewBox="0 0 10 10"/><path d="M0 0H40"/></svg>`;'),
    );
    write(target, 'acme/foundations/palette/palette.ts', part('const b = \'<svg viewBox="0 0 16 16"/>\';'));

    expect(filesOf(target)).toEqual([]);
  });
});
