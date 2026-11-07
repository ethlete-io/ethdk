import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkDesign } from '../check';
import { DESIGN_DIR } from '../design-config';
import { acme, output, withoutBrowserLines, check } from './check-system.fixtures';

describe('checkDesign', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('checks every product when run without flags', async () => {
    const target = acme();
    const lines = output();

    writeFileSync(join(target, DESIGN_DIR, 'acme/elements/hero/hero.css'), '.acme-hero { border-color: #fff; }');

    expect(await checkDesign({ target, argv: [], invocation: 'et design' })).toBe(1);
    expect(withoutBrowserLines(lines)).toEqual([expect.stringMatching(/^HARD-CODED-COLOUR .*hero\.css: #fff/)]);
  }, 60_000);

  it('runs the render check past a static failure and reports both', async (context) => {
    const target = acme();
    const lines = output();
    const hero = join(target, DESIGN_DIR, 'acme/elements/hero/hero.ts');

    writeFileSync(join(target, DESIGN_DIR, 'acme/elements/hero/hero.css'), '.acme-hero { color: #fff; }');
    writeFileSync(
      hero,
      readFileSync(hero, 'utf8').replace(
        'styles: styles + play.styles,',
        "styles: styles + play.styles, setup: (root) => root.querySelector('h1')?.addEventListener('click', () => undefined),",
      ),
    );

    const code = await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' });

    if (lines.some((line) => /^RENDER CHECK (SKIPPED|FAILED)/.test(line))) return context.skip('no browser');

    expect(code).toBe(1);
    expect(lines).toContainEqual(expect.stringMatching(/^HARD-CODED-COLOUR .*hero\.css: #fff/));
    expect(lines).toContainEqual(expect.stringMatching(/^ACTION-UNDECLARED acme elements\/hero default at /));
    expect(lines.filter((line) => line.startsWith('RENDER CHECK NOT RUN'))).toEqual([]);
  }, 120_000);

  it('names a part that does not draw as not checked by the render rules', async (context) => {
    const target = acme();
    const lines = output();
    const hero = join(target, DESIGN_DIR, 'acme/elements/hero/hero.ts');

    writeFileSync(hero, `if (Date.now() > 0) throw new Error('hero will not load');\n${readFileSync(hero, 'utf8')}`);

    const code = await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' });

    if (lines.some((line) => /^RENDER CHECK (SKIPPED|FAILED)/.test(line))) return context.skip('no browser');

    expect(code).toBe(1);
    expect(lines).toContainEqual(expect.stringMatching(/^RENDER acme elements\/hero - at -: - - .*hero will not load/));
    expect(lines.filter((line) => line.startsWith('NOT CHECKED'))).toEqual([
      'NOT CHECKED acme render rules on 2 parts: elements/hero, pages/home - they did not draw, see RENDER above',
    ]);
  }, 120_000);

  it('names each state that does not draw as not checked by the render rules', async (context) => {
    const target = acme();
    const lines = output();
    const hero = join(target, DESIGN_DIR, 'acme/elements/hero/hero.ts');

    writeFileSync(
      hero,
      readFileSync(hero, 'utf8')
        .replace(
          "states: { default: { film: films[0] ?? { title: '' } } },",
          "states: { default: { film: films[0] ?? { title: '' } }, broken: { film: { title: 'boom' } }, gone: { film: { title: 'boom' } } },",
        )
        .replace(
          'render: async ({ film }) => {',
          "render: async ({ film }) => {\n    if (film.title === 'boom') throw new Error('state will not draw');",
        ),
    );

    const code = await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' });

    if (lines.some((line) => /^RENDER CHECK (SKIPPED|FAILED)/.test(line))) return context.skip('no browser');

    expect(code).toBe(1);
    expect(lines).toContainEqual(
      expect.stringMatching(/^RENDER acme elements\/hero broken at .*failed - state will not draw$/),
    );
    expect(lines.filter((line) => line.startsWith('NOT CHECKED'))).toEqual([
      'NOT CHECKED acme render rules on elements/hero state broken - it did not draw, see RENDER above',
      'NOT CHECKED acme render rules on elements/hero state gone - it did not draw, see RENDER above',
    ]);
  }, 120_000);

  it('fails a capability no design action draws, and warns of one known as missing', async () => {
    const target = acme();
    const lines = output();
    const warnings: string[] = [];

    vi.spyOn(console, 'warn').mockImplementation((line: unknown) => void warnings.push(String(line)));
    writeFileSync(
      join(target, DESIGN_DIR, 'acme/capabilities.json'),
      JSON.stringify({
        capabilities: [
          { id: 'film-rate', label: 'Rate a film', place: null },
          { id: 'film-share', label: 'Share a film', place: null, missing: 'B1' },
        ],
      }),
    );

    expect(await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' })).toBe(1);
    expect(lines).toContainEqual(
      expect.stringMatching(
        /^CAPABILITY-PLACE .*capabilities\.json: film-rate \(Rate a film\): no design action draws it/,
      ),
    );
    expect(warnings).toContainEqual(
      expect.stringMatching(/^WARNING CAPABILITY-PLACE .*capabilities\.json: film-share .* tracked in B1$/),
    );
  }, 120_000);

  it('leaves the problems of a base part to the base, and checks a part the product overrides as its own', async () => {
    const target = acme();
    const lines = output();

    writeFileSync(join(target, DESIGN_DIR, 'acme-base/components/card/card.css'), '.acme-card { color: #000; }');
    writeFileSync(join(target, DESIGN_DIR, 'acme-base/components/button/button.css'), '.acme-button { color: #000; }');

    expect(check(target, ['acme'])).toBe(0);
    expect(lines).toEqual([
      "1 finding in base product acme-base (HARD-CODED-COLOUR 1) - they do not block this product; run et design check --product acme-base for the base's own",
      'ok',
    ]);

    writeFileSync(join(target, DESIGN_DIR, 'acme/components/button/button.css'), '.acme-button { color: #fff; }');
    lines.length = 0;

    expect(check(target, ['acme'])).toBe(1);
    expect(lines).toEqual([
      expect.stringMatching(/^HARD-CODED-COLOUR .*acme\/components\/button\/button\.css: #fff/),
      "1 finding in base product acme-base (HARD-CODED-COLOUR 1) - they do not block this product; run et design check --product acme-base for the base's own",
    ]);

    lines.length = 0;

    expect(check(target, ['acme-base'])).toBe(1);
    expect(lines).toEqual([
      expect.stringMatching(/^HARD-CODED-COLOUR .*acme-base\/components\/button\/button\.css: #000/),
      expect.stringMatching(/^HARD-CODED-COLOUR .*acme-base\/components\/card\/card\.css: #000/),
    ]);
  }, 60_000);
});
