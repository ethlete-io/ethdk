import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../design-config';
import { lowContrastPairsOf } from './contrast-pairs';
import { resolveProduct } from './resolve-product';
import { slowInputsOf, slowProblemsOf } from './slow-checks';
import { runSlowChecks } from './slow-run';

describe('lowContrastPairsOf', () => {
  it('reads each pair the drawing marks low, with the ratio its chip shows', () => {
    const markup = readFileSync(join(__dirname, '..', '__fixtures__', 'contrast-pairs-text-muted-low.html'), 'utf8');

    expect(lowContrastPairsOf(markup)).toEqual([
      { pair: '--text-muted --surface', message: '--text-muted on --surface 1.7 < 4.5' },
      { pair: '--text-muted --surface-dark-elevated', message: '--text-muted on --surface-dark-elevated 1.4 < 4.5' },
      {
        pair: '--text-muted --surface-dark-elevated-2',
        message: '--text-muted on --surface-dark-elevated-2 1.2 < 4.5',
      },
    ]);
  });

  it('skips a measured pair that meets its need and an exempt one', () => {
    expect(
      lowContrastPairsOf(
        '<span data-et-contrast="--text --surface" data-et-contrast-needs="4.5" data-et-contrast-ratio="16.1"></span>' +
          '<span data-et-contrast="--surface-border --surface" data-et-contrast-needs="" data-et-contrast-ratio="1.5"></span>',
      ),
    ).toEqual([]);
  });
});

describe('CONTRAST-PAIR in the slow set', { timeout: 30_000 }, () => {
  const colorsProduct = () => {
    const target = mkdtempSync(join(tmpdir(), 'cli-design-contrast-pair-'));

    cpSync(join(__dirname, '__fixtures__'), target, { recursive: true });

    const dir = join(target, DESIGN_DIR, 'acme');

    mkdirSync(join(dir, 'foundations/colors'), { recursive: true });
    writeFileSync(
      join(dir, 'foundations/colors/colors.ts'),
      'export default definePart({ states: { surfaces: {} }, render: () => tokenSheet({ setup: (root) => measureContrastPairs(root) }) });\n',
    );

    return {
      target,
      file: join(dir, 'foundations/colors/colors.ts'),
      product: () => resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} }),
    };
  };

  it('draws only a part that measures its token pairs, and stores what it finds', async () => {
    const { target, file, product } = colorsProduct();

    expect(slowInputsOf({ product: product() })['foundations/colors']?.rules).toEqual(['CONTRAST-PAIR']);
    expect(slowInputsOf({ product: product() })['components/button']?.rules ?? []).not.toContain('CONTRAST-PAIR');

    const hit = {
      rule: 'CONTRAST-PAIR',
      file,
      message: '--text-muted on --surface 1.7 < 4.5',
      at: '--text-muted --surface',
    };

    await runSlowChecks({
      target,
      config: readConfig(target) ?? {},
      product: product(),
      parts: ['foundations/colors'],
      runners: {
        contrastPairs: async ({ parts }) => (parts?.includes('foundations/colors') ? [hit] : []),
        controlState: async () => [],
        droppedProps: async () => [],
        actionLost: async () => [],
      },
    });

    expect(slowProblemsOf({ product: product(), part: 'foundations/colors' })).toEqual([
      { ...hit, file: '.ethlete/design/acme/foundations/colors/colors.ts' },
    ]);
  });
});
