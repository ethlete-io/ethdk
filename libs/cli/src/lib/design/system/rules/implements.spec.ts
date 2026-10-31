import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { partLinkOf } from '../sketch/part-definition';
import { badLinksOf } from './implements';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-system-'));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });
  mkdirSync(join(target, 'src/app'), { recursive: true });
  writeFileSync(join(target, 'src/app/hero.component.ts'), '');

  return target;
};

const write = (target: string, path: string, content: string) => {
  mkdirSync(dirname(join(target, DESIGN_DIR, path)), { recursive: true });
  writeFileSync(join(target, DESIGN_DIR, path), content);
};

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const part = (link: string) =>
  `import { definePart } from '@design-system';\nexport default definePart({ note: '', implements: ${link}, states: {}, render: () => ({ body: '', styles: '' }) });\n`;

const problemsWith = (files: Record<string, string>) => {
  const target = acme();

  for (const [path, link] of Object.entries(files)) write(target, path, part(link));

  return badLinksOf(resolveAcme(target)).map(({ rule, message }) => `${rule} ${message}`);
};

describe('partLinkOf', () => {
  it('reads a component path, a route, none, and a link it cannot read', () => {
    expect(partLinkOf(part("'src/a.component.ts'"))).toEqual({ kind: 'component', path: 'src/a.component.ts' });
    expect(partLinkOf(part("{ route: '/system' }"))).toEqual({ kind: 'route', route: '/system' });
    expect(partLinkOf(part('LINK'))).toEqual({ kind: 'unreadable' });
    expect(partLinkOf("export default definePart({ note: '' });")).toEqual({ kind: 'none' });
  });
});

describe('badLinksOf', () => {
  it('passes the fixture, whose parts have no link, and links that exist in their shape', () => {
    expect(badLinksOf(resolveAcme(acme()))).toEqual([]);
    expect(
      problemsWith({
        'acme/elements/hero/hero.ts': "'src/app/hero.component.ts'",
        'acme/pages/home/home.ts': "{ route: '/' }",
      }),
    ).toEqual([]);
  });

  it('fails a component path that does not exist', () => {
    expect(problemsWith({ 'acme/elements/hero/hero.ts': "'src/app/gone.component.ts'" })).toEqual([
      'IMPLEMENTS-MISSING "src/app/gone.component.ts" does not exist - implements is a path from the repository root',
    ]);
  });

  it('fails a link in the wrong shape for its layer, or one it cannot read', () => {
    expect(
      problemsWith({
        'acme/elements/hero/hero.ts': "{ route: '/hero' }",
        'acme/pages/home/home.ts': "'src/app/hero.component.ts'",
        'acme/components/button/button.ts': "'src/app/hero.ts'",
        'acme/foundations/palette/palette.ts': 'LINK',
      }).map((line) => line.split(' ')[0]),
    ).toEqual(['IMPLEMENTS-SHAPE', 'IMPLEMENTS-SHAPE', 'IMPLEMENTS-SHAPE', 'IMPLEMENTS-SHAPE']);
  });
});
