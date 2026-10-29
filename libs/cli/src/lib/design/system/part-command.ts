import { readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, isAbsolute, relative, resolve } from 'path';
import ts from 'typescript';
import { listComments, resolveComment } from './comments/comment';
import { partDependenciesOf } from './imports';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { argsOf, authorOf, configOf, NEEDS_AUTHOR, oneProductOf } from './sketch/cli-args';
import { MERGED_FILE, readMerged } from './sketch/merged-parts';
import { listSketches, parseTarget } from './sketch/sketch';
import { writeEditorTsconfig } from './system-tsconfig';

export const PART_USAGE = 'part remove <layer>/<name> --by <model id> [--product <name>]';

const sourceImportsOf = (target: string, folder: string) => {
  const hits: string[] = [];
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (
        entry.name.startsWith('.') ||
        ['node_modules', 'dist', 'build', 'coverage', 'docs', 'generated'].includes(entry.name)
      )
        continue;
      const file = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        visit(file);
        continue;
      }
      if (!entry.isFile() || !/\.(?:[cm]?[jt]sx?|css|scss)$/u.test(entry.name)) continue;
      const source = readFileSync(file, 'utf8');
      const imports = /\.(?:css|scss)$/u.test(entry.name)
        ? [
            ...source
              .replace(/\/\*[\s\S]*?\*\//gu, (comment) => comment.replace(/[^\n]/gu, ' '))
              .matchAll(/@(?:import|use|forward)\s+(?:url\(\s*)?["']([^"']+)["']/gu),
          ].map((match) => ({
            fileName: match[1],
            pos: match.index,
          }))
        : ts.preProcessFile(source, true, true).importedFiles;
      for (const imported of imports) {
        const specifier = imported.fileName?.split('?')[0];
        if (!specifier) continue;
        const path = specifier.startsWith('.') ? resolve(dirname(file), specifier) : resolve(target, specifier);
        const inside = relative(folder, path);
        if (inside.startsWith('..') || isAbsolute(inside)) continue;
        const line = source.slice(0, imported.pos).split('\n').length;
        hits.push(`${relative(target, file)}:${line}`);
      }
    }
  };
  visit(target);
  return hits;
};

const removalProblemOf = ({ target, product, key }: { target: string; product: ResolvedProduct; key: string }) => {
  const part = product.parts.find((candidate) => partKeyOf(candidate) === key);

  if (!part) return `NO PART "${key}" in ${product.name}`;
  if (part.origin === 'base') return `${key} comes from the base product - remove it there`;

  const sketch = listSketches({ productDir: product.dir, product: product.name }).find(
    (candidate) => typeof candidate !== 'string' && candidate.target === key,
  );

  if (sketch) return `${key} has an open sketch - merge or discard it first`;

  const importers = product.parts
    .filter((candidate) => partDependenciesOf(candidate).some((dependency) => partKeyOf(dependency) === key))
    .map(partKeyOf);

  if (importers.length > 0) return `${key} is imported by ${importers.join(', ')} - remove those imports first`;

  const sourceImports = sourceImportsOf(target, dirname(part.file));

  if (sourceImports.length > 0) return `${key} is imported by ${sourceImports.join(', ')} - remove those imports first`;

  return null;
};

const forgetMerged = (productDir: string, key: string) => {
  const merged = readMerged(productDir);

  if (merged[key] === undefined) return;

  delete merged[key];
  writeFileSync(resolve(productDir, MERGED_FILE), `${JSON.stringify(merged, null, 2)}\n`);
};

/** `et design part remove <layer>/<name> …` deletes a part of a product with its `merged.json` entry, and resolves its comments. */
export const designPart = (options: { target: string; argv: string[]; invocation: string }) => {
  const { target, argv, invocation } = options;
  const usage = `usage: ${invocation} ${PART_USAGE}`;
  const args = argsOf(argv.slice(1), ['--product', '--by']);

  if (argv[0] !== 'remove' || typeof args === 'string' || args.positional.length !== 1 || authorOf(args) === null) {
    if (typeof args === 'string') console.error(args);
    else if (argv[0] === 'remove' && authorOf(args) === null) console.error(`part remove ${NEEDS_AUTHOR}`);

    console.error(usage);

    return 2;
  }

  const config = configOf(target);
  const parsed = typeof config === 'string' ? config : parseTarget(args.positional[0]);

  if (typeof config === 'string' || typeof parsed === 'string') {
    console.error(parsed);

    return 1;
  }

  const product = oneProductOf({ target, config, asked: args.values['--product'] });

  if (typeof product === 'string') {
    console.error(product);

    return 1;
  }

  const key = partKeyOf(parsed);
  const problem = removalProblemOf({ target, product, key });

  if (problem) {
    console.error(problem);

    return 1;
  }

  const part = product.parts.find((candidate) => partKeyOf(candidate) === key);

  if (part) rmSync(dirname(part.file), { recursive: true, force: true });

  forgetMerged(product.dir, key);

  const after = oneProductOf({ target, config, asked: product.name });

  if (typeof after !== 'string') writeEditorTsconfig({ target, product: after });

  const comments = listComments({ productDir: product.dir, product: product.name }).comments.filter(
    (comment) => comment.part === key,
  );

  for (const comment of comments)
    resolveComment({
      products: [{ name: product.name, dir: product.dir }],
      id: comment.id,
      note: `${key} removed by ${authorOf(args)}`,
    });

  console.log(`removed ${key} from ${product.name}, resolved ${comments.length} comment(s)`);

  return 0;
};
