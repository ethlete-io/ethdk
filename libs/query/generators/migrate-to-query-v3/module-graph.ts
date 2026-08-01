import { Tree } from '@nx/devkit';
import * as ts from 'typescript';
import { createSourceFile } from './shared.js';

/**
 * Resolves import specifiers to workspace files and follows barrels to the file a symbol is
 * actually declared in.
 *
 * The generator renames identifiers, and a rename that only matches on the *name* rewrites anything
 * that happens to share it - a data-source method called `getPerson`, a config property called
 * `postLogin`, an unrelated `getCampaigns` helper in a package that has no query client at all.
 * Knowing where a name comes from is what makes the difference between renaming a symbol and
 * renaming a string.
 */
export type ModuleGraph = {
  /**
   * The file that declares `symbolName` when imported from `specifier` in `fromFile`, or `null`
   * when the specifier does not resolve inside the workspace (an npm package, a missing path
   * alias). `null` means "cannot prove it is ours" - callers should leave such an import alone.
   */
  findDeclaringFile: (fromFile: string, specifier: string, symbolName: string) => string | null;
};

const MAX_BARREL_DEPTH = 8;

const normalizePath = (path: string) => {
  const segments: string[] = [];

  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') continue;

    if (segment === '..') {
      segments.pop();
      continue;
    }

    segments.push(segment);
  }

  return segments.join('/');
};

const dirName = (path: string) => path.slice(0, Math.max(0, path.lastIndexOf('/')));

const readTsConfigPaths = (tree: Tree) => {
  const paths = new Map<string, string[]>();

  for (const configPath of ['tsconfig.base.json', 'tsconfig.json']) {
    const raw = tree.read(configPath, 'utf-8');

    if (!raw) continue;

    try {
      // tsconfig files are JSONC in practice; the TS parser is the only thing that reliably reads
      // them, comments and trailing commas included.
      const parsed = ts.parseConfigFileTextToJson(configPath, raw).config as
        { compilerOptions?: { paths?: Record<string, string[]> } } | undefined;

      Object.entries(parsed?.compilerOptions?.paths ?? {}).forEach(([key, targets]) => {
        if (!paths.has(key)) paths.set(key, targets);
      });
    } catch {
      // A tsconfig we cannot parse just means fewer resolvable aliases, not a failed migration.
    }
  }

  return paths;
};

/** The files a specifier could point at, most specific first. */
const candidateFiles = (base: string) => [
  base.endsWith('.ts') ? base : `${base}.ts`,
  `${base}/index.ts`,
  `${base}.d.ts`,
];

export const createModuleGraph = (tree: Tree): ModuleGraph => {
  const tsConfigPaths = readTsConfigPaths(tree);
  const declaringFileCache = new Map<string, string | null>();

  const resolveEntryFile = (fromFile: string, specifier: string) => {
    if (specifier.startsWith('.')) {
      const base = normalizePath(`${dirName(fromFile)}/${specifier}`);

      return candidateFiles(base).find((candidate) => tree.exists(candidate)) ?? null;
    }

    for (const [pattern, targets] of tsConfigPaths.entries()) {
      const wildcardIndex = pattern.indexOf('*');

      let suffix: string;

      if (wildcardIndex === -1) {
        if (pattern !== specifier) continue;

        suffix = '';
      } else {
        const prefix = pattern.slice(0, wildcardIndex);
        const patternSuffix = pattern.slice(wildcardIndex + 1);

        if (!specifier.startsWith(prefix) || !specifier.endsWith(patternSuffix)) continue;

        suffix = specifier.slice(prefix.length, specifier.length - patternSuffix.length);
      }

      for (const target of targets) {
        const resolvedTarget = normalizePath(target.replace('*', suffix));
        const candidate = candidateFiles(resolvedTarget).find((option) => tree.exists(option));

        if (candidate) return candidate;
      }
    }

    return null;
  };

  const declaresSymbol = (sourceFile: ts.SourceFile, symbolName: string) => {
    let declares = false;

    const isExported = (node: ts.Node) =>
      ts.canHaveModifiers(node) &&
      ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);

    ts.forEachChild(sourceFile, (node) => {
      if (declares) return;

      if (ts.isVariableStatement(node) && isExported(node)) {
        declares = node.declarationList.declarations.some(
          (declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === symbolName,
        );

        return;
      }

      if (
        (ts.isFunctionDeclaration(node) ||
          ts.isClassDeclaration(node) ||
          ts.isInterfaceDeclaration(node) ||
          ts.isTypeAliasDeclaration(node) ||
          ts.isEnumDeclaration(node)) &&
        isExported(node) &&
        node.name?.text === symbolName
      ) {
        declares = true;
      }
    });

    return declares;
  };

  const findDeclaringFileIn = (
    entryFile: string,
    symbolName: string,
    depth: number,
    seen: Set<string>,
  ): string | null => {
    if (depth > MAX_BARREL_DEPTH || seen.has(`${entryFile}#${symbolName}`)) return null;

    seen.add(`${entryFile}#${symbolName}`);

    const content = tree.read(entryFile, 'utf-8');

    if (!content) return null;

    const sourceFile = createSourceFile(content, entryFile);

    if (declaresSymbol(sourceFile, symbolName)) return entryFile;

    const starExports: string[] = [];

    for (const node of sourceFile.statements) {
      if (!ts.isExportDeclaration(node) || !node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) {
        continue;
      }

      const nextEntry = resolveEntryFile(entryFile, node.moduleSpecifier.text);

      if (!nextEntry) continue;

      if (!node.exportClause) {
        starExports.push(nextEntry);
        continue;
      }

      if (!ts.isNamedExports(node.exportClause)) continue;

      for (const element of node.exportClause.elements) {
        if (element.name.text !== symbolName) continue;

        const originalName = element.propertyName?.text ?? symbolName;
        const found = findDeclaringFileIn(nextEntry, originalName, depth + 1, seen);

        if (found) return found;
      }
    }

    for (const starExport of starExports) {
      const found = findDeclaringFileIn(starExport, symbolName, depth + 1, seen);

      if (found) return found;
    }

    return null;
  };

  return {
    findDeclaringFile: (fromFile, specifier, symbolName) => {
      const cacheKey = `${fromFile}|${specifier}|${symbolName}`;
      const cached = declaringFileCache.get(cacheKey);

      if (cached !== undefined) return cached;

      const entryFile = resolveEntryFile(fromFile, specifier);
      const declaringFile = entryFile ? findDeclaringFileIn(entryFile, symbolName, 0, new Set()) : null;

      declaringFileCache.set(cacheKey, declaringFile);

      return declaringFile;
    },
  };
};
