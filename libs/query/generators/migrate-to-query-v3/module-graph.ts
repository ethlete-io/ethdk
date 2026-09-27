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
   * alias). `null` means "cannot prove it is ours".
   */
  findDeclaringFile: (fromFile: string, specifier: string, symbolName: string) => string | null;

  /** The workspace file `specifier` points at from `fromFile`, or `null` outside the workspace. */
  resolveFile: (fromFile: string, specifier: string) => string | null;

  /** The `compilerOptions.paths` keys of the workspace tsconfig. */
  pathAliases: () => string[];

  /** Whether `specifier` is relative or matches a workspace tsconfig path alias. */
  isWorkspaceSpecifier: (specifier: string) => boolean;
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

const readTsConfig = (tree: Tree) => {
  const paths = new Map<string, string[]>();
  let baseUrl: string | null = null;

  for (const configPath of ['tsconfig.base.json', 'tsconfig.json']) {
    const raw = tree.read(configPath, 'utf-8');

    if (!raw) continue;

    try {
      // tsconfig files are JSONC in practice; the TS parser is the only thing that reliably reads
      // them, comments and trailing commas included.
      const parsed = ts.parseConfigFileTextToJson(configPath, raw).config as
        { compilerOptions?: { paths?: Record<string, string[]>; baseUrl?: string } } | undefined;

      const configBaseUrl = parsed?.compilerOptions?.baseUrl;

      if (baseUrl === null && typeof configBaseUrl === 'string') baseUrl = normalizePath(configBaseUrl);

      Object.entries(parsed?.compilerOptions?.paths ?? {}).forEach(([key, targets]) => {
        if (!paths.has(key)) paths.set(key, targets);
      });
    } catch {
      // A tsconfig we cannot parse just means fewer resolvable aliases, not a failed migration.
    }
  }

  return { paths, baseUrl };
};

/** The part of `specifier` the `*` of `pattern` stands for, `''` for an exact match, or `null`. */
const matchPathAlias = (pattern: string, specifier: string) => {
  const wildcardIndex = pattern.indexOf('*');

  if (wildcardIndex === -1) return pattern === specifier ? '' : null;

  const prefix = pattern.slice(0, wildcardIndex);
  const patternSuffix = pattern.slice(wildcardIndex + 1);

  if (!specifier.startsWith(prefix) || !specifier.endsWith(patternSuffix)) return null;

  return specifier.slice(prefix.length, specifier.length - patternSuffix.length);
};

const JS_EXTENSION = /\.(m?)js$/;

/** The files a specifier could point at, most specific first. */
const candidateFiles = (base: string) => {
  if (base.endsWith('.ts')) return [base];

  const jsExtension = JS_EXTENSION.exec(base);

  if (jsExtension) {
    const stem = base.slice(0, -jsExtension[0].length);

    return [`${stem}.${jsExtension[1]}ts`, `${stem}.ts`, `${stem}.d.ts`, `${base}/index.ts`];
  }

  return [`${base}.ts`, `${base}/index.ts`, `${base}.d.ts`];
};

export const createModuleGraph = (tree: Tree): ModuleGraph => {
  const { paths: tsConfigPaths, baseUrl } = readTsConfig(tree);
  const findCandidate = (base: string) => candidateFiles(base).find((candidate) => tree.exists(candidate)) ?? null;
  const declaringFileCache = new Map<string, string | null>();

  const resolveEntryFile = (fromFile: string, specifier: string) => {
    if (specifier.startsWith('.')) return findCandidate(normalizePath(`${dirName(fromFile)}/${specifier}`));

    for (const [pattern, targets] of tsConfigPaths.entries()) {
      const wildcard = matchPathAlias(pattern, specifier);

      if (wildcard === null) continue;

      for (const target of targets) {
        const candidate = findCandidate(normalizePath(`${baseUrl ?? ''}/${target.replace('*', wildcard)}`));

        if (candidate) return candidate;
      }
    }

    return baseUrl === null ? null : findCandidate(normalizePath(`${baseUrl}/${specifier}`));
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
    resolveFile: resolveEntryFile,
    pathAliases: () => [...tsConfigPaths.keys()],
    isWorkspaceSpecifier: (specifier) =>
      specifier.startsWith('.') ||
      [...tsConfigPaths.keys()].some((pattern) => matchPathAlias(pattern, specifier) !== null),
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
