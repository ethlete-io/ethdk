import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { uncoveredViewsOf, uncoveredViewsText } from './view-coverage';

const HARNESS = { app: 'apps/acme', map: 'apps/acme/src/app/harness-parts.ts' };

const touch = (path: string, content = '') => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
};

const acme = (options: { harness: boolean; parts: Record<string, string> }) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-views-'));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });
  touch(join(target, 'apps/acme/src/app/home/home-view.component.ts'));
  touch(join(target, 'apps/acme/src/app/system/system-view.component.ts'));
  touch(join(target, 'apps/acme/src/app/system/tree.component.ts'));

  for (const [path, link] of Object.entries(options.parts))
    touch(
      join(target, DESIGN_DIR, path),
      `import { definePart } from '@design-system';\nexport default definePart({ note: '', implements: ${link}, states: {}, render: () => ({ body: '', styles: '' }) });\n`,
    );

  const config = readConfig(target)?.products?.['acme'] ?? {};

  return resolveProduct({ target, name: 'acme', config: options.harness ? { ...config, harness: HARNESS } : config });
};

describe('uncoveredViewsOf', () => {
  it('lists every view of the harness app no part implements', () => {
    expect(uncoveredViewsOf(acme({ harness: true, parts: {} }))).toEqual([
      'apps/acme/src/app/home/home-view.component.ts',
      'apps/acme/src/app/system/system-view.component.ts',
    ]);
  });

  it('counts a page route component and a plain component path as covering a view', () => {
    expect(
      uncoveredViewsOf(
        acme({
          harness: true,
          parts: {
            'acme/pages/home/home.ts': "{ route: '/', component: 'apps/acme/src/app/home/home-view.component.ts' }",
          },
        }),
      ),
    ).toEqual(['apps/acme/src/app/system/system-view.component.ts']);
    expect(
      uncoveredViewsOf(
        acme({
          harness: true,
          parts: { 'acme/elements/system/system.ts': "'apps/acme/src/app/system/system-view.component.ts'" },
        }),
      ),
    ).toEqual(['apps/acme/src/app/home/home-view.component.ts']);
  });

  it('has no views without a harness app', () => {
    expect(uncoveredViewsOf(acme({ harness: false, parts: {} }))).toEqual([]);
  });
});

describe('uncoveredViewsText', () => {
  it('prints a count line and one line per view, and nothing when all are covered', () => {
    expect(uncoveredViewsText('acme', ['apps/acme/src/app/a-view.component.ts'])).toEqual([
      'OPEN POINTS acme views: 1 without a part that implements it',
      '  apps/acme/src/app/a-view.component.ts',
    ]);
    expect(uncoveredViewsText('acme', [])).toEqual([]);
  });
});
