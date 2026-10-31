import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { staleReplacesOf } from './stale-replace';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-system-'));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });

  return target;
};

const write = (target: string, path: string, content: string) => {
  mkdirSync(dirname(join(target, DESIGN_DIR, path)), { recursive: true });
  writeFileSync(join(target, DESIGN_DIR, path), content);
};

const productOf = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

describe('staleReplacesOf', () => {
  it('names a replace on markup that neither the part nor a part it uses draws', () => {
    const target = acme();

    write(
      target,
      'acme/pages/home/pinned.ts',
      [
        'export const pinned = (body: string) =>',
        '  body',
        '    .replace(\'<section class="acme-hero">\', \'<section class="acme-hero pinned">\')',
        "    .replace(/<button class=\"acme-button\\b/u, '$&')",
        "    .replace(/^<button\\s/u, '$&')",
        '    .replace(/^<div class="acme-anchored">$/u, \'\')',
        "    .replaceAll('<div class=\"acme-cell\">', '')",
        '    .replace(/<div class="acme-gone">/gu, \'\')',
        "    .replace('<main>', '<main data-pinned>')",
        "    .replace('plain text', '')",
        "    .replace(name, '');",
        "const name = 'x';",
      ].join('\n'),
    );
    write(
      target,
      'acme/pages/home/home.ts',
      [
        "import { definePart, drawing, html } from '@design-system';",
        "import hero from '@system/elements/hero';",
        "import { pinned } from './pinned';",
        '',
        'export default definePart({',
        "  note: 'A hero.',",
        '  states: { default: {} },',
        "  render: async () => drawing({ body: pinned(html`<main>${(await hero.render({ film: { title: '' } })).body}</main>`), styles: '' }),",
        '});',
      ].join('\n'),
    );

    expect(
      staleReplacesOf(productOf(target)).map(
        (problem) => `${problem.file.split('/').slice(-2).join('/')}: ${problem.message}`,
      ),
    ).toEqual([
      'home/pinned.ts: replace(/^<div class="acme-anchored">$/u) matches no markup of pages/home or the parts it uses (elements/hero, components/button), so it changes nothing',
      'home/pinned.ts: replaceAll(\'<div class="acme-cell">\') matches no markup of pages/home or the parts it uses (elements/hero, components/button), so it changes nothing',
      'home/pinned.ts: replace(/<div class="acme-gone">/gu) matches no markup of pages/home or the parts it uses (elements/hero, components/button), so it changes nothing',
    ]);
  });

  it('leaves a replace alone on markup a package draws, which the rule cannot read', () => {
    const target = acme();

    write(
      target,
      'acme/components/chip/chip.ts',
      [
        "import { button } from '@acme/kit/button';",
        "import { definePart, drawing } from '@design-system';",
        '',
        "const tagged = () => button({}).replace(/^<(button|a) /, '<$1 data-tagged ');",
        'const markup = button({});',
        '',
        'export default definePart({',
        '  states: { default: {} },',
        "  render: () => drawing({ body: tagged() + markup.replace('<button', '<button data-b') + 'x'.replace('<gone>', ''), styles: '' }),",
        '});',
      ].join('\n'),
    );

    expect(staleReplacesOf(productOf(target)).map((problem) => problem.message)).toEqual([
      "replace('<gone>') matches no markup of components/chip, so it changes nothing",
    ]);
  });

  it('leaves a replace alone on a parameter that a call fills with markup a package draws', () => {
    const target = acme();

    write(
      target,
      'acme/components/chip/chip.ts',
      [
        "import { button } from '@acme/kit/button';",
        "import { definePart, drawing } from '@design-system';",
        '',
        "const mark = (markup: string) => markup.replace(/<(button|a) /, '<$1 data-marked ');",
        '',
        'export default definePart({',
        '  states: { default: {} },',
        "  render: () => drawing({ body: mark(button({})), styles: '' }),",
        '});',
      ].join('\n'),
    );

    expect(staleReplacesOf(productOf(target))).toEqual([]);
  });
});
