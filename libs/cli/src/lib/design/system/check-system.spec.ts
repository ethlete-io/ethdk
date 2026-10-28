import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkDesign } from '../check';
import { DESIGN_DIR, readConfig } from '../paths';
import { checkSystem } from './check-system';
import { recordMerged } from './sketch/merged-parts';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-system-'));

  cpSync(join(__dirname, '__fixtures__'), target, { recursive: true });

  return target;
};

const output = () => {
  const lines: string[] = [];
  const push = (line: unknown) => void lines.push(String(line));

  vi.spyOn(console, 'log').mockImplementation(push);
  vi.spyOn(console, 'error').mockImplementation(push);

  return lines;
};

const check = (target: string, products: string[]) =>
  checkSystem({ target, config: readConfig(target) ?? {}, products });

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

describe('checkDesign', () => {
  afterEach(() => vi.restoreAllMocks());

  it('checks every product when run without flags', async () => {
    const target = acme();
    const lines = output();

    writeFileSync(join(target, DESIGN_DIR, 'acme/elements/hero/hero.css'), '.acme-hero { color: #fff; }');

    expect(await checkDesign({ target, argv: [], invocation: 'et design' })).toBe(1);
    expect(lines).toEqual([expect.stringMatching(/^HARD-CODED-COLOUR .*hero\.css: #fff/)]);
  }, 60_000);

  it('warns of a merged part that changed outside a sketch, and passes', async () => {
    const target = acme();
    const lines = output();
    const warnings: string[] = [];

    vi.spyOn(console, 'warn').mockImplementation((line: unknown) => void warnings.push(String(line)));
    recordMerged({ productDir: join(target, DESIGN_DIR, 'acme'), parts: ['elements/hero'] });
    writeFileSync(join(target, DESIGN_DIR, 'acme/elements/hero/hero.css'), '.acme-hero { padding: 0; }');

    expect(await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' })).toBe(0);
    expect(warnings).toEqual([expect.stringMatching(/^WARNING acme elements\/hero changed outside a sketch/)]);
    expect(lines.at(-1)).toBe('ok');
  }, 60_000);

  it('checks one product with --product', async () => {
    const lines = output();

    expect(await checkDesign({ target: acme(), argv: ['--product', 'acme'], invocation: 'et design' })).toBe(0);
    expect(lines).toEqual(['ok']);
  }, 60_000);
});
