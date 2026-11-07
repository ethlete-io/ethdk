import { appendFileSync, cpSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../design-config';
import { touchedPartsOf, type PrepushChange } from './touched-parts';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-touched-parts-'));

  cpSync(join(__dirname, '__fixtures__'), target, { recursive: true });

  return { target, config: readConfig(target) ?? {} };
};

const inAcme = (path: string) => `${DESIGN_DIR}/acme/${path}`;

describe('touchedPartsOf', () => {
  it('touches nothing for a change outside every product', () => {
    const { target, config } = acme();

    expect(touchedPartsOf({ target, config, changes: [{ status: 'M', file: 'README.md' }] }).size).toBe(0);
  });

  it('touches the part whose folder holds the file and every part that imports it', () => {
    const { target, config } = acme();
    const touched = touchedPartsOf({
      target,
      config,
      changes: [{ status: 'M', file: inAcme('components/button/button.ts') }],
    });

    expect([...(touched.get('acme') ?? [])].sort()).toEqual([
      'components/button',
      'components/card',
      'elements/hero',
      'pages/home',
    ]);
  });

  it('touches a part through its stylesheet', () => {
    const { target, config } = acme();
    const touched = touchedPartsOf({
      target,
      config,
      changes: [{ status: 'M', file: inAcme('elements/hero/hero.css') }],
    });

    expect([...(touched.get('acme') ?? [])].sort()).toEqual(['elements/hero', 'pages/home']);
  });

  it('touches every part of a product a stylesheet in its styles feeds', () => {
    const { target, config } = acme();

    config.products = { ...config.products, acme: { ...config.products?.['acme'], styles: ['app/styles.css'] } };

    const touched = touchedPartsOf({ target, config, changes: [{ status: 'M', file: 'app/styles.css' }] });

    expect(touched.get('acme')?.has('foundations/palette')).toBe(true);
    expect(touched.has('acme-base')).toBe(false);
  });

  it('touches every part of the product a deleted part file was in', () => {
    const { target, config } = acme();
    const touched = touchedPartsOf({
      target,
      config,
      changes: [{ status: 'D', file: inAcme('elements/gone/gone.ts') }],
    });

    expect(touched.get('acme')?.has('foundations/palette')).toBe(true);
  });
});
