import { Node, Project, SyntaxKind } from 'ts-morph';

export type SemanticColorThemeInjectsFinding = {
  line: number;
  reason: string;
  text: string;
};

export type SemanticColorThemeInjectsResult = {
  changed: boolean;
  content: string;
  findings: SemanticColorThemeInjectsFinding[];
};

const RETIRED_INJECTS: Record<string, string> = {
  injectErrorTheme: 'error',
  injectWarningTheme: 'warning',
  injectSuccessTheme: 'success',
};

const REPLACEMENT = 'injectSemanticColorTheme';

/**
 * Rewrites `injectErrorTheme()`, `injectWarningTheme()` and `injectSuccessTheme()` imported from `@ethlete/core`
 * into `injectSemanticColorTheme('<type>')()`, which keeps the `ColorTheme` value the call site had. Reports
 * every use that is not a plain call.
 */
export const migrateSemanticColorThemeInjectsInFile = (
  filePath: string,
  content: string,
): SemanticColorThemeInjectsResult => {
  const findings: SemanticColorThemeInjectsFinding[] = [];

  if (!Object.keys(RETIRED_INJECTS).some((name) => content.includes(name))) {
    return { changed: false, content, findings };
  }

  const sourceFile = new Project({ useInMemoryFileSystem: true }).createSourceFile(filePath, content);
  const localTypes = new Map<string, string>();
  let replacementName: string | undefined;

  for (const declaration of sourceFile.getImportDeclarations()) {
    if (!declaration.getModuleSpecifierValue().startsWith('@ethlete/core')) continue;

    for (const specifier of declaration.getNamedImports()) {
      const type = RETIRED_INJECTS[specifier.getName()];

      if (specifier.getName() === REPLACEMENT) replacementName = specifier.getAliasNode()?.getText() ?? REPLACEMENT;
      if (type) localTypes.set(specifier.getAliasNode()?.getText() ?? specifier.getName(), type);
    }
  }

  if (localTypes.size === 0) return { changed: false, content, findings };

  const injectName = replacementName ?? REPLACEMENT;
  const references = sourceFile
    .getDescendantsOfKind(SyntaxKind.Identifier)
    .filter(
      (identifier) =>
        localTypes.has(identifier.getText()) && !identifier.getFirstAncestorByKind(SyntaxKind.ImportDeclaration),
    );

  for (const identifier of references.reverse()) {
    if (identifier.wasForgotten()) continue;

    const call = identifier.getParent();
    const type = localTypes.get(identifier.getText());

    if (
      call &&
      Node.isCallExpression(call) &&
      call.getExpression() === identifier &&
      call.getArguments().length === 0
    ) {
      call.replaceWithText(`${injectName}('${type}')()`);
      continue;
    }

    findings.push({
      line: identifier.getStartLineNumber(),
      reason: `${identifier.getText()} is removed; call ${REPLACEMENT}('${type}') here by hand (it returns a signal)`,
      text: identifier.getParent()?.getText().split('\n')[0] ?? identifier.getText(),
    });
  }

  if (findings.length > 0) return { changed: false, content, findings };

  for (const declaration of sourceFile.getImportDeclarations()) {
    if (!declaration.getModuleSpecifierValue().startsWith('@ethlete/core')) continue;

    const retired = declaration.getNamedImports().filter((specifier) => RETIRED_INJECTS[specifier.getName()]);

    if (retired.length === 0) continue;

    if (!replacementName) {
      declaration.addNamedImport(REPLACEMENT);
      replacementName = REPLACEMENT;
    }

    retired.forEach((specifier) => specifier.remove());
  }

  const next = sourceFile.getFullText();

  return { changed: next !== content, content: next, findings };
};
