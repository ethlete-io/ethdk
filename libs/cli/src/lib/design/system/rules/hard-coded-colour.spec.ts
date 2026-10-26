import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { hardCodedColoursOf } from './hard-coded-colour';

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

const messagesOf = (target: string) =>
  hardCodedColoursOf(resolveAcme(target)).map(
    (problem) => `${problem.file.split('/').pop()}: ${problem.message.split(' ')[0]}`,
  );

describe('hardCodedColoursOf', () => {
  it('passes the clean fixture, whose foundations hold hex colours', () => {
    expect(messagesOf(acme())).toEqual([]);
  });

  it('flags hex colours and colour functions in component and element CSS, var() fallbacks too', () => {
    const target = acme();

    write(target, 'acme/components/button/button.css', '.acme-button { color: #fff; border: 1px solid rgb(0 0 0); }');
    write(target, 'acme/elements/hero/hero.css', '.acme-hero { background: var(--acme-surface, #fafafa); }');

    expect(messagesOf(target)).toEqual(['button.css: #fff', 'button.css: rgb(', 'hero.css: #fafafa']);
  });

  it('flags colours in the markup and inline CSS of a part', () => {
    const target = acme();

    write(
      target,
      'acme/pages/home/home.ts',
      part('const a = html`<p style="color: hsl(0 0% 0%)"></p>`; const b = "#c0ffee";'),
    );

    expect(messagesOf(target)).toEqual(['home.ts: hsl(', 'home.ts: #c0ffee']);
  });

  it('leaves id selectors, entities and plain links alone', () => {
    const target = acme();

    write(target, 'acme/elements/hero/hero.css', '#add, #bad .acme-hero { content: "&#123;"; }');
    write(target, 'acme/pages/home/home.ts', part('const a = html`<a href="#add">&#123;</a>`;'));

    expect(messagesOf(target)).toEqual([]);
  });
});
