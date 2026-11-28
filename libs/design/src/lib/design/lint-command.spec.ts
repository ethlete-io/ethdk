import { appendFileSync, cpSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from './design-config';
import { designLint } from './lint-command';
import { resolveProduct } from './system/resolve-product';
import { createSketch, Sketch } from './system/sketch/sketch';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-lint-'));

  cpSync(join(__dirname, 'system', '__fixtures__'), target, { recursive: true });

  return target;
};

const lint = (target: string, ...files: string[]) => {
  const out: string[] = [];
  const err: string[] = [];

  vi.spyOn(console, 'log').mockImplementation((line: string) => void out.push(line));
  vi.spyOn(console, 'error').mockImplementation((line: string) => void err.push(line));

  const code = designLint({ target, argv: files, invocation: 'et design', cwd: target });

  vi.restoreAllMocks();

  return { code, out, err };
};

const hero = (target: string) => join(target, DESIGN_DIR, 'acme/elements/hero/hero.css');

afterEach(() => vi.restoreAllMocks());

describe('designLint', () => {
  it('prints nothing for a clean part file', () => {
    const target = acme();

    expect(lint(target, hero(target))).toEqual({ code: 0, out: [], err: [] });
  });

  it("prints a finding of the written file's part with what to change", () => {
    const target = acme();

    appendFileSync(hero(target), '\n.acme-hero-x { color: #fff; }\n');

    expect(lint(target, `${DESIGN_DIR}/acme/elements/hero/hero.css`)).toEqual({
      code: 1,
      out: [
        'HARD-CODED-COLOUR .ethlete/design/acme/elements/hero/hero.css: #fff outside foundations - use a foundations token',
      ],
      err: [],
    });
  });

  it('leaves out the findings of other parts', () => {
    const target = acme();

    appendFileSync(hero(target), '\n.acme-hero-x { color: #fff; }\n');

    expect(lint(target, join(target, DESIGN_DIR, 'acme/pages/home/home.ts')).out).toEqual([]);
  });

  it('checks a sketch variant file laid over the product', () => {
    const target = acme();
    const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
    const sketch = createSketch({
      product,
      sketch: { layer: 'elements', name: 'hero' },
      variants: ['a', 'b'],
    }) as Sketch;
    const css = join(sketch.dir, 'b/elements/hero/hero.css');

    writeFileSync(css, `${readFileSync(css, 'utf8')}\n.acme-hero-x { color: #fff; }\n`);

    expect(lint(target, css).out).toEqual([
      `HARD-CODED-COLOUR ${css.slice(target.length + 1)}: #fff outside foundations - use a foundations token`,
    ]);
    expect(lint(target, join(sketch.dir, 'a/elements/hero/hero.css')).out).toEqual([]);
  });

  it('runs the rules that only the live check has', () => {
    const target = acme();
    const file = join(target, DESIGN_DIR, 'acme/elements/hero/hero.ts');

    appendFileSync(file, '\nexport const raised = `<div class="et-surface--raised"></div>`;\n');

    expect(lint(target, file).out).toEqual([
      expect.stringMatching(
        /^THEME-CLASS \.ethlete\/design\/acme\/elements\/hero\/hero\.ts: line \d+: `et-surface--raised`/u,
      ),
    ]);
  });

  it('takes no flags and needs a file', () => {
    const target = acme();

    expect(lint(target).code).toBe(2);
    expect(lint(target, '--fix').code).toBe(2);
  });
});
