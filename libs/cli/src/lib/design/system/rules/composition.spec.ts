import { cpSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../design-config';
import { resolveProduct } from '../resolve-product';
import { compositionWithInteractionsOf, isCompositionSource } from './composition';

const acmeWith = (fields: string) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-system-'));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });
  writeFileSync(
    join(target, DESIGN_DIR, 'acme/elements/hero/hero.ts'),
    `import { definePart } from '@design-system';\nexport default definePart({ note: '', ${fields} states: {}, render: () => ({ body: '', styles: '' }) });\n`,
  );

  return resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
};

describe('compositionWithInteractionsOf', () => {
  it('flags a part without controls that declares interactions', () => {
    expect(compositionWithInteractionsOf(acmeWith("interactions: ['hover'],"))).toEqual([
      expect.objectContaining({ rule: 'COMPOSITION', message: expect.stringContaining('elements/hero') }),
    ]);
  });

  it('passes a part with controls, and one without interactions', () => {
    const controls = "controls: { go: { kind: 'button', input: ['pointer'] } },";

    expect(compositionWithInteractionsOf(acmeWith(`${controls} interactions: ['hover'],`))).toEqual([]);
    expect(compositionWithInteractionsOf(acmeWith(''))).toEqual([]);
  });

  it('never calls a page or a foundations part a composition', () => {
    expect(isCompositionSource({ key: 'elements/hero', source: '' })).toBe(true);
    expect(isCompositionSource({ key: 'pages/start', source: '' })).toBe(false);
    expect(isCompositionSource({ key: 'foundations/palette', source: '' })).toBe(false);
  });
});
