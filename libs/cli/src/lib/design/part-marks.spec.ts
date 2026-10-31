import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
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

const acme = async (files: Record<string, string> = {}) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-marks-'));

  cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });

  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(target, '.ethlete/design/acme', file)), { recursive: true });
    writeFileSync(join(target, '.ethlete/design/acme', file), text);
  }

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
        'import { markNamed as __etMarkNamed, markPart as __etMarkPart } from "/m.ts";\n' +
        'export default __etMarkPart(__etPart, "a/b");\n',
    );
  });

  it('re-exports each exported const and function through the marker, not a class, a let or a const enum', () => {
    const code = [
      'export const a = () => 1;',
      'export async function b() {}',
      'export class C {}',
      'export let d = 1;',
      'export const enum E { X }',
      'export default definePart({});',
    ].join('\n');

    expect(markPartSource({ code, key: 'a/b', marker: '/m.ts' })).toBe(
      'const a = () => 1;\nasync function b() {}\nexport class C {}\nexport let d = 1;\nexport const enum E { X }\n' +
        'const __etPart = definePart({});\n' +
        'import { markNamed as __etMarkNamed, markPart as __etMarkPart } from "/m.ts";\n' +
        'export default __etMarkPart(__etPart, "a/b");\n' +
        'const __etNamed_a = __etMarkNamed(a, "a/b");\nconst __etNamed_b = __etMarkNamed(b, "a/b");\n' +
        'export { __etNamed_a as a, __etNamed_b as b };\n',
    );
  });

  it('leaves a module without exactly one top-level default export alone', () => {
    expect(markPartSource({ code: 'export const a = 1;\n', key: 'a/b', marker: '/m.ts' })).toBeNull();
    expect(markPartSource({ code: 'export default 1;\nexport default 2;\n', key: 'a/b', marker: '/m.ts' })).toBeNull();
  });
});

describe('the design server marks part roots', () => {
  it('marks the markup of the named function exports of a part and slots their arguments, once inside its own render', async () => {
    const { bodyOf } = await acme({
      'components/tag/tag.ts': [
        "import { definePart, drawing, html } from '@design-system';",
        '',
        'export class TagModel {}',
        "export const tagLabels = ['New'];",
        'export const tagMark = (label: string) => html`<span class="acme-tag">${label}</span>`;',
        'export const tagBox = ({ body }: { body: string }) => html`<div class="acme-tag-box">${body}</div>`;',
        'export async function tagDrawing(label: string) {',
        '  return { body: html`<em class="acme-tag-drawing">${label}</em>`, styles: \'\' };',
        '}',
        '',
        'export default definePart<{ label: string }>({',
        "  note: 'A tag.',",
        "  states: { default: { label: 'New' } },",
        '  render: ({ label }) => drawing({ body: tagMark(label) }),',
        '});',
        '',
      ].join('\n'),
      'pages/tags/tags.ts': [
        "import { definePart, drawing, html } from '@design-system';",
        "import { TagModel, tagBox, tagDrawing, tagLabels, tagMark } from '@system/components/tag';",
        '',
        'export default definePart({',
        "  note: 'Tags.',",
        '  states: { default: {} },',
        '  render: async () =>',
        '    drawing({',
        "      body: html`<main data-model=\"${typeof TagModel}\">${tagLabels.map(tagMark).join('')}${(await tagDrawing('Hot')).body}${tagBox({ body: '<b>1</b>' })}</main>`,",
        '    }),',
        '});',
        '',
      ].join('\n'),
    });

    expect(await bodyOf('pages/tags', 'default')).toBe(
      '<main data-et-part="pages/tags" data-model="function">' +
        '<span data-et-part="components/tag" class="acme-tag">New</span>' +
        '<em data-et-part="components/tag" class="acme-tag-drawing">Hot</em>' +
        '<div data-et-part="components/tag" class="acme-tag-box"><b data-et-slot="components/tag">1</b></div></main>',
    );
    expect(await bodyOf('components/tag', 'default')).toBe(
      '<span data-et-part="components/tag" class="acme-tag">New</span>',
    );
  });

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
