import { readdirSync, readFileSync } from 'fs';
import { dirname, join, relative, resolve, sep } from 'path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const DESIGN_DIR = join(__dirname, 'lib', 'design');
const ALLOWED = [
  { file: join(__dirname, 'index.ts'), specifier: './lib/design' },
  { file: join(__dirname, 'lib', 'index.ts'), specifier: './design' },
];
const DESIGN_WRITE_HELPER = join(DESIGN_DIR, 'system', 'design-file.ts');

const isInside = (dir: string, path: string) => path === dir || path.startsWith(`${dir}${sep}`);

const sourceFiles = () =>
  (readdirSync(__dirname, { recursive: true }) as string[])
    .filter((name) => name.endsWith('.ts'))
    .map((name) => join(__dirname, name));

const relativeImportsOf = (file: string) =>
  ts
    .preProcessFile(readFileSync(file, 'utf8'), true, true)
    .importedFiles.map(({ fileName }) => fileName)
    .filter((specifier) => specifier.startsWith('.'))
    .map((specifier) => ({ specifier, target: resolve(dirname(file), specifier) }));

const offenders = (rows: { file: string; specifier: string }[]) =>
  rows.map(({ file, specifier }) => `${relative(__dirname, file)} -> ${specifier}`);

describe('the design boundary in libs/cli', () => {
  const files = sourceFiles();

  it('keeps every file outside lib/design from importing it, except the et design command wiring and the lib barrel', () => {
    const rows = files
      .filter((file) => !isInside(DESIGN_DIR, file))
      .flatMap((file) => relativeImportsOf(file).map((row) => ({ file, ...row })))
      .filter(({ target }) => isInside(DESIGN_DIR, target))
      .filter(
        ({ file, specifier }) => !ALLOWED.some((allowed) => allowed.file === file && allowed.specifier === specifier),
      );

    expect(offenders(rows)).toEqual([]);
  });

  it('sends every design write through design-file, so the write journal sees it', () => {
    const rows = files
      .filter((file) => isInside(DESIGN_DIR, file) && file !== DESIGN_WRITE_HELPER)
      .flatMap((file) => relativeImportsOf(file).map((row) => ({ file, ...row })))
      .filter(({ target }) => target === join(__dirname, 'lib', 'json-file'));

    expect(offenders(rows)).toEqual([]);
  });
});
