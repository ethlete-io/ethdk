import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const [product, outDir] = process.argv.slice(2);

if (!product || !outDir) {
  console.error('Usage: node tools/scripts/stage-design-base.mjs <product> <out-dir>');
  process.exit(1);
}

const designDir = join(root, '.ethlete/design');
const config = JSON.parse(readFileSync(join(designDir, 'config.json'), 'utf8'));
const entry = config.products?.[product];

if (!entry) {
  console.error(`.ethlete/design/config.json declares no product "${product}"`);
  process.exit(1);
}

const sourceDir = join(designDir, product);
const workspaceOnly = new Set(['tsconfig.json', 'merged.json', 'sketches', 'comments']);
const target = join(root, outDir);
const notShipped = new Set([
  'foundations/colors/symbol-faces.css',
  'assets/fonts/noto-sans-math-latin-400-normal.woff2',
  'assets/fonts/noto-sans-symbols-2-symbols-400-normal.woff2',
]);

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(sourceDir, join(target, product), {
  recursive: true,
  filter: (path) => {
    const rel = relative(sourceDir, path);

    return (
      !workspaceOnly.has(rel.split(/[\\/]/)[0]) && !(product === 'sdk' && notShipped.has(rel.split(sep).join('/')))
    );
  },
});
writeFileSync(join(target, 'config.json'), `${JSON.stringify({ products: { [product]: entry } }, null, 2)}\n`);
