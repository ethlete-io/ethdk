import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../design-config';
import { derivedLinksOf, writeDerivedLinks } from './derived-links';
import { UncoveredState } from './live-uncovered';
import { resolveProduct } from './resolve-product';
import { appComponentsOf, SlotComponents } from './slot-hosts';

const HERO = 'apps/acme/src/app/hero/hero.component.ts';
const BANNER = 'apps/acme/src/app/banner/banner.component.ts';
const HOME = 'apps/acme/src/app/home/home.component.ts';

const COMPONENTS = new Map([
  ['app-hero', HERO],
  ['app-banner', BANNER],
  ['app-home', HOME],
]);

const acme = (links: Record<string, string> = {}) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-derived-links-'));

  cpSync(join(__dirname, '__fixtures__'), target, { recursive: true });

  for (const [part, path] of Object.entries(links)) {
    const file = join(target, `.ethlete/design/acme/${part}/${part.split('/')[1]}.ts`);
    const source = readFileSync(file, 'utf8');

    writeFileSync(
      file,
      source.replace(/definePart(<\w+>)?\(\{/u, (open) => `${open}\n  implements: '${path}',`),
    );
  }

  for (const [selector, path] of COMPONENTS) {
    mkdirSync(join(target, path, '..'), { recursive: true });
    writeFileSync(
      join(target, path),
      `import { Component } from '@angular/core';\n\n@Component({ selector: '${selector}', template: '' })\nexport class C {}\n`,
    );
  }

  const config = readConfig(target)?.products?.['acme'] ?? {};

  return {
    target,
    product: resolveProduct({
      target,
      name: 'acme',
      config: { ...config, harness: { app: 'apps/acme', map: 'apps/acme/src/app/design-harness-parts.ts' } },
    }),
  };
};

const state = (name: string, slots: SlotComponents[]): UncoveredState => ({
  page: 'pages/home',
  state: name,
  regions: [],
  slots,
});

describe('derivedLinksOf', { timeout: 30_000 }, () => {
  it('links a part to the app component drawn at every slot of it, replacing a hand-written link', () => {
    const { product } = acme({ 'elements/hero': BANNER, 'pages/home': HOME });

    const derived = derivedLinksOf({
      product,
      states: [
        state('default', [{ part: 'elements/hero', selectors: ['app-home', 'app-hero'] }]),
        state('empty', [{ part: 'elements/hero', selectors: ['app-home', 'app-banner', 'app-hero'] }]),
      ],
      components: COMPONENTS,
    });

    expect(derived).toEqual({ links: [{ part: 'elements/hero', from: BANNER, to: HERO }], ambiguous: [] });
  });

  it('keeps a link the slots still hold, and a link of a part the app draws inline', () => {
    const { product } = acme({ 'elements/hero': HERO, 'components/button': BANNER });

    const derived = derivedLinksOf({
      product,
      states: [
        state('default', [
          { part: 'elements/hero', selectors: ['app-banner', 'app-hero'] },
          { part: 'components/button', selectors: [] },
        ]),
      ],
      components: COMPONENTS,
    });

    expect(derived).toEqual({ links: [], ambiguous: [] });
  });

  it('settles a part another part leaves one candidate to, and reports two open candidates as ambiguous', () => {
    const { product } = acme({ 'elements/hero': HERO });

    const derived = derivedLinksOf({
      product,
      states: [
        state('default', [
          { part: 'elements/hero', selectors: ['app-banner', 'app-hero'] },
          { part: 'components/button', selectors: ['app-banner', 'app-hero'] },
        ]),
      ],
      components: COMPONENTS,
    });

    expect(derived.links).toEqual([{ part: 'components/button', from: null, to: BANNER }]);

    const open = derivedLinksOf({
      product: acme().product,
      states: [state('default', [{ part: 'elements/hero', selectors: ['app-banner', 'app-hero'] }])],
      components: COMPONENTS,
    });

    expect(open).toEqual({ links: [], ambiguous: [{ part: 'elements/hero', paths: [BANNER, HERO] }] });
  });
});

describe('writeDerivedLinks', { timeout: 30_000 }, () => {
  it('writes the derived link into the part file and regenerates the harness map from it', () => {
    const { target, product } = acme({ 'elements/hero': BANNER });

    expect([...appComponentsOf({ target, product })].sort()).toEqual([...COMPONENTS].sort());

    const lines = writeDerivedLinks({
      target,
      product,
      derived: {
        links: [
          { part: 'elements/hero', from: BANNER, to: HERO },
          { part: 'components/button', from: null, to: BANNER },
        ],
        ambiguous: [],
      },
    });

    expect(lines).toEqual([
      `LINKED elements/hero implements ${HERO} (was ${BANNER})`,
      `LINKED components/button implements ${BANNER}`,
    ]);
    expect(readFileSync(join(target, '.ethlete/design/acme/elements/hero/hero.ts'), 'utf8')).toContain(
      `implements: '${HERO}',`,
    );
    expect(readFileSync(join(target, '.ethlete/design/acme/components/button/button.ts'), 'utf8')).toContain(
      `implements: '${BANNER}',`,
    );

    const map = readFileSync(join(target, 'apps/acme/src/app/design-harness-parts.ts'), 'utf8');

    expect(map).toMatch(/"elements\/hero": \(\) => import\("\.\/hero\/hero\.component"\)/u);
    expect(map).toMatch(/"components\/button": \(\) =>\s+import\("\.\/banner\/banner\.component"\)/u);
  });
});
