import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { componentCopiesOf } from './component-copy';

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

const messagesOf = (target: string) => componentCopiesOf(resolveAcme(target)).map((problem) => problem.message);

describe('componentCopiesOf', () => {
  it('passes the clean fixture', () => {
    expect(messagesOf(acme())).toEqual([]);
  });

  it('flags an element that restyles a component class', () => {
    const target = acme();

    write(target, 'acme/elements/hero/hero.css', '.acme-hero .acme-button { padding: 0; }');

    expect(messagesOf(target)).toEqual([
      'restyles .acme-button of @system/components/button - import the component instead',
    ]);
  });

  it('flags a page that writes a component class without importing the component', () => {
    const target = acme();

    write(target, 'acme/pages/home/home.ts', part('const a = html`<article class="acme-card wide">${1}</article>`;'));

    expect(messagesOf(target)).toEqual(['writes .acme-card of @system/components/card - import the component instead']);
  });

  it('accepts the class when the page imports the component', () => {
    const target = acme();

    write(
      target,
      'acme/pages/home/home.ts',
      part('import card from \'@system/components/card\';\nconst a = html`<article class="acme-card"></article>`;'),
    );

    expect(messagesOf(target)).toEqual([]);
  });
});
