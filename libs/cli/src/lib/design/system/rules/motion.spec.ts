import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { scriptedMotionOf } from './motion';

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

describe('scriptedMotionOf', () => {
  it('passes the clean fixture, whose hero uses a CSS transition', () => {
    expect(scriptedMotionOf(resolveAcme(acme()))).toEqual([]);
  });

  it('flags requestAnimationFrame and setInterval', () => {
    const target = acme();

    write(target, 'acme/elements/hero/hero.ts', part('window.requestAnimationFrame(() => undefined);'));
    write(target, 'acme/pages/home/home.ts', part('setInterval(() => undefined, 16);'));

    expect(scriptedMotionOf(resolveAcme(target)).map((problem) => problem.message)).toEqual([
      'calls requestAnimationFrame - motion must be CSS animation, CSS transition or the Web Animations API',
      'calls setInterval - motion must be CSS animation, CSS transition or the Web Animations API',
    ]);
  });

  it('leaves the Web Animations API alone', () => {
    const target = acme();

    write(target, 'acme/elements/hero/hero.ts', part('document.body.animate([{ opacity: 0 }, { opacity: 1 }], 200);'));

    expect(scriptedMotionOf(resolveAcme(target))).toEqual([]);
  });
});
