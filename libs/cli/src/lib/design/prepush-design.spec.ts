import { appendFileSync, cpSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from './paths';
import { parseNameStatus } from './prepush-changes';
import { prepushDesignCheck, touchedPartsOf } from './prepush-design';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-prepush-design-'));

  cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });

  return { target, config: readConfig(target) ?? {} };
};

const inAcme = (path: string) => `${DESIGN_DIR}/acme/${path}`;

describe('parseNameStatus', () => {
  it('reads one change per line and drops empty lines', () => {
    expect(parseNameStatus('M\ta.ts\nA\tb/c.css\nD\td.ts\n\n')).toEqual([
      { status: 'M', file: 'a.ts' },
      { status: 'A', file: 'b/c.css' },
      { status: 'D', file: 'd.ts' },
    ]);
  });
});

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

describe('prepushDesignCheck', () => {
  it('runs nothing without a design change', () => {
    const { target } = acme();

    expect(prepushDesignCheck({ target, changes: [{ status: 'M', file: 'libs/x.ts' }] })).toEqual({
      code: 0,
      lines: [],
    });
  });

  it('fails on a rule problem in a touched part', () => {
    const { target } = acme();

    appendFileSync(join(target, inAcme('elements/hero/hero.css')), '.acme-hero { color: #ff0000; }\n');

    const result = prepushDesignCheck({ target, changes: [{ status: 'M', file: inAcme('elements/hero/hero.css') }] });

    expect(result.code).toBe(1);
    expect(result.lines.some((line) => line.includes('hero.css'))).toBe(true);
  });

  it('passes when the problem sits in a part the change does not touch', () => {
    const { target } = acme();

    appendFileSync(join(target, inAcme('elements/hero/hero.css')), '.acme-hero { color: #ff0000; }\n');

    const result = prepushDesignCheck({
      target,
      changes: [{ status: 'M', file: inAcme('foundations/palette/palette.css') }],
    });

    expect(result.code).toBe(0);
  });
});
