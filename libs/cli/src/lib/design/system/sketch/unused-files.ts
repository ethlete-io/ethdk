import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, relative, resolve, sep } from 'path';
import { ASSETS_FOLDER } from '../assets';
import { classifyImport, SHARED_PREFIX } from '../imports';
import { fixturesOf, partFilesOf } from '../product';
import { unusedExportsOf } from '../rules/unused-shared-export';
import { importsOf } from '../ts-source';
import { SHARED_FOLDER, Sketch, variantDirOf } from './sketch';

const CODE = /\.(?:ts|css)$/u;

const codeFilesIn = (dir: string) =>
  (readdirSync(dir, { recursive: true }) as string[])
    .filter((path) => CODE.test(path) && path.split(sep)[0] !== ASSETS_FOLDER && path.split(sep)[0] !== SHARED_FOLDER)
    .map((path) => resolve(dir, path));

const candidatesOf = (path: string) => [path, `${path}.ts`, resolve(path, 'index.ts')];

/**
 * A warning for each `.ts` or `.css` file of a variant that no part file, fixture or other file of the variant
 * imports.
 */
export const unusedFileWarningsOf = (options: { target: string; sketch: Sketch; variant: string }): string[] => {
  const { target, sketch, variant } = options;
  const dir = variantDirOf(sketch, variant);

  if (!existsSync(dir)) return [];

  const files = codeFilesIn(dir);
  const { parts } = partFilesOf(dir);
  const used = new Set<string>([
    ...parts.flatMap((part) => [part.file, ...(part.css ? [part.css] : [])]),
    ...(fixturesOf(dir) ? [fixturesOf(dir) as string] : []),
  ]);

  for (const file of files.filter((path) => path.endsWith('.ts')))
    for (const specifier of importsOf(readFileSync(file, 'utf8')))
      if (classifyImport(specifier).kind === 'relative')
        candidatesOf(resolve(dirname(file), specifier.split('?')[0] ?? specifier)).forEach((path) => used.add(path));

  const sharedDir = resolve(sketch.dir, SHARED_FOLDER);
  const unusedExports = unusedExportsOf({
    sharedDir,
    importers: files.filter((path) => path.endsWith('.ts')),
    resolveSpecifier: ({ file, specifier }) =>
      specifier.startsWith(SHARED_PREFIX)
        ? resolve(sharedDir, specifier.slice(SHARED_PREFIX.length))
        : specifier.startsWith('.')
          ? resolve(dirname(file), specifier)
          : null,
    scope: `in variant ${variant}`,
  });

  return [
    ...files
      .filter((file) => !used.has(file))
      .map(
        (file) =>
          `WARNING ${relative(target, file)}: nothing in variant ${variant} imports it - delete it, or a merge takes it into the product`,
      ),
    ...unusedExports.map((problem) => `WARNING ${relative(target, problem.file)}: ${problem.message}`),
  ];
};
