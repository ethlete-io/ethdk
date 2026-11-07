import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../../design-config';
import { UncoveredState } from '../live-uncovered';
import { resolveProduct } from '../resolve-product';
import { partSlotsOf } from '../slot-hosts';
import { implementsUnrenderedProblemsOf } from './implements-unrendered';

const HERO_COMPONENT = 'apps/acme/src/app/hero/hero.component.ts';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-implements-unrendered-'));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });

  const hero = join(target, '.ethlete/design/acme/elements/hero/hero.ts');

  writeFileSync(
    hero,
    readFileSync(hero, 'utf8').replace(
      'definePart<HeroProps>({',
      `definePart<HeroProps>({\n  implements: '${HERO_COMPONENT}',`,
    ),
  );

  return resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
};

const state = (name: string, rendered: boolean | null): UncoveredState => ({
  page: 'pages/home',
  state: name,
  regions: [],
  slots: [{ part: 'elements/hero', selector: 'app-hero', rendered }],
});

describe('implementsUnrenderedProblemsOf', { timeout: 30_000 }, () => {
  it('reports an embedded part whose implements host the app renders at none of its slots, on the page part', () => {
    const problems = implementsUnrenderedProblemsOf({
      product: acme(),
      states: [state('default', false), state('empty', false)],
    });

    expect([...problems.keys()]).toEqual(['pages/home']);
    expect(problems.get('pages/home')).toEqual([
      {
        rule: 'IMPLEMENTS-UNRENDERED',
        file: '.ethlete/design/acme/elements/hero/hero.ts',
        message: `elements/hero implements ${HERO_COMPONENT}, but the live page pages/home renders no <app-hero> at its slot in default, empty - link the component the app renders there`,
      },
    ]);
  });

  it('passes a part the app renders at one of its slots', () => {
    const problems = implementsUnrenderedProblemsOf({
      product: acme(),
      states: [state('default', false), state('empty', true)],
    });

    expect(problems.size).toBe(0);
  });

  it('skips a slot the app had no live host for and a state that did not open', () => {
    const problems = implementsUnrenderedProblemsOf({
      product: acme(),
      states: [state('default', null), { page: 'pages/home', state: 'empty', problem: 'no element .shell' }],
    });

    expect(problems.size).toBe(0);
  });
});

describe('partSlotsOf', () => {
  it('gives one slot per marked part that names a component, with the mark box', () => {
    const slots = partSlotsOf(
      [
        { parts: ['elements/shell', 'pages/home'], x: 0, y: 0, width: 1440, height: 900 },
        { parts: ['foundations/icons'], x: 4, y: 4, width: 16, height: 16 },
      ],
      new Map([['pages/home', 'app-home']]),
    );

    expect(slots).toEqual([{ part: 'pages/home', selector: 'app-home', x: 0, y: 0, width: 1440, height: 900 }]);
  });
});
