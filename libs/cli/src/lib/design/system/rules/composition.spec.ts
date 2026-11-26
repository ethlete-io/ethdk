import { cpSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../design-config';
import { resolveProduct } from '../resolve-product';
import { compositionWithInteractionsOf, isCompositionPart } from './composition';

const TWO_PARTS = "import button from '@system/components/button';\nimport card from '@system/components/card';\n";

const acmeWith = (fields: string, imports = TWO_PARTS) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-system-'));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });
  writeFileSync(
    join(target, DESIGN_DIR, 'acme/elements/hero/hero.ts'),
    `import { definePart } from '@design-system';\n${imports}export default definePart({ note: '', ${fields} states: {}, render: () => ({ body: '', styles: '' }) });\n`,
  );

  return resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
};

describe('compositionWithInteractionsOf', () => {
  // A part without controls of its own that declares interactions is flagged as a composition.
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

  it('passes a leaf that embeds no part, or wraps a single one', () => {
    expect(compositionWithInteractionsOf(acmeWith("interactions: ['hover'],", ''))).toEqual([]);
    expect(
      compositionWithInteractionsOf(
        acmeWith("interactions: ['hover'],", "import button from '@system/components/button';\n"),
      ),
    ).toEqual([]);
    expect(
      compositionWithInteractionsOf(
        acmeWith("interactions: ['hover'],", "import tokens from '@system/foundations/tokens';\n"),
      ),
    ).toEqual([]);
  });

  it('never calls a page or a foundations part a composition', () => {
    const part = (layer: string) => ({
      layer,
      name: 'x',
      file: '/x/x.ts',
      source: TWO_PARTS,
    });

    expect(isCompositionPart(part('elements') as never)).toBe(true);
    expect(isCompositionPart(part('pages') as never)).toBe(false);
    expect(isCompositionPart(part('foundations') as never)).toBe(false);
  });
});
