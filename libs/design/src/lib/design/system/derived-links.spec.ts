import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../design-config';
import { derivedLinksOf, writeDerivedLinks } from './derived-links';
import { takesEveryPropOf } from './dropped-props';
import { UncoveredState } from './live-uncovered';
import { resolveProduct } from './resolve-product';
import { appComponentsOf, SlotComponents } from './slot-hosts';

const HERO = 'apps/acme/src/app/hero/hero.component.ts';
const BANNER = 'apps/acme/src/app/banner/banner.component.ts';
const HOME = 'apps/acme/src/app/home/home.component.ts';

const VIEW = 'apps/acme/src/app/view/view.component.ts';

const COMPONENTS = new Map([
  ['app-hero', HERO],
  ['app-view', VIEW],
  ['app-banner', BANNER],
  ['app-home', HOME],
]);

const acme = (links: Record<string, string> = {}, routes: Record<string, string> = {}) => {
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

  for (const [part, path] of Object.entries(routes)) {
    const file = join(target, `.ethlete/design/acme/${part}/${part.split('/')[1]}.ts`);
    const source = readFileSync(file, 'utf8');

    writeFileSync(
      file,
      source.replace(
        /definePart(<\w+>)?\(\{/u,
        (open) => `${open}\n  implements: { route: '/', component: '${path}' },`,
      ),
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

  it('leaves a component another part links to that part, when the page draws it at a slot of a different part', () => {
    const { product } = acme({ 'elements/hero': HERO });

    const derived = derivedLinksOf({
      product,
      states: [state('default', [{ part: 'components/button', selectors: ['app-hero'] }])],
      components: COMPONENTS,
    });

    expect(derived).toEqual({ links: [], ambiguous: [] });
  });

  it('links no foundation, even where the page draws one component at its slots', () => {
    const derived = derivedLinksOf({
      product: acme().product,
      states: [state('default', [{ part: 'foundations/palette', selectors: ['app-hero'] }])],
      components: COMPONENTS,
    });

    expect(derived).toEqual({ links: [], ambiguous: [] });
  });
});

describe('derivedLinksOf for a page', { timeout: 30_000 }, () => {
  const around = (name: string, selectors: string[]): UncoveredState => ({
    page: 'pages/home',
    state: name,
    regions: [],
    around: selectors,
  });

  it('links a route page to the innermost component around the live host in every state of it', () => {
    const { product } = acme({}, { 'pages/home': HOME });

    const derived = derivedLinksOf({
      product,
      states: [around('default', ['app-view', 'app-banner']), around('error', ['app-home', 'app-view', 'app-banner'])],
      components: COMPONENTS,
      takes: () => true,
    });

    expect(derived).toEqual({ links: [{ part: 'pages/home', from: HOME, to: VIEW }], ambiguous: [] });
  });

  it('skips a component another part links, and leaves a page without a route link alone', () => {
    const { product } = acme({ 'elements/hero': VIEW }, { 'pages/home': HOME });

    expect(
      derivedLinksOf({
        product,
        states: [around('default', ['app-view', 'app-home'])],
        components: COMPONENTS,
        takes: () => true,
      }),
    ).toEqual({ links: [], ambiguous: [] });

    expect(
      derivedLinksOf({
        product: acme({ 'pages/home': HOME }).product,
        states: [around('default', ['app-view'])],
        components: COMPONENTS,
        takes: () => true,
      }),
    ).toEqual({ links: [], ambiguous: [] });
  });

  it('skips a component that does not take every design prop of the page', () => {
    const { target, product } = acme({}, { 'pages/home': HOME });
    const takingFilms = `import { Component, input } from '@angular/core';\n\n@Component({ selector: 'x', template: '' })\nexport class C {\n  films = input<unknown[]>([]);\n}\n`;

    writeFileSync(join(target, HOME), takingFilms);
    writeFileSync(join(target, BANNER), takingFilms);

    const takes = (_page: string, path: string) =>
      takesEveryPropOf({
        states: { default: { films: [{ title: 'Heat' }] }, empty: { films: [] } },
        sampled: [],
        source: readFileSync(join(target, path), 'utf8'),
      });

    expect(
      derivedLinksOf({ product, states: [around('default', ['app-view', 'app-home'])], components: COMPONENTS, takes }),
    ).toEqual({ links: [], ambiguous: [] });
    expect(
      derivedLinksOf({
        product,
        states: [around('default', ['app-view', 'app-banner'])],
        components: COMPONENTS,
        takes,
      }),
    ).toEqual({ links: [{ part: 'pages/home', from: HOME, to: BANNER }], ambiguous: [] });
  });

  it('derives no page link without a prop check', () => {
    const { product } = acme({}, { 'pages/home': HOME });

    expect(derivedLinksOf({ product, states: [around('default', ['app-view'])], components: COMPONENTS })).toEqual({
      links: [],
      ambiguous: [],
    });
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

  it('writes a derived page link into the component of its route link and keeps the route', () => {
    const { target, product } = acme({}, { 'pages/home': HOME });

    expect(
      writeDerivedLinks({
        target,
        product,
        derived: { links: [{ part: 'pages/home', from: HOME, to: VIEW }], ambiguous: [] },
      }),
    ).toEqual([`LINKED pages/home implements ${VIEW} (was ${HOME})`]);
    expect(readFileSync(join(target, '.ethlete/design/acme/pages/home/home.ts'), 'utf8')).toContain(
      `implements: { route: '/', component: '${VIEW}' },`,
    );
  });
});
