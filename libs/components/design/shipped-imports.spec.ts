import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, matchesGlob, relative } from 'node:path';

type Asset = string | { glob: string; input: string; output: string; ignore?: string[] };

const libRoot = join(__dirname, '..');
const designDir = join(libRoot, 'design');

const assets = (JSON.parse(readFileSync(join(libRoot, 'ng-package.json'), 'utf8')) as { assets: Asset[] }).assets;

const isShipped = (fromLibRoot: string) =>
  assets.some((asset) => {
    if (typeof asset === 'string') return asset === fromLibRoot;
    const inAsset = relative(asset.input, fromLibRoot);
    if (inAsset.startsWith('..')) return false;
    if (asset.ignore?.some((pattern) => matchesGlob(inAsset, pattern))) return false;

    return matchesGlob(inAsset, asset.glob);
  });

const withExtension = (path: string) => (/\.(css|ts)$/.test(path) ? path : `${path}.ts`);

const srcImportsOf = (file: string) =>
  [...readFileSync(join(designDir, file), 'utf8').matchAll(/from '(\.\.\/src\/[^'?]+)/g)].map((match) =>
    withExtension(relative(libRoot, join(dirname(join(designDir, file)), match[1] as string))),
  );

describe('design mocks', () => {
  const imports = readdirSync(designDir)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    .flatMap((file) => srcImportsOf(file).map((target) => ({ file, target })));

  it('import from src', () => {
    expect(imports.length).toBeGreaterThan(0);
  });

  it.each(imports)('ship $target, imported by $file', ({ target }) => {
    expect(isShipped(target)).toBe(true);
  });
});
