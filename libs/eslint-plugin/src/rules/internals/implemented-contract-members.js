// @ts-check
'use strict';

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

/** @type {Map<string, import('typescript').SourceFile | null>} */
const SOURCE_FILE_CACHE = new Map();

/**
 * @param {string} filePath
 */
const readFileIfExists = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch {
    return null;
  }

  return null;
};

/**
 * @param {{ filePath: string, text?: string | null }} config
 */
const getSourceFile = ({ filePath, text = null }) => {
  if (text !== null) {
    return ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  }

  if (SOURCE_FILE_CACHE.has(filePath)) {
    return SOURCE_FILE_CACHE.get(filePath) ?? null;
  }

  const fileText = readFileIfExists(filePath);

  if (fileText === null) {
    SOURCE_FILE_CACHE.set(filePath, null);
    return null;
  }

  const sourceFile = ts.createSourceFile(filePath, fileText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  SOURCE_FILE_CACHE.set(filePath, sourceFile);
  return sourceFile;
};

/**
 * @param {string} importingFilePath
 * @param {string} specifier
 */
const resolveRelativeModule = (importingFilePath, specifier) => {
  if (!specifier.startsWith('.')) {
    return null;
  }

  const basePath = path.resolve(path.dirname(importingFilePath), specifier);
  const candidates = [
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.d.ts`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.d.ts'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
};

/**
 * @param {import('typescript').TypeElement | import('typescript').ClassElement} member
 */
const getMemberName = (member) => {
  if (!member.name) return null;

  if (ts.isIdentifier(member.name) || ts.isPrivateIdentifier(member.name)) {
    return member.name.text;
  }

  if (ts.isStringLiteral(member.name) || ts.isNumericLiteral(member.name)) {
    return String(member.name.text);
  }

  return null;
};

/**
 * @param {{ sourceFile: import('typescript').SourceFile, typeName: string, currentFilePath: string, visited: Set<string>, currentFileText?: string | null }} config
 */
const collectMemberNamesForType = ({ sourceFile, typeName, currentFilePath, visited, currentFileText = null }) => {
  const visitKey = `${sourceFile.fileName}::${typeName}`;
  if (visited.has(visitKey)) {
    return new Set();
  }

  visited.add(visitKey);

  /** @type {Set<string>} */
  const memberNames = new Set();

  /**
   * @param {import('typescript').TypeNode | undefined} typeNode
   * @param {string} filePath
   * @param {string | null} fileText
   */
  const collectFromTypeNode = (typeNode, filePath, fileText) => {
    if (!typeNode) {
      return;
    }

    if (ts.isTypeLiteralNode(typeNode)) {
      for (const member of typeNode.members) {
        const memberName = getMemberName(member);
        if (memberName) memberNames.add(memberName);
      }

      return;
    }

    if (ts.isIntersectionTypeNode(typeNode)) {
      for (const part of typeNode.types) {
        collectFromTypeNode(part, filePath, fileText);
      }

      return;
    }

    if (ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName)) {
      const referencedMembers = collectMemberNamesForTypeByName({
        sourceFile: getSourceFile({ filePath, text: fileText }),
        typeName: typeNode.typeName.text,
        currentFilePath: filePath,
        visited,
        currentFileText: fileText,
      });

      for (const referencedMember of referencedMembers) {
        memberNames.add(referencedMember);
      }
    }
  };

  const statements = sourceFile.statements;

  for (const statement of statements) {
    if (ts.isInterfaceDeclaration(statement) && statement.name.text === typeName) {
      for (const member of statement.members) {
        const memberName = getMemberName(member);
        if (memberName) memberNames.add(memberName);
      }

      if (statement.heritageClauses) {
        for (const clause of statement.heritageClauses) {
          if (clause.token !== ts.SyntaxKind.ExtendsKeyword) continue;

          for (const heritageType of clause.types) {
            if (!ts.isIdentifier(heritageType.expression)) continue;

            const inheritedMembers = collectMemberNamesForTypeByName({
              sourceFile,
              typeName: heritageType.expression.text,
              currentFilePath,
              visited,
              currentFileText,
            });

            for (const inheritedMember of inheritedMembers) {
              memberNames.add(inheritedMember);
            }
          }
        }
      }

      return memberNames;
    }

    if (ts.isTypeAliasDeclaration(statement) && statement.name.text === typeName) {
      collectFromTypeNode(
        statement.type,
        sourceFile.fileName,
        sourceFile.fileName === currentFilePath ? currentFileText : null,
      );
      return memberNames;
    }
  }

  for (const statement of statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (!statement.importClause || !statement.importClause.namedBindings) continue;
    if (!ts.isNamedImports(statement.importClause.namedBindings)) continue;

    for (const element of statement.importClause.namedBindings.elements) {
      const localName = element.name.text;
      if (localName !== typeName) continue;

      const importedName = element.propertyName ? element.propertyName.text : element.name.text;
      const resolvedModulePath = resolveRelativeModule(sourceFile.fileName, statement.moduleSpecifier.text);
      if (!resolvedModulePath) {
        return memberNames;
      }

      const importedSourceFile = getSourceFile({ filePath: resolvedModulePath });
      if (!importedSourceFile) {
        return memberNames;
      }

      const importedMembers = collectMemberNamesForTypeByName({
        sourceFile: importedSourceFile,
        typeName: importedName,
        currentFilePath: resolvedModulePath,
        visited,
      });

      for (const importedMember of importedMembers) {
        memberNames.add(importedMember);
      }

      return memberNames;
    }
  }

  return memberNames;
};

/**
 * @param {{ sourceFile: import('typescript').SourceFile | null, typeName: string, currentFilePath: string, visited: Set<string>, currentFileText?: string | null }} config
 */
const collectMemberNamesForTypeByName = ({
  sourceFile,
  typeName,
  currentFilePath,
  visited,
  currentFileText = null,
}) => {
  if (!sourceFile) {
    return new Set();
  }

  return collectMemberNamesForType({
    sourceFile,
    typeName,
    currentFilePath,
    visited,
    currentFileText,
  });
};

/**
 * @param {{ classNode: any, context: import('eslint').Rule.RuleContext }} config
 */
const getImplementedContractMemberNames = ({ classNode, context }) => {
  const filename = context.physicalFilename || context.filename;
  if (!filename || filename === '<input>' || filename === '<text>') {
    return new Set();
  }

  const currentSourceFile = getSourceFile({ filePath: filename, text: context.sourceCode.text });
  if (!currentSourceFile) {
    return new Set();
  }

  /** @type {Set<string>} */
  const memberNames = new Set();

  for (const implementedType of classNode.implements || []) {
    if (!implementedType.expression || implementedType.expression.type !== 'Identifier') continue;

    const typeMemberNames = collectMemberNamesForTypeByName({
      sourceFile: currentSourceFile,
      typeName: implementedType.expression.name,
      currentFilePath: filename,
      visited: new Set(),
      currentFileText: context.sourceCode.text,
    });

    for (const memberName of typeMemberNames) {
      memberNames.add(memberName);
    }
  }

  return memberNames;
};

module.exports = {
  getImplementedContractMemberNames,
};
