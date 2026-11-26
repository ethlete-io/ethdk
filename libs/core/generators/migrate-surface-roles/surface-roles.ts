import { Expression, Node, ObjectLiteralExpression, Project, SourceFile, SyntaxKind } from 'ts-morph';
import { isGeneratedThemeFile } from '../migrate-theme-token-names/theme-token-names.js';

export type SurfaceRolesFinding = {
  line: number;
  reason: string;
  text: string;
};

export type SurfaceRolesResult = {
  changed: boolean;
  content: string;
  findings: SurfaceRolesFinding[];
  notices: SurfaceRolesFinding[];
};

type TextEdit = { start: number; end: number; text: string };

const SCRIPT_FILE = /\.(ts|tsx|js|mjs|cjs|jsx)$/;
const RETIRED_TYPE = 'SurfaceInteractionColor';
const RENAMED_MAP_TYPES = ['SurfaceInteractionColorMap', 'SurfaceOnInteractionColorMap'];
const CONTROL_TEXT_TYPE = 'SurfaceControlTextMap';
const ROLES_TYPE = "Pick<SurfaceTheme, 'tint' | 'controlText'>";

const unwrap = (expression: Expression | undefined) => {
  let current = expression;

  while (current?.isKind(SyntaxKind.AsExpression) || current?.isKind(SyntaxKind.SatisfiesExpression)) {
    current = current.getExpression();
  }

  return current;
};

const findConst = (sourceFile: SourceFile, name: string) =>
  sourceFile.getVariableDeclarations().find((candidate) => candidate.getName() === name);

const resolveObject = (expression: Expression | undefined, sourceFile: SourceFile): ObjectLiteralExpression | null => {
  const resolved = unwrap(expression);

  if (resolved?.isKind(SyntaxKind.ObjectLiteralExpression)) return resolved;
  if (!resolved?.isKind(SyntaxKind.Identifier)) return null;

  return resolveObject(findConst(sourceFile, resolved.getText())?.getInitializer(), sourceFile);
};

const propertyOf = (obj: ObjectLiteralExpression, name: string) => {
  const property = obj.getProperty(name);

  return property?.isKind(SyntaxKind.PropertyAssignment) ? property : undefined;
};

type SplitRoles = { tint: string; controlText: string } | { error: string };

const splitSwatch = (
  swatch: ObjectLiteralExpression,
  sourceFile: SourceFile,
  notices: SurfaceRolesFinding[],
): SplitRoles => {
  const color = propertyOf(swatch, 'color')?.getInitializer();

  if (!color) return { error: 'interactionColor has no color map; split it into tint and controlText by hand' };

  const tint = resolveObject(color, sourceFile)?.getProperty('default');
  const tintValue = tint?.isKind(SyntaxKind.PropertyAssignment) ? tint.getInitializer() : undefined;

  if (!tintValue?.isKind(SyntaxKind.StringLiteral)) {
    return { error: 'the default of interactionColor.color cannot be resolved; set tint and controlText by hand' };
  }

  for (const removed of ['onColor', 'inkColor']) {
    const property = propertyOf(swatch, removed);

    if (!property) continue;

    notices.push({
      line: property.getStartLineNumber(),
      reason: `removed interactionColor.${removed}: a neutral control now takes its text from controlText and the surface`,
      text: property.getText().split('\n')[0] ?? '',
    });
  }

  return { tint: tintValue.getText(), controlText: color.getText() };
};

const indentOf = (node: Node) => {
  const lineStart = node.getSourceFile().getFullText().lastIndexOf('\n', node.getStart()) + 1;

  return /^\s*/.exec(node.getSourceFile().getFullText().slice(lineStart))?.[0] ?? '';
};

const rewriteImports = (sourceFile: SourceFile, needsSurfaceTheme: boolean, edits: TextEdit[]) => {
  for (const declaration of sourceFile.getImportDeclarations()) {
    if (declaration.getModuleSpecifierValue() !== '@ethlete/core') continue;

    const specifiers = declaration.getNamedImports();
    const names = specifiers.map((specifier) => specifier.getName());

    if (!names.some((name) => name === RETIRED_TYPE || RENAMED_MAP_TYPES.includes(name))) continue;

    const kept = new Set(
      specifiers
        .filter((specifier) => specifier.getName() !== RETIRED_TYPE)
        .map((specifier) =>
          RENAMED_MAP_TYPES.includes(specifier.getName())
            ? `${specifier.isTypeOnly() ? 'type ' : ''}${CONTROL_TEXT_TYPE}`
            : specifier.getText(),
        ),
    );

    if (needsSurfaceTheme && !names.includes('SurfaceTheme')) kept.add('SurfaceTheme');

    const typeOnly = declaration.isTypeOnly() ? 'type ' : '';

    edits.push({
      start: declaration.getStart(),
      end: declaration.getEnd(),
      text:
        kept.size === 0
          ? ''
          : `import ${typeOnly}{ ${[...kept].join(', ')} } from '${declaration.getModuleSpecifierValue()}';`,
    });
  }
};

const applyEdits = (content: string, edits: TextEdit[]) => {
  const outermost = edits.filter(
    (edit) => !edits.some((other) => other !== edit && other.start <= edit.start && other.end >= edit.end),
  );

  return outermost
    .sort((a, b) => b.start - a.start)
    .reduce((text, edit) => text.slice(0, edit.start) + edit.text + text.slice(edit.end), content);
};

const migrateThemeFields = (
  filePath: string,
  content: string,
  findings: SurfaceRolesFinding[],
  notices: SurfaceRolesFinding[],
) => {
  const sourceFile = new Project({ useInMemoryFileSystem: true }).createSourceFile(filePath, content);
  const edits: TextEdit[] = [];
  const rewrittenConsts = new Set<string>();

  for (const property of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
    if (property.getName() !== 'interactionColor') continue;

    const initializer = unwrap(property.getInitializer());
    const finding = (reason: string) =>
      findings.push({ line: property.getStartLineNumber(), reason, text: property.getText().split('\n')[0] ?? '' });

    if (initializer?.isKind(SyntaxKind.ObjectLiteralExpression)) {
      const roles = splitSwatch(initializer, sourceFile, notices);

      if ('error' in roles) {
        finding(roles.error);
        continue;
      }

      edits.push({
        start: property.getStart(),
        end: property.getEnd(),
        text: `tint: ${roles.tint},\n${indentOf(property)}controlText: ${roles.controlText}`,
      });
      continue;
    }

    const declaration = initializer?.isKind(SyntaxKind.Identifier)
      ? findConst(sourceFile, initializer.getText())
      : undefined;
    const swatch = unwrap(declaration?.getInitializer());

    if (!declaration || !swatch?.isKind(SyntaxKind.ObjectLiteralExpression)) {
      finding('interactionColor cannot be resolved in this file; split it into tint and controlText by hand');
      continue;
    }

    if (!rewrittenConsts.has(declaration.getName())) {
      const roles = splitSwatch(swatch, sourceFile, notices);

      if ('error' in roles) {
        finding(roles.error);
        continue;
      }

      rewrittenConsts.add(declaration.getName());
      edits.push({
        start: declaration.getStart(),
        end: declaration.getEnd(),
        text: `${declaration.getName()} = {\n  tint: ${roles.tint},\n  controlText: ${roles.controlText},\n} satisfies ${ROLES_TYPE}`,
      });
    }

    edits.push({ start: property.getStart(), end: property.getEnd(), text: `...${declaration.getName()}` });
  }

  for (const reference of sourceFile.getDescendantsOfKind(SyntaxKind.TypeReference)) {
    const name = reference.getTypeName().getText();

    if (RENAMED_MAP_TYPES.includes(name)) {
      edits.push({ start: reference.getStart(), end: reference.getEnd(), text: CONTROL_TEXT_TYPE });
    }
  }

  if (edits.length === 0) return content;

  rewriteImports(sourceFile, rewrittenConsts.size > 0, edits);

  return applyEdits(content, edits);
};

const SURFACE_INTERACTION =
  /(?<![\w-])(--)?([a-z][\w]*(?:-[\w]+)*?-surface(?:-[\w]+)*?)-interaction((?:-hover|-focus|-active|-disabled)?)(?![\w-])/g;
const SURFACE_INTERACTION_DECLARATION =
  /(?<![\w[-])--([a-z][\w]*(?:-[\w]+)*?-surface(?:-[\w]+)*?)-interaction(\s*:\s*)([^;{}\n]*?)\s*(?:;|(?=\s*})|$)/g;
const FILL_UTILITY = /^(?:bg|from|via|to)-/;
const LINE_UTILITY = /^(?:(?:inset-)?(?:ring|shadow)|border(?:-[xytrblse])?|outline|divide(?:-[xy])?|fill|stroke)-/;
const RETIRED_SURFACE_READER = /(?<![\w-])[\w-]*-surface(?:-[\w]+)*?-(?:on-interaction|interaction-ink)(?![\w])/;

const insideColorMix = (line: string, index: number) => {
  const start = line.lastIndexOf('color-mix(', index);

  if (start < 0) return false;

  let depth = 0;

  for (const char of line.slice(start, index)) {
    if (char === '(') depth++;
    if (char === ')') depth--;
  }

  return depth > 0;
};

const migrateReaders = (content: string, findings: SurfaceRolesFinding[]) =>
  content
    .split('\n')
    .map((line, index) => {
      if (RETIRED_SURFACE_READER.test(line)) {
        findings.push({
          line: index + 1,
          reason: 'the on-interaction and interaction-ink tokens are gone; read the surface background or text by hand',
          text: line.trim(),
        });

        return line;
      }

      const wholeLine = line.match(/^(\s*)(--[^:]+:[^;{}]*;?)\s*$/);
      const separator = wholeLine ? `\n${wholeLine[1]}` : ' ';

      return line
        .replace(
          SURFACE_INTERACTION_DECLARATION,
          (_match: string, base: string, colon: string, value: string) =>
            `--${base}-tint${colon}${value};${separator}--${base}-control-text${colon}${value};`,
        )
        .replace(
          SURFACE_INTERACTION,
          (match: string, dashes: string | undefined, base: string, state: string, offset: number) => {
            if (dashes) {
              return !state && insideColorMix(line, offset) ? `--${base}-tint` : `--${base}-control-text${state}`;
            }

            const withOpacity = line[offset + match.length] === '/';
            const tints = !state && (FILL_UTILITY.test(base) || (withOpacity && LINE_UTILITY.test(base)));

            return tints ? `${base}-tint` : `${base}-control-text${state}`;
          },
        );
    })
    .join('\n');

/**
 * Splits a surface theme's `interactionColor` into `tint` (its default color) and `controlText` (its color map),
 * drops `onColor` and `inkColor`, and renames the readers of the old surface interaction tokens.
 */
export const migrateSurfaceRolesInFile = (filePath: string, content: string): SurfaceRolesResult => {
  const findings: SurfaceRolesFinding[] = [];
  const notices: SurfaceRolesFinding[] = [];

  if (isGeneratedThemeFile(content)) return { changed: false, content, findings, notices };

  const withFields =
    SCRIPT_FILE.test(filePath) && /interactionColor|SurfaceInteractionColor|SurfaceOnInteractionColorMap/.test(content)
      ? migrateThemeFields(filePath, content, findings, notices)
      : content;
  const migrated = migrateReaders(withFields, findings);

  return { changed: migrated !== content, content: migrated, findings, notices };
};
