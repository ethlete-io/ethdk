import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { undefinedTokensOf } from './undefined-token';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-undefined-token-'));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });

  return target;
};

const write = (target: string, path: string, content: string) => {
  mkdirSync(dirname(join(target, path)), { recursive: true });
  writeFileSync(join(target, path), content);
};

const messagesOf = (target: string, config = readConfig(target)?.products?.['acme'] ?? {}) =>
  undefinedTokensOf(resolveProduct({ target, name: 'acme', config })).map(
    (problem) => `${problem.file.split('/').pop()}: ${problem.message}`,
  );

describe('undefinedTokensOf', () => {
  it('passes the clean fixture, whose parts use the tokens of its base', () => {
    expect(messagesOf(acme())).toEqual([]);
  });

  it('flags a var() without a fallback whose token nothing defines', () => {
    const target = acme();

    write(
      target,
      `${DESIGN_DIR}/acme/elements/hero/hero.css`,
      '.hero { --hero-gap: 4px; gap: var(--hero-gap); padding: var(--space-8); margin: var(--space-9, 2px); color: var(--et-surface-1-solid); }',
    );

    expect(messagesOf(target)).toEqual([
      'hero.css: var(--space-8) has no fallback, and no stylesheet of the product or its base defines --space-8',
    ]);
  });

  it('reads the tokens a stylesheet of the product config defines', () => {
    const target = acme();

    write(target, `${DESIGN_DIR}/acme/elements/hero/hero.css`, '.hero { padding: var(--space-8); }');
    write(target, 'app/styles.css', ':root { --space-8: 80px; }');

    expect(messagesOf(target, { ...readConfig(target)?.products?.['acme'], styles: ['app/styles.css'] })).toEqual([]);
  });
});
