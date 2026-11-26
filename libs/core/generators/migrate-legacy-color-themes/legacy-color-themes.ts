import { Identifier, ImportDeclaration, ImportSpecifier, Node, Project, SourceFile, SyntaxKind } from 'ts-morph';

const CORE_PACKAGE = '@ethlete/core';
const LEGACY_PROVIDER = 'provideColorThemes';
const TAILWIND_4_PROVIDER = 'provideColorThemesWithTailwind4';
const SURFACE_PROVIDER = 'provideSurfaceThemesWithTailwind4';
const TAILWIND_3_HELPERS = ['createTailwindColorThemes', 'createTailwindCssVar', 'createTailwindRgbVar'];

export type LegacyColorThemesSite = {
  file: string;
  line: number;
  themes?: string;
  themesFrom?: string;
};

export type LegacyColorThemesHelperSite = {
  file: string;
  line: number;
  helper: string;
};

export type LegacyColorThemesResult = {
  changed: boolean;
  content: string;
  providerSites: LegacyColorThemesSite[];
  helperSites: LegacyColorThemesHelperSite[];
  providesSurfaceThemes: boolean;
};

const createProject = () =>
  new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      target: 99,
      module: 99,
    },
  });

const coreImports = (sourceFile: SourceFile) =>
  sourceFile.getImportDeclarations().filter((declaration) => declaration.getModuleSpecifierValue() === CORE_PACKAGE);

const namespaceNames = (imports: ImportDeclaration[]) =>
  imports.flatMap((declaration) => {
    const namespace = declaration.getNamespaceImport();

    return namespace ? [namespace.getText()] : [];
  });

const isNamespaceMember = (identifier: Identifier, namespaces: string[]) => {
  const parent = identifier.getParent();

  return (
    Node.isPropertyAccessExpression(parent) &&
    parent.getNameNode() === identifier &&
    namespaces.includes(parent.getExpression().getText())
  );
};

const isBareReference = (identifier: Identifier) => {
  const parent = identifier.getParent();

  if (Node.isImportSpecifier(parent)) return false;
  if (Node.isPropertyAccessExpression(parent) && parent.getNameNode() === identifier) return false;
  if (Node.isPropertyAssignment(parent) && parent.getNameNode() === identifier) return false;
  if (Node.isPropertyDeclaration(parent) || Node.isMethodDeclaration(parent)) return false;

  return true;
};

const localNameOf = (specifier: ImportSpecifier) => (specifier.getAliasNode() ?? specifier.getNameNode()).getText();

const importSourceOf = (sourceFile: SourceFile, name: string) =>
  sourceFile
    .getImportDeclarations()
    .find((declaration) => declaration.getNamedImports().some((specifier) => localNameOf(specifier) === name))
    ?.getModuleSpecifierValue();

const collectProviderSite = (filePath: string, sourceFile: SourceFile, identifier: Identifier) => {
  const reference = Node.isPropertyAccessExpression(identifier.getParent()) ? identifier.getParent()! : identifier;
  const call = reference.getParent();
  const site: LegacyColorThemesSite = { file: filePath, line: identifier.getStartLineNumber() };

  if (Node.isCallExpression(call) && call.getExpression() === reference) {
    const [argument] = call.getArguments();

    if (argument) {
      site.themes = argument.getText();

      if (Node.isIdentifier(argument)) site.themesFrom = importSourceOf(sourceFile, argument.getText());
    }
  }

  return site;
};

/**
 * Rewrites `provideColorThemes(X)` from `@ethlete/core` into `provideColorThemesWithTailwind4(X)`, fixing the
 * import, and reports the sites plus the Tailwind 3 helpers that still need the Tailwind 4 setup by hand.
 */
export const migrateLegacyColorThemesInFile = (filePath: string, content: string): LegacyColorThemesResult => {
  const unchanged = { changed: false, content, providerSites: [], helperSites: [], providesSurfaceThemes: false };

  if (!content.includes(CORE_PACKAGE)) return unchanged;

  const sourceFile = createProject().createSourceFile(filePath, content);
  const imports = coreImports(sourceFile);

  if (imports.length === 0) return unchanged;

  const namespaces = namespaceNames(imports);
  const specifiers = imports.flatMap((declaration) => declaration.getNamedImports());
  const specifierOf = (name: string) => specifiers.find((specifier) => specifier.getNameNode().getText() === name);
  const importedName = (name: string) => {
    const specifier = specifierOf(name);

    return specifier ? localNameOf(specifier) : undefined;
  };

  const helperSites: LegacyColorThemesHelperSite[] = TAILWIND_3_HELPERS.flatMap((helper) => {
    const local = importedName(helper);

    return sourceFile
      .getDescendantsOfKind(SyntaxKind.Identifier)
      .filter(
        (identifier) =>
          (local !== undefined && identifier.getText() === local && isBareReference(identifier)) ||
          (identifier.getText() === helper && isNamespaceMember(identifier, namespaces)),
      )
      .map((identifier) => ({ file: filePath, line: identifier.getStartLineNumber(), helper }));
  });

  const providesSurfaceThemes =
    importedName(SURFACE_PROVIDER) !== undefined ||
    sourceFile
      .getDescendantsOfKind(SyntaxKind.Identifier)
      .some((identifier) => identifier.getText() === SURFACE_PROVIDER && isNamespaceMember(identifier, namespaces));

  const legacySpecifier = specifierOf(LEGACY_PROVIDER);
  const legacyLocal = legacySpecifier ? localNameOf(legacySpecifier) : undefined;
  const isAliased = legacySpecifier?.getAliasNode() !== undefined;
  const references = sourceFile
    .getDescendantsOfKind(SyntaxKind.Identifier)
    .filter(
      (identifier) =>
        (identifier.getText() === legacyLocal && isBareReference(identifier)) ||
        (identifier.getText() === LEGACY_PROVIDER && isNamespaceMember(identifier, namespaces)),
    );

  if (!legacySpecifier && references.length === 0) {
    return { ...unchanged, helperSites, providesSurfaceThemes };
  }

  const providerSites = references.map((identifier) => collectProviderSite(filePath, sourceFile, identifier));
  const renamed = references.filter((identifier) => !isAliased || identifier.getText() !== legacyLocal);

  for (const identifier of renamed.reverse()) {
    const parent = identifier.getParent();

    if (Node.isShorthandPropertyAssignment(parent)) {
      parent.replaceWithText(`${identifier.getText()}: ${TAILWIND_4_PROVIDER}`);
    } else if (Node.isExportSpecifier(parent) && !parent.getAliasNode()) {
      parent.replaceWithText(`${TAILWIND_4_PROVIDER} as ${identifier.getText()}`);
    } else {
      identifier.replaceWithText(TAILWIND_4_PROVIDER);
    }
  }

  if (legacySpecifier) {
    if (!isAliased && importedName(TAILWIND_4_PROVIDER) === TAILWIND_4_PROVIDER) {
      const declaration = legacySpecifier.getImportDeclaration();

      legacySpecifier.remove();

      if (declaration.getNamedImports().length === 0 && !declaration.getDefaultImport()) declaration.remove();
    } else {
      legacySpecifier.setName(TAILWIND_4_PROVIDER);
    }
  }

  return { changed: true, content: sourceFile.getFullText(), providerSites, helperSites, providesSurfaceThemes };
};
