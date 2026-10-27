import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { badWidthsOf } from './widths';

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

const part = (widths: string) =>
  `import { definePart } from '@design-system';\nexport default definePart({ note: '', widths: ${widths}, states: {}, render: () => ({ body: '', styles: '' }) });\n`;

describe('badWidthsOf', () => {
  it('passes the fixture, whose parts declare no widths', () => {
    expect(badWidthsOf(resolveAcme(acme()))).toEqual([]);
  });

  it('passes a list of positive numbers and a list held in a variable', () => {
    const target = acme();

    write(target, 'acme/elements/hero/hero.ts', part('[280, 480.5, 720]'));
    write(target, 'acme/pages/home/home.ts', part('WIDTHS'));

    expect(badWidthsOf(resolveAcme(target))).toEqual([]);
  });

  it.each(['[]', '[0, 480]', '[-280]', "['280']", '480', "'wide'", '{ phone: 280 }'])('flags widths: %s', (widths) => {
    const target = acme();

    write(target, 'acme/elements/hero/hero.ts', part(widths));

    expect(badWidthsOf(resolveAcme(target))).toEqual([
      expect.objectContaining({ rule: 'WIDTHS', file: expect.stringContaining('hero.ts') }),
    ]);
  });
});
