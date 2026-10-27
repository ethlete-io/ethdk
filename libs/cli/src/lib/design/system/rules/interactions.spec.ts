import { cpSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { unknownInteractionsOf } from './interactions';

const acmeWith = (interactions: string) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-system-'));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });
  writeFileSync(
    join(target, DESIGN_DIR, 'acme/elements/hero/hero.ts'),
    `import { definePart } from '@design-system';\nexport default definePart({ note: '', interactions: ${interactions}, states: {}, render: () => ({ body: '', styles: '' }) });\n`,
  );

  return resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
};

describe('unknownInteractionsOf', () => {
  it('passes the known interactions and a list held in a variable', () => {
    expect(unknownInteractionsOf(acmeWith("['hover', 'focus-visible', 'active', 'disabled']"))).toEqual([]);
    expect(unknownInteractionsOf(acmeWith('INTERACTIONS'))).toEqual([]);
  });

  it('flags each unknown name, rest included', () => {
    expect(unknownInteractionsOf(acmeWith("['hover', 'rest', 'focus']"))).toEqual([
      expect.objectContaining({ rule: 'INTERACTIONS', message: expect.stringMatching(/^unknown interaction "rest"/u) }),
      expect.objectContaining({
        rule: 'INTERACTIONS',
        message: expect.stringMatching(/^unknown interaction "focus"/u),
      }),
    ]);
  });
});
