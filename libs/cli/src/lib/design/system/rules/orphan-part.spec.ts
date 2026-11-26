import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../design-config';
import { resolveProduct } from '../resolve-product';
import { orphanPartsOf } from './orphan-part';

const part = (body = '', imports = '', field = '') =>
  `import { definePart, drawing } from '@design-system';\n${imports}\n${body}\nexport default definePart({ note: '',${field} states: { default: {} }, describe: { default: '' }, render: () => drawing({ body: '' }) });\n`;

const productWith = (files: Record<string, string>, products: Record<string, object> = { 'app-a': {} }) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-orphan-part-'));
  const write = (path: string, text: string) => {
    mkdirSync(dirname(join(target, DESIGN_DIR, path)), { recursive: true });
    writeFileSync(join(target, DESIGN_DIR, path), text);
  };

  write('config.json', JSON.stringify({ products }));
  Object.entries(files).forEach(([path, text]) => write(`app-a/${path}`, text));

  return resolveProduct({ target, name: 'app-a', config: readConfig(target)?.products?.['app-a'] ?? {} });
};

const orphansOf = (files: Record<string, string>) => orphanPartsOf(productWith(files)).map((problem) => problem.part);

describe('orphanPartsOf', () => {
  it('flags a component no page, no part and no implements link uses', () => {
    expect(
      orphansOf({
        'components/used/used.ts': part(),
        'components/unused/unused.ts': part(),
        'pages/home/home.ts': part('', "import used from '@system/components/used';"),
      }),
    ).toEqual(['components/unused']);
  });

  it('counts a use through a shared file of another part', () => {
    expect(
      orphansOf({
        'components/badge/badge.ts': part(),
        'elements/list/list.ts': part('', "import { row } from '@shared/row';"),
        'shared/row.ts': "import badge from '@system/components/badge';\nexport const row = badge;\n",
        'pages/home/home.ts': part('', "import list from '@system/elements/list';"),
      }),
    ).toEqual([]);
  });

  it('keeps a part an implements link names, and never judges pages or foundations', () => {
    expect(
      orphansOf({
        'components/linked/linked.ts': part('', '', " implements: 'apps/app-a/src/linked.component.ts',"),
        'foundations/colors/colors.ts': part(),
        'pages/home/home.ts': part(),
      }),
    ).toEqual([]);
  });

  it('does not count a part importing itself', () => {
    expect(
      orphansOf({
        'elements/self/self.ts': part('', "import './shared/x';"),
        'elements/self/shared/x.ts': "import self from '@system/elements/self';\nexport default self;\n",
        'pages/home/home.ts': part(),
      }),
    ).toEqual(['elements/self']);
  });

  it('judges no library, a product another product extends as its base', () => {
    const files = { 'components/badge/badge.ts': part(), 'pages/home/home.ts': part() };

    expect(
      orphanPartsOf(productWith(files, { 'app-a': {}, 'app-b': { base: `${DESIGN_DIR}/app-a` } })).map(
        (problem) => problem.part,
      ),
    ).toEqual([]);
    expect(orphansOf(files)).toEqual(['components/badge']);
  });
});
