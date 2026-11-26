import { Expression, Node, Project, SyntaxKind } from 'ts-morph';

export type RemoveSurfaceInteractiveFinding = {
  line: number;
  reason: string;
  text: string;
};

export type RemoveSurfaceInteractiveResult = {
  changed: boolean;
  content: string;
  findings: RemoveSurfaceInteractiveFinding[];
};

const SCRIPT_FILE = /\.(ts|tsx|js|mjs|cjs|jsx)$/;
const TEMPLATE_FILE = /\.html?$/;
const RETIRED_SYMBOLS = new Set(['SurfaceInteractiveDirective', 'SurfaceInteractiveStylesComponent']);
const ATTRIBUTE =
  /\s+(?:\[etSurfaceInteractive\]=(?:"[^"]*"|'[^']*')|etSurfaceInteractive(?:=(?:"[^"]*"|'[^']*'))?)(?=[\s/>])/gu;
const CLASS_ATTRIBUTE = /(\bclass=)(["'])([^"']*)\2/gu;
const CLASS_TOKEN = 'et-surface-interactive';

const lineAt = (content: string, index: number) => content.slice(0, index).split('\n').length;

const removeSymbols = (filePath: string, content: string, findings: RemoveSurfaceInteractiveFinding[]) => {
  if (![...RETIRED_SYMBOLS].some((symbol) => content.includes(symbol))) return content;

  const sourceFile = new Project({ useInMemoryFileSystem: true }).createSourceFile(filePath, content);

  for (const declaration of sourceFile.getImportDeclarations()) {
    if (!declaration.getModuleSpecifierValue().startsWith('@ethlete/core')) continue;

    const named = declaration.getNamedImports();
    const retired = named.filter((specifier) => RETIRED_SYMBOLS.has(specifier.getName()));

    if (retired.length === 0) continue;

    if (retired.length === named.length && !declaration.getDefaultImport() && !declaration.getNamespaceImport()) {
      declaration.remove();
    } else {
      retired.forEach((specifier) => specifier.remove());
    }
  }

  const references = sourceFile
    .getDescendantsOfKind(SyntaxKind.Identifier)
    .filter((identifier) => RETIRED_SYMBOLS.has(identifier.getText()));

  for (const identifier of references.reverse()) {
    if (identifier.wasForgotten()) continue;

    const parent = identifier.getParent();
    const element =
      parent && Node.isPropertyAssignment(parent) && parent.getName() === 'directive' ? parent.getParent() : identifier;
    const array = element?.getParent();

    if (element && array && Node.isArrayLiteralExpression(array)) {
      array.removeElement(element as Expression);
      continue;
    }

    findings.push({
      line: identifier.getStartLineNumber(),
      reason: `${identifier.getText()} is removed; delete this use by hand`,
      text: identifier.getParent()?.getText().split('\n')[0] ?? identifier.getText(),
    });
  }

  return sourceFile.getFullText();
};

const removeFromTemplates = (content: string) =>
  content.replace(ATTRIBUTE, '').replace(CLASS_ATTRIBUTE, (match, prefix: string, quote: string, value: string) => {
    const tokens = value.split(/\s+/u).filter(Boolean);

    if (!tokens.includes(CLASS_TOKEN)) return match;

    return `${prefix}${quote}${tokens.filter((token) => token !== CLASS_TOKEN).join(' ')}${quote}`;
  });

const reportLeftovers = (content: string, findings: RemoveSurfaceInteractiveFinding[]) => {
  for (const match of content.matchAll(/et-surface-interactive(?![\w-])|etSurfaceInteractive\b/gu)) {
    const line = lineAt(content, match.index);

    findings.push({
      line,
      reason: `${match[0]} has no styles any more; remove it, and read --et-surface-tint at the state you style`,
      text: content.split('\n')[line - 1]?.trim() ?? match[0],
    });
  }
};

/** Removes `etSurfaceInteractive`, its class and its directive imports from one file; reports what it cannot remove. */
export const removeSurfaceInteractiveInFile = (filePath: string, content: string): RemoveSurfaceInteractiveResult => {
  const findings: RemoveSurfaceInteractiveFinding[] = [];
  const isScript = SCRIPT_FILE.test(filePath);
  const withoutSymbols = isScript ? removeSymbols(filePath, content, findings) : content;
  const next = isScript || TEMPLATE_FILE.test(filePath) ? removeFromTemplates(withoutSymbols) : withoutSymbols;

  reportLeftovers(next, findings);

  return { changed: next !== content, content: next, findings };
};
