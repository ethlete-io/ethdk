import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../design-config';
import { checkSystemRendered, summaryText } from './check-system';
import { acme, output, noBrowser, check } from './check-system.fixtures';

describe('checkSystem', () => {
  afterEach(() => vi.restoreAllMocks());

  it('passes the clean fixture, types included', () => {
    const lines = output();

    expect(check(acme(), ['acme'])).toBe(0);
    expect(lines).toEqual(['ok']);
  }, 60_000);

  it('prints each problem as rule, file and message', () => {
    const target = acme();
    const lines = output();

    writeFileSync(join(target, DESIGN_DIR, 'acme/elements/hero/hero.css'), '.acme-hero { color: #fff; }');

    expect(check(target, ['acme'])).toBe(1);
    expect(lines).toEqual([
      `HARD-CODED-COLOUR ${DESIGN_DIR}/acme/elements/hero/hero.css: #fff outside foundations - use a foundations token`,
    ]);
  }, 60_000);

  it('fails on an interaction Studio does not know', () => {
    const target = acme();
    const lines = output();
    const button = join(target, DESIGN_DIR, 'acme/components/button/button.ts');

    writeFileSync(button, readFileSync(button, 'utf8').replace("'active'", "'pressed'"));

    expect(check(target, ['acme'])).toBe(1);
    expect(lines[0]).toBe(
      `INTERACTIONS ${DESIGN_DIR}/acme/components/button/button.ts: unknown interaction "pressed" - interactions are hover, focus-visible, active, disabled; rest is always drawn, and pressed or loading is a state`,
    );
  }, 60_000);

  it('types a page drawn with the wireframe kit and fails a component that imports it', () => {
    const target = acme();
    const lines = output();
    const kitPart = `import { definePart, drawing } from '@design-system';
import { box, button, icon, image, input, textLines } from '@design-system/kit';
export default definePart({
  note: '',
  states: { rest: {} },
  render: () => drawing({ body: box([icon(), image({ height: 80 }), textLines({ lines: 2 }), input({ label: 'Mail' }), button('Go', { primary: true })], { direction: 'column' }), styles: '' }),
});
`;

    writeFileSync(join(target, DESIGN_DIR, 'acme/pages/home/home.ts'), kitPart);

    expect(check(target, ['acme'])).toBe(0);

    writeFileSync(join(target, DESIGN_DIR, 'acme/components/button/button.ts'), kitPart);
    lines.length = 0;

    expect(check(target, ['acme'])).toBe(1);
    expect(lines).toEqual([
      `WIREFRAME-KIT ${DESIGN_DIR}/acme/components/button/button.ts: components may not use @design-system/kit - only elements and pages draw with the wireframe kit`,
    ]);
  }, 60_000);

  it('lets a page import a named helper of a foundation, and refuses a foundation that imports one of a page', () => {
    const target = acme();
    const lines = output();
    const palette = join(target, DESIGN_DIR, 'acme/foundations/palette/palette.ts');
    const home = join(target, DESIGN_DIR, 'acme/pages/home/home.ts');

    writeFileSync(palette, `${readFileSync(palette, 'utf8')}\nexport const accent = (): string => 'Accent';\n`);
    writeFileSync(
      home,
      `import { accent } from '@system/foundations/palette';\n${readFileSync(home, 'utf8').replace('<main>', '<main>${accent()}')}`,
    );

    expect(check(target, ['acme'])).toBe(0);
    expect(lines).toEqual(['ok']);

    lines.length = 0;
    writeFileSync(
      palette,
      `import { HomeProps } from '@system/pages/home';\n${readFileSync(palette, 'utf8')}\nexport type Films = HomeProps['films'];\n`,
    );

    expect(check(target, ['acme'])).toBe(1);
    expect(lines).toEqual([expect.stringMatching(/^UPWARD-DEPENDENCY .*palette\.ts: /)]);
  }, 60_000);

  it('fails on a type error', () => {
    const target = acme();
    const lines = output();

    writeFileSync(
      join(target, DESIGN_DIR, 'acme/pages/home/home.ts'),
      "import { definePart } from '@design-system';\nexport default definePart({ states: {}, render: () => ({ body: '', styles: '' }) });\n",
    );

    expect(check(target, ['acme'])).toBe(1);
    expect(lines[0]).toMatch(/^TYPE-ERROR \.ethlete\/design\/acme: /);
    expect(lines[0]).toContain("'note'");
  }, 60_000);

  it('checks a product on the built-in @ethlete/components base', () => {
    const target = acme();
    const lines = output();

    writeFileSync(
      join(target, DESIGN_DIR, 'config.json'),
      JSON.stringify({ products: { app: { base: '@ethlete/components' } } }),
    );

    expect(check(target, ['app'])).toBe(0);
    expect(lines).toEqual(['ok']);
  }, 60_000);

  it('names the declared products when asked for an unknown one', () => {
    const lines = output();

    expect(check(acme(), ['nope'])).toBe(1);
    expect(lines).toEqual(['NO PRODUCT "nope" - config.json declares acme-base, acme.']);
  });
});

describe('summaryText', () => {
  it('prints a clean line for the one part asked for', () => {
    expect(summaryText({ product: 'acme', parts: ['pages/home'], tally: new Map(), only: 'pages/home' })).toEqual([
      'PART acme pages/home: clean',
    ]);
  });

  it('names the file of app code outside every part, and leaves it out of the clean count', () => {
    const tally = new Map([
      [
        'acme',
        new Map([
          ['app code:apps/acme/src/shell.ts', { problems: ['UNBOUND-INPUT', 'SAMPLE-DEFAULT'], warnings: 1, open: 0 }],
        ]),
      ],
    ]);

    expect(summaryText({ product: 'acme', parts: ['a/x'], tally })).toEqual([
      'APP CODE acme apps/acme/src/shell.ts: 2 problems (UNBOUND-INPUT, SAMPLE-DEFAULT), 1 warning',
      'PARTS acme: 1 of 1 clean',
    ]);
  });

  it('ends with the done count over the own parts', () => {
    expect(summaryText({ product: 'acme', parts: ['a/x', 'a/y'], tally: new Map(), done: 1 })).toEqual([
      'PARTS acme: 2 of 2 clean',
      'DONE acme: 1 of 2',
    ]);
  });

  it('fails a part check without a browser on a dev machine and names what it looked for', async () => {
    vi.stubEnv('CI', '');
    const target = acme();
    const lines = output();
    const code = await checkSystemRendered({
      target,
      config: readConfig(target) ?? {},
      products: ['acme'],
      part: 'elements/hero',
      chromiumOf: noBrowser,
    });

    expect(code).toBe(1);
    expect(lines).toContainEqual(
      expect.stringMatching(
        /^RENDER CHECK FAILED - no usable browser: neither .+ nor this package .+ resolves playwright/,
      ),
    );
  }, 60_000);

  it('skips the render check without a browser under CI', async () => {
    vi.stubEnv('CI', '1');
    const target = acme();
    const lines = output();
    const code = await checkSystemRendered({
      target,
      config: readConfig(target) ?? {},
      products: ['acme'],
      part: 'elements/hero',
      chromiumOf: noBrowser,
    });

    expect(code).toBe(0);
    expect(lines).toContainEqual(expect.stringMatching(/^RENDER CHECK SKIPPED - neither /));
    expect(lines.some((line) => line.startsWith('RENDER CHECK FAILED'))).toBe(false);
  }, 60_000);
});
