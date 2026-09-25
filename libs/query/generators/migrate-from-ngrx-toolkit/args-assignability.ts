import { Tree } from '@nx/devkit';
import { dirname } from 'node:path';
import * as ts from 'typescript';
import { ModuleGraph } from '../migrate-to-query-v3/module-graph.js';

const TOOLKIT_PROBE = '__EtToolkitArgs';
const CREATOR_PROBE = '__EtCreatorArgs';
const PROBE_FILE = '/__et_args_probe__.ts';
const MAX_DEPTH = 12;

const PROBE_SOURCE = `
import type { ${TOOLKIT_PROBE} as ToolkitArgs } from '__toolkit__';
import type { ${CREATOR_PROBE} as CreatorArgs } from '__creator__';

type OptionalNullAsUndefined<T> = {
  [K in keyof T]: undefined extends T[K] ? OptionalNullAsUndefined<Exclude<T[K], null>> : OptionalNullAsUndefined<T[K]>;
};

export type ToolkitSide = OptionalNullAsUndefined<{
  [K in keyof ToolkitArgs as K extends 'params' ? 'queryParams' : K extends 'body' ? K : never]: ToolkitArgs[K];
}>;
export type CreatorSide = OptionalNullAsUndefined<{
  [K in keyof CreatorArgs as K extends 'queryParams' | 'body' ? K : never]: CreatorArgs[K];
}>;
`;

const COMPILER_OPTIONS: ts.CompilerOptions = {
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ['lib.es2022.d.ts'],
  types: [],
};

const toTreePath = (fileName: string) => fileName.replace(/^\//, '');

const containsAny = (checker: ts.TypeChecker, type: ts.Type, seen: Set<ts.Type>, depth: number): boolean => {
  if (type.flags & ts.TypeFlags.Any) return true;
  if (seen.has(type) || depth > MAX_DEPTH) return false;

  seen.add(type);

  if (type.isUnionOrIntersection()) return type.types.some((part) => containsAny(checker, part, seen, depth + 1));

  if (!(type.flags & ts.TypeFlags.Object)) return false;

  const typeArguments =
    (type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference
      ? checker.getTypeArguments(type as ts.TypeReference)
      : [];

  return (
    typeArguments.some((argument) => containsAny(checker, argument, seen, depth + 1)) ||
    checker
      .getPropertiesOfType(type)
      .some((property) => containsAny(checker, checker.getTypeOfSymbol(property), seen, depth + 1))
  );
};

const isRecord = (checker: ts.TypeChecker, type: ts.Type) =>
  (type.isIntersection() ? type.types : [type]).every((part) => !!(part.flags & ts.TypeFlags.Object)) &&
  !checker.isArrayType(type) &&
  !checker.isTupleType(type) &&
  checker.getSignaturesOfType(type, ts.SignatureKind.Call).length === 0;

const hasEveryKey = (
  checker: ts.TypeChecker,
  source: ts.Type,
  target: ts.Type,
  seen: Set<ts.Type>,
  depth: number,
): boolean => {
  const from = checker.getNonNullableType(source);
  const to = checker.getNonNullableType(target);

  if (seen.has(from) || depth > MAX_DEPTH || !isRecord(checker, from) || !isRecord(checker, to)) return true;

  seen.add(from);

  return checker.getPropertiesOfType(from).every((property) => {
    const counterpart = checker.getPropertyOfType(to, property.name);

    return (
      !!counterpart &&
      hasEveryKey(checker, checker.getTypeOfSymbol(property), checker.getTypeOfSymbol(counterpart), seen, depth + 1)
    );
  });
};

export const toolkitArgsFitCreator = (
  tree: Tree,
  graph: ModuleGraph,
  toolkit: { file: string; typeText: string | null },
  creator: { file: string; typeText: string | null },
) => {
  if (toolkit.file === creator.file) return false;

  const appended = new Map([
    [toolkit.file, `\nexport type ${TOOLKIT_PROBE} = ${toolkit.typeText ?? '{}'};\n`],
    [creator.file, `\nexport type ${CREATOR_PROBE} = ${creator.typeText ?? '{}'};\n`],
  ]);
  const libDirectory = dirname(ts.getDefaultLibFilePath(COMPILER_OPTIONS));

  const readFile = (fileName: string) => {
    if (fileName === PROBE_FILE) return PROBE_SOURCE;
    if (fileName.startsWith(libDirectory)) return ts.sys.readFile(fileName);

    const path = toTreePath(fileName);
    const content = tree.read(path, 'utf-8');

    return content === null ? undefined : content + (appended.get(path) ?? '');
  };
  const fileExists = (fileName: string) =>
    fileName === PROBE_FILE ||
    (fileName.startsWith(libDirectory) ? ts.sys.fileExists(fileName) : tree.isFile(toTreePath(fileName)));

  const resolutionHost = {
    fileExists,
    readFile,
    directoryExists: (name: string) => tree.exists(toTreePath(name)) && !tree.isFile(toTreePath(name)),
    getCurrentDirectory: () => '/',
  };

  const resolveOne = (name: string, containingFile: string): ts.ResolvedModuleFull | undefined => {
    const workspaceFile =
      containingFile === PROBE_FILE
        ? name === '__toolkit__'
          ? toolkit.file
          : name === '__creator__'
            ? creator.file
            : null
        : graph.resolveFile(toTreePath(containingFile), name);

    if (workspaceFile) return { resolvedFileName: `/${workspaceFile}`, extension: ts.Extension.Ts };

    return ts.resolveModuleName(name, containingFile, COMPILER_OPTIONS, resolutionHost).resolvedModule;
  };

  const host: ts.CompilerHost = {
    ...resolutionHost,
    getSourceFile: (fileName, languageVersion) => {
      const text = readFile(fileName);

      return text === undefined ? undefined : ts.createSourceFile(fileName, text, languageVersion, true);
    },
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    writeFile: () => undefined,
    getCanonicalFileName: (fileName) => fileName,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    resolveModuleNameLiterals: (literals, containingFile) =>
      literals.map((literal) => ({ resolvedModule: resolveOne(literal.text, containingFile) })),
  };

  const program = ts.createProgram({ rootNames: [PROBE_FILE], options: COMPILER_OPTIONS, host });
  const checker = program.getTypeChecker();
  const probe = program.getSourceFile(PROBE_FILE);
  const exportsOf = probe ? checker.getSymbolAtLocation(probe) : undefined;
  const typeOf = (name: string) => {
    const symbol = exportsOf ? checker.getExportsOfModule(exportsOf).find((each) => each.name === name) : undefined;

    return symbol ? checker.getDeclaredTypeOfSymbol(symbol) : null;
  };

  const toolkitSide = typeOf('ToolkitSide');
  const creatorSide = typeOf('CreatorSide');

  if (!toolkitSide || !creatorSide) return false;
  if (containsAny(checker, toolkitSide, new Set(), 0) || containsAny(checker, creatorSide, new Set(), 0)) return false;

  const keys = (type: ts.Type) =>
    checker
      .getPropertiesOfType(type)
      .map((property) => property.name)
      .sort()
      .join(',');

  return (
    keys(toolkitSide) === keys(creatorSide) &&
    checker.isTypeAssignableTo(toolkitSide, creatorSide) &&
    hasEveryKey(checker, toolkitSide, creatorSide, new Set(), 0)
  );
};
