import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { utilityCssOf } from './utility-css';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-system-'));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });

  return target;
};

const write = (target: string, path: string, content: string) => {
  mkdirSync(dirname(join(target, DESIGN_DIR, path)), { recursive: true });
  writeFileSync(join(target, DESIGN_DIR, path), content);
};

const withStyles = (target: string, theme: string) => {
  const config = readConfig(target) ?? {};

  write(
    target,
    'config.json',
    JSON.stringify({
      ...config,
      products: {
        ...config.products,
        acme: { ...config.products?.['acme'], styles: [`${DESIGN_DIR}/acme/styles.css`] },
      },
    }),
  );
  write(target, 'acme/styles.css', `@import 'tailwindcss';\n@import './theme/theme.css';\n`);
  write(target, 'acme/theme/theme.css', theme);
};

const messagesOf = (target: string) =>
  utilityCssOf(resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} })).map(
    (problem) => `${problem.file.split('/').pop()}: ${problem.message.replace(/ outside .*/u, '')}`,
  );

const part = (body: string) =>
  `import { definePart } from '@design-system';\n${body}\nexport default definePart({ note: '', states: {}, render: () => ({ body: '', styles: '' }) });\n`;

describe('utilityCssOf', () => {
  it('passes the clean fixture', () => {
    expect(messagesOf(acme())).toEqual([]);
  });

  it('flags core layout declarations in part CSS, a shared CSS file and the CSS of a TS, outside foundations', () => {
    const target = acme();

    write(
      target,
      'acme/elements/hero/hero.css',
      '.acme-hero { display: flex; flex-direction: column; padding: 0; gap: 3px; display: -webkit-box; }',
    );
    write(target, 'acme/elements/hero/shared/row.css', '.acme-row { align-items: center !important; }');
    write(target, 'acme/pages/home/home.ts', part("const styles = '.acme-home { position: relative; width: 37px; }';"));
    write(target, 'acme/foundations/palette/palette.ts', part("const styles = '.acme-swatch { display: grid; }';"));

    expect(messagesOf(target)).toEqual([
      'hero.css: display: flex',
      'hero.css: flex-direction: column',
      'hero.css: padding: 0',
      'row.css: align-items: center',
      'home.ts: position: relative',
    ]);
  });

  it('flags a value of a token that a @theme block of the product stylesheets registers', () => {
    const target = acme();

    withStyles(
      target,
      `@theme {\n  --spacing: 0.4rem;\n  --color-*: initial;\n  --text-small: 1.3rem;\n  --text-small--line-height: 150%;\n}\n` +
        `@theme inline {\n  --color-ink: var(--ink);\n  --spacing-space-2: var(--space-2);\n}\n`,
    );
    write(
      target,
      'acme/elements/hero/hero.css',
      [
        '.acme-hero {',
        '  color: var(--ink);',
        '  background: var(--color-ink);',
        '  padding: var(--space-2) calc(var(--spacing) * 3);',
        '  font-size: var(--text-small);',
        '  color: var(--paper);',
        '  font-size: var(--ink);',
        '}',
      ].join('\n'),
    );

    expect(messagesOf(target)).toEqual([
      'hero.css: color: var(--ink)',
      'hero.css: background: var(--color-ink)',
      'hero.css: padding: var(--space-2) calc(var(--spacing) * 3)',
      'hero.css: font-size: var(--text-small)',
    ]);
  });

  it('leaves token values alone when the product registers no theme for them', () => {
    const target = acme();

    write(target, 'acme/elements/hero/hero.css', '.acme-hero { color: var(--ink); gap: var(--space-2); }');

    expect(messagesOf(target)).toEqual([]);
  });

  it('leaves declarations inside @keyframes alone', () => {
    const target = acme();

    write(
      target,
      'acme/elements/hero/hero.css',
      '@keyframes acme-pop { from { display: none; } to { display: block; } }\n.acme-hero { animation: acme-pop var(--acme-fade); }',
    );

    expect(messagesOf(target)).toEqual([]);
  });

  it('leaves rules alone whose selectors all end on an SDK element', () => {
    const target = acme();

    write(
      target,
      'acme/elements/hero/hero.css',
      '.acme-hero .et-button, .acme-hero:hover > .et-select-arrow { display: flex; }\n.acme-hero .et-button, .acme-hero span { position: relative; }\n.et-button .acme-label { display: grid; }',
    );

    expect(messagesOf(target)).toEqual(['hero.css: position: relative', 'hero.css: display: grid']);
  });
});
