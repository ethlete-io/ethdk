import { cpSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { markPartSource } from './part-marks';
import { readConfig } from './paths';
import { createDesignServer } from './serve';
import { createSketch, parseTarget } from './system/sketch/sketch';
import { createSystemModules, productModuleIdOf, SketchVariant } from './system/system-modules';

const cwd = process.cwd();
const closing: (() => Promise<void>)[] = [];

afterEach(async () => {
  await Promise.all(closing.splice(0).map((close) => close()));
  process.chdir(cwd);
});

type Drawn = { default: { states: Record<string, unknown>; render: (props: unknown) => Promise<{ body: string }> } };

const acme = async () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-marks-'));

  cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });

  const config = readConfig(target) ?? {};
  const system = createSystemModules({ target, config });
  const vite = await createDesignServer({ target, config, listen: false });

  closing.push(() => vite.close());

  const bodyOf = async (part: string, state: string, sketch: SketchVariant | null = null) => {
    const file = system.partOf({ product: 'acme', part, sketch })?.file ?? '';
    const loaded = (await vite.ssrLoadModule(productModuleIdOf({ file, product: 'acme', sketch }))) as Drawn;

    return (await loaded.default.render(loaded.default.states[state])).body;
  };

  return { target, system, bodyOf };
};

describe('markPartSource', () => {
  it('wraps the one default export', () => {
    expect(
      markPartSource({ code: "import x from 'x';\nexport default definePart({});\n", key: 'a/b', marker: '/m.ts' }),
    ).toBe(
      "import x from 'x';\nconst __etPart = definePart({});\n\n" +
        'import { markPart as __etMarkPart } from "/m.ts";\nexport default __etMarkPart(__etPart, "a/b");\n',
    );
  });

  it('leaves a module without exactly one top-level default export alone', () => {
    expect(markPartSource({ code: 'export const a = 1;\n', key: 'a/b', marker: '/m.ts' })).toBeNull();
    expect(markPartSource({ code: 'export default 1;\nexport default 2;\n', key: 'a/b', marker: '/m.ts' })).toBeNull();
  });
});

describe('the design server marks part roots', () => {
  it('marks the root of every part a page draws, also inside another part', async () => {
    const { bodyOf } = await acme();
    const body = await bodyOf('pages/home', 'default');

    expect(body).toMatch(/^<main data-et-part="pages\/home">/u);
    expect(body).toContain('<section data-et-part="elements/hero" class="acme-hero">');
    expect(body).toContain('<article data-et-part="components/card" class="acme-card">');
    expect(body).toMatch(/data-et-part="components\/button"/u);
  });

  it('marks a part as a sketch variant draws it with the sketch target', async () => {
    const { system, bodyOf } = await acme();
    const product = system.productOf('acme');
    const parsed = parseTarget('components/card');

    if (!product || typeof parsed === 'string') throw new Error('no acme');

    createSketch({ product, sketch: parsed, variants: ['a'] });

    expect(await bodyOf('pages/home', 'default', { target: 'components/card', variant: 'a' })).toContain(
      'data-et-part="components/card"',
    );
  });
});
