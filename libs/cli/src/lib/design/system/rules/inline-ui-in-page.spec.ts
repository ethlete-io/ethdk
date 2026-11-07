import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../design-config';
import { resolveProduct } from '../resolve-product';
import { inlineUiVerdictOf } from './inline-ui-in-page';
import { OpenInlineUi } from './inline-ui-in-page-open';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-system-'));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });

  return target;
};

const write = (target: string, path: string, content: string) => {
  mkdirSync(dirname(join(target, DESIGN_DIR, path)), { recursive: true });
  writeFileSync(join(target, DESIGN_DIR, path), content);
};

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const page = (body: string, imports = '') =>
  `import { definePart, html } from '@design-system';\n${imports}\n${body}\nexport default definePart({ note: '', states: {}, render: () => ({ body: '', styles: '' }) });\n`;

const open = (entry: Partial<OpenInlineUi>): OpenInlineUi => ({
  product: 'acme',
  place: 'pages/home/home.ts',
  anchor: 'save',
  kind: '<button>',
  count: 1,
  owner: 'B1',
  ...entry,
});

const verdictOf = (target: string, entries: OpenInlineUi[] = [], extra = {}) => {
  const { errors, warnings } = inlineUiVerdictOf({ product: { ...resolveAcme(target), ...extra }, open: entries });

  return { errors: errors.map((problem) => problem.message), warnings: warnings.map((problem) => problem.message) };
};

const SAVE = 'const save = html`<button type="button">Save</button>`;';

describe('inlineUiVerdictOf', () => {
  it('passes the clean fixture', () => {
    expect(verdictOf(acme())).toEqual({ errors: [], warnings: [] });
  });

  it('flags a raw button in a page and names the part to create', () => {
    const target = acme();

    write(target, 'acme/pages/home/home.ts', page(SAVE));

    expect(verdictOf(target).errors).toEqual([
      'line 3: <button> in save is inline UI - move it into components/save or elements/save and embed it',
    ]);
  });

  it("flags a page's shared module and raw SDK markup, naming the SDK part", () => {
    const target = acme();

    write(target, 'acme/pages/home/home.ts', page('', "import { controls } from './shared/controls';"));
    write(
      target,
      'acme/pages/home/shared/controls.ts',
      'export const controls = ng(`<et-switch [checked]="true" />`);',
    );

    expect(verdictOf(target).errors).toEqual([
      "line 1: <et-switch> in controls is raw SDK markup - embed components/switch instead (import switch from '@system/components/switch' and await switch.render({...}))",
    ]);
  });

  it('leaves components and elements alone', () => {
    const target = acme();

    write(target, 'acme/elements/hero/hero.ts', page(SAVE));

    expect(verdictOf(target).errors).toEqual([]);
  });

  it('turns a listed hit into a warning', () => {
    const target = acme();

    write(target, 'acme/pages/home/home.ts', page(SAVE));

    expect(verdictOf(target, [open({})])).toEqual({
      errors: [],
      warnings: [
        'line 3: <button> in save is inline UI - move it into components/save or elements/save and embed it (open, B1)',
      ],
    });
  });

  it('flags an extra hit inside a listed anchor', () => {
    const target = acme();

    write(target, 'acme/pages/home/home.ts', page('const save = html`<button>a</button><button>b</button>`;'));

    expect(verdictOf(target, [open({})]).errors).toEqual([
      'line 3: <button> in save is inline UI - move it into components/save or elements/save and embed it - save holds 2 <button> but OPEN_INLINE_UI allows 1 (B1)',
      'line 3: <button> in save is inline UI - move it into components/save or elements/save and embed it - save holds 2 <button> but OPEN_INLINE_UI allows 1 (B1)',
    ]);
  });

  it('flags a new hit of another kind or anchor beside a listed one', () => {
    const target = acme();

    write(target, 'acme/pages/home/home.ts', page(`${SAVE}\nconst pick = html\`<div tabindex="0"></div>\`;`));

    expect(verdictOf(target, [open({})]).errors).toEqual([
      'line 4: tabindex in pick is inline UI - move it into components/pick or elements/pick and embed it',
    ]);
  });

  it('flags a listed entry with fewer hits than it allows', () => {
    const target = acme();

    write(target, 'acme/pages/home/home.ts', page(SAVE));

    expect(verdictOf(target, [open({ count: 2 }), open({ anchor: 'gone', product: 'acme' })]).errors).toEqual([
      'OPEN_INLINE_UI allows 2 <button> in save (B1) but 1 remain - lower or remove the entry, the list only shrinks',
      'OPEN_INLINE_UI allows 1 <button> in gone (B1) but 0 remain - lower or remove the entry, the list only shrinks',
    ]);
  });

  it("ignores another product's entries", () => {
    expect(verdictOf(acme(), [open({ product: 'other' })]).errors).toEqual([]);
  });

  it('checks a sketch variant, its shared files keyed as the page they merge into', () => {
    const target = acme();
    const sketch = join(target, DESIGN_DIR, 'acme/sketches/pages-home');

    write(target, 'acme/sketches/pages-home/a/pages/home/home.ts', page('', "import { save } from '@shared/save';"));
    write(target, 'acme/sketches/pages-home/shared/save.ts', `export ${SAVE}`);

    const product = resolveAcme(target);
    const home = product.parts.find((part) => part.layer === 'pages' && part.name === 'home');
    const overlaid = {
      ...product,
      parts: product.parts.map((part) =>
        part === home ? { ...part, file: join(sketch, 'a/pages/home/home.ts'), origin: 'overridden' as const } : part,
      ),
      sharedDir: join(sketch, 'shared'),
      variantSharedDir: join(sketch, 'a/shared'),
    };

    expect(inlineUiVerdictOf({ product: overlaid, open: [] }).errors.map((problem) => problem.message)).toEqual([
      'line 1: <button> in save is inline UI - move it into components/save or elements/save and embed it',
    ]);
    expect(inlineUiVerdictOf({ product: overlaid, open: [open({ place: 'pages/home/shared/save.ts' })] })).toEqual(
      expect.objectContaining({ errors: [] }),
    );
    expect(inlineUiVerdictOf({ product: overlaid, open: [open({ anchor: 'gone' })] }).errors).toHaveLength(1);
  });
});
