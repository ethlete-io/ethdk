import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkDesign } from '../check';
import { DESIGN_DIR, readConfig } from '../design-config';
import { writePartRecord } from './part-ready';
import { resolveProduct } from './resolve-product';
import { originOf } from './write-origin';
import { acme, output, withoutOpenPoints } from './check-system.fixtures';

describe('checkDesign', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('lists the open points of each part before ok, and still passes', async () => {
    const target = acme();
    const lines = output();
    const hero = join(target, DESIGN_DIR, 'acme/elements/hero/hero.ts');

    mkdirSync(join(target, 'src'));
    writeFileSync(join(target, 'src/hero.component.ts'), '');
    writeFileSync(
      hero,
      readFileSync(hero, 'utf8').replace(
        'definePart<HeroProps>({',
        "definePart<HeroProps>({ implements: 'src/hero.component.ts',",
      ),
    );
    const home = join(target, DESIGN_DIR, 'acme/pages/home/home.ts');

    writeFileSync(
      home,
      readFileSync(home, 'utf8').replace(
        'definePart<HomeProps>({',
        "definePart<HomeProps>({ unreachable: [{ from: 'empty', to: 'default', reason: 'Films never come back.' }],",
      ),
    );
    mkdirSync(join(target, DESIGN_DIR, 'acme/comments'));
    writeFileSync(
      join(target, DESIGN_DIR, 'acme/comments/c-1.json'),
      JSON.stringify({
        part: 'components/button',
        state: 'default',
        size: 'fitted',
        text: 'x',
        createdAt: '2026-10-31',
      }),
    );

    expect(await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' })).toBe(0);
    expect(
      lines.filter((line) => line.startsWith('OPEN POINTS ') || line.startsWith('UNLINKED ') || line.startsWith('  ')),
    ).toEqual([
      'OPEN POINTS acme: 8 in 3 parts',
      '  components/button: no controls declared; 1 open comment (c-1); 2 missing motions (default -> long, long -> default)',
      '  components/card: no controls declared; 2 missing motions (default -> long, long -> default)',
      '  elements/hero: no controls declared',
      'UNLINKED acme: components/button, pages/home',
    ]);
    expect(lines).toContain('ok');
  }, 60_000);

  it('prints the instant line of a part that declares instant switches, like sketch ready', async () => {
    const target = acme();
    const lines = output();
    const home = join(target, DESIGN_DIR, 'acme/pages/home/home.ts');

    writeFileSync(
      home,
      readFileSync(home, 'utf8').replace(
        'definePart<HomeProps>({',
        "definePart<HomeProps>({ instant: 'The page swaps without motion.',",
      ),
    );

    await checkDesign({ target, argv: ['--product', 'acme', '--part', 'pages/home'], invocation: 'et design' });

    expect(lines).toContain(
      'pages/home declares instant state switches (no motion between its states): The page swaps without motion.',
    );

    lines.length = 0;
    await checkDesign({ target, argv: ['--product', 'acme', '--part', 'components/button'], invocation: 'et design' });

    expect(lines.some((line) => line.includes('declares instant'))).toBe(false);
  }, 60_000);

  it('lists the contrasts the render found and the missing states', async (context) => {
    const target = acme();
    const lines = output();
    const hero = join(target, DESIGN_DIR, 'acme/elements/hero/hero.ts');

    writeFileSync(
      hero,
      readFileSync(hero, 'utf8')
        .replace(
          'definePart<HeroProps>({',
          "definePart<HeroProps>({ controls: { cta: { kind: 'button', input: ['pointer'] } },",
        )
        .replace('<h1>${film.title}</h1>', '<h1>${film.title}</h1><p style="color: var(--acme-surface)">Faint</p>'),
    );

    const code = await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' });

    if (lines.some((line) => /^RENDER CHECK (SKIPPED|FAILED)/.test(line))) return context.skip('no browser');

    expect(code).toBe(1);
    expect(lines.filter((line) => line.startsWith('  elements/hero'))).toEqual([
      '  elements/hero: 1 missing state (cta); 1 contrast under the rule (state default)',
    ]);
  }, 120_000);

  it('leaves what the render finds in a base part to the base', async (context) => {
    const target = acme();
    const lines = output();
    const card = join(target, DESIGN_DIR, 'acme-base/components/card/card.ts');

    writeFileSync(
      card,
      readFileSync(card, 'utf8').replace(
        '<h3>${title}</h3>',
        '<h3>${title}</h3><p style="color: var(--acme-surface)">Faint</p>',
      ),
    );

    const code = await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' });

    if (lines.some((line) => /^RENDER CHECK (SKIPPED|FAILED)/.test(line))) return context.skip('no browser');

    expect(code).toBe(0);
    expect(withoutOpenPoints(lines).filter((line) => line.includes('components/card'))).toEqual([]);
    expect(lines).toContainEqual(
      expect.stringMatching(
        /^\d+ findings? in base product acme-base \((?:[A-Z-]+ \d+(?:, )?)+\) - they do not block this product; run et design check --product acme-base for the base's own$/,
      ),
    );
    expect(await checkDesign({ target, argv: ['--product', 'acme-base'], invocation: 'et design' })).toBe(1);
  }, 120_000);

  it('fails on an element without an action in a part with no check record, and warns once for a part with one', async (context) => {
    const target = acme();
    const lines = output();
    const hero = join(target, DESIGN_DIR, 'acme/elements/hero/hero.ts');

    vi.spyOn(console, 'warn').mockImplementation((line: unknown) => void lines.push(String(line)));
    writeFileSync(
      hero,
      readFileSync(hero, 'utf8').replace(
        'styles: styles + play.styles,',
        "styles: styles + play.styles, setup: (root) => root.querySelector('h1')?.addEventListener('click', () => undefined),",
      ),
    );

    const ungone = await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' });

    if (lines.some((line) => /^RENDER CHECK (SKIPPED|FAILED)/.test(line))) return context.skip('no browser');

    expect(ungone).toBe(1);
    expect(lines).toContainEqual(expect.stringMatching(/^ACTION-UNDECLARED acme elements\/hero default at /));

    const config = readConfig(target) ?? {};
    const product = resolveProduct({ target, name: 'acme', config: config.products?.['acme'] ?? {} });

    writePartRecord({ product, part: 'elements/hero', origin: originOf('spec') });
    lines.length = 0;

    expect(await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' })).toBe(0);
    expect(lines.filter((line) => line.includes('ACTION-UNDECLARED acme'))).toEqual([
      expect.stringMatching(
        /^WARNING ACTION-UNDECLARED acme elements\/hero: \d+ hits? on 1 element, unchanged since its go - first .*h1: h1 ".+" is interactive but declares no action$/,
      ),
    ]);
  }, 180_000);

  it('lists a border under the non-text contrast rule as a contrast', async (context) => {
    const target = acme();
    const lines = output();
    const hero = join(target, DESIGN_DIR, 'acme/elements/hero/hero.ts');

    writeFileSync(
      hero,
      readFileSync(hero, 'utf8').replace(
        '<h1>${film.title}</h1>',
        '<h1>${film.title}</h1><button type="button" style="height: 8px; border: 1px solid var(--acme-surface)"></button>',
      ),
    );

    const code = await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' });

    if (lines.some((line) => /^RENDER CHECK (SKIPPED|FAILED)/.test(line))) return context.skip('no browser');

    expect(code).toBe(1);
    expect(lines.filter((line) => line.startsWith('  elements/hero'))).toEqual([
      '  elements/hero: no controls declared; 1 contrast under the rule (state default)',
    ]);
  }, 120_000);
});
