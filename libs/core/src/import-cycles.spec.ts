import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { preProcessFile } from 'typescript';

const SRC_ROOT = __dirname;

const listSourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);

    if (statSync(path).isDirectory()) return listSourceFiles(path);

    return path.endsWith('.ts') && !path.endsWith('.d.ts') ? [path] : [];
  });

const resolveRelativeImport = (fromFile: string, specifier: string) => {
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [base, `${base}.ts`, join(base, 'index.ts')];

  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
};

const buildImportGraph = (files: string[]) =>
  new Map(
    files.map((file) => {
      const { importedFiles } = preProcessFile(readFileSync(file, 'utf8'), true, true);
      const targets = importedFiles
        .map(({ fileName }) => fileName)
        .filter((specifier) => specifier.startsWith('.'))
        .map((specifier) => resolveRelativeImport(file, specifier))
        .filter((target): target is string => target !== null);

      return [file, targets];
    }),
  );

const findCycles = (graph: Map<string, string[]>) => {
  const cycles: string[][] = [];
  const done = new Set<string>();
  const stack: string[] = [];
  const onStack = new Set<string>();

  const visit = (file: string) => {
    stack.push(file);
    onStack.add(file);

    for (const target of graph.get(file) ?? []) {
      if (onStack.has(target)) {
        cycles.push([...stack.slice(stack.indexOf(target)), target]);
      } else if (!done.has(target)) {
        visit(target);
      }
    }

    stack.pop();
    onStack.delete(file);
    done.add(file);
  };

  for (const file of graph.keys()) {
    if (!done.has(file)) visit(file);
  }

  return cycles;
};

describe('import cycles', () => {
  it('has no circular imports in libs/core/src', () => {
    const cycles = findCycles(buildImportGraph(listSourceFiles(SRC_ROOT))).map((cycle) =>
      cycle.map((file) => relative(SRC_ROOT, file)).join(' > '),
    );

    expect(cycles).toEqual([]);
  });
});
