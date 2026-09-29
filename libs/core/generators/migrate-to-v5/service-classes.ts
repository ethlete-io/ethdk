import * as ts from 'typescript';
import { applyReplacements } from './apply-replacements.js';

export type ServiceClass = { index: number; fields: string[] };

export function getServiceImport(
  sourceFile: ts.SourceFile,
  importedName: string,
): { localName: string; packageName: string } | null {
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;

    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;

    const element = bindings.elements.find((el) => (el.propertyName?.text ?? el.name.text) === importedName);
    if (element) return { localName: element.name.text, packageName: statement.moduleSpecifier.text };
  }

  return null;
}

export function collectClasses(sourceFile: ts.SourceFile): ts.ClassDeclaration[] {
  const classes: ts.ClassDeclaration[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isClassDeclaration(node)) classes.push(node);
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return classes;
}

export function isServiceProperty(member: ts.PropertyDeclaration, serviceName: string): boolean {
  const initializer = member.initializer;
  const injectsService =
    !!initializer &&
    ts.isCallExpression(initializer) &&
    ts.isIdentifier(initializer.expression) &&
    initializer.expression.text === 'inject' &&
    !!initializer.arguments[0] &&
    ts.isIdentifier(initializer.arguments[0]) &&
    initializer.arguments[0].text === serviceName;

  return injectsService || isServiceType(member.type, serviceName);
}

export function isServiceParameter(param: ts.ParameterDeclaration, serviceName: string): boolean {
  return ts.isIdentifier(param.name) && isServiceType(param.type, serviceName);
}

export function findServiceClasses(sourceFile: ts.SourceFile, serviceName: string): ServiceClass[] {
  return collectClasses(sourceFile).flatMap((classNode, index) => {
    const fields = classNode.members.flatMap((member) => {
      if (ts.isPropertyDeclaration(member) && ts.isIdentifier(member.name) && isServiceProperty(member, serviceName)) {
        return [member.name.text];
      }
      if (ts.isConstructorDeclaration(member)) {
        return member.parameters
          .filter((param) => isServiceParameter(param, serviceName))
          .map((param) => (param.name as ts.Identifier).text);
      }
      return [];
    });

    return fields.length > 0 ? [{ index, fields }] : [];
  });
}

export function applyReplacementsInClass(
  content: string,
  sourceFile: ts.SourceFile,
  classNode: ts.ClassDeclaration,
  replacements: Map<string, string>,
): string {
  const start = classNode.getStart(sourceFile);
  const end = classNode.getEnd();

  return content.slice(0, start) + applyReplacements(content.slice(start, end), replacements) + content.slice(end);
}

export function removeServiceImport(sourceFile: ts.SourceFile, content: string, importedName: string): string {
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;

    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;

    const elements = bindings.elements;
    const index = elements.findIndex((el) => (el.propertyName?.text ?? el.name.text) === importedName);
    if (index === -1) continue;

    if (elements.length === 1) {
      const defaultImport = statement.importClause.name;
      if (defaultImport) return content.slice(0, defaultImport.getEnd()) + content.slice(bindings.getEnd());

      let lineEnd = statement.getEnd();
      while (lineEnd < content.length && content[lineEnd] !== '\n') lineEnd++;
      if (content[lineEnd] === '\n') lineEnd++;

      return content.slice(0, statement.getStart(sourceFile)) + content.slice(lineEnd);
    }

    const element = elements[index]!;
    const next = elements[index + 1];
    const previous = elements[index - 1];
    const [start, end] = next
      ? [element.getStart(sourceFile), next.getStart(sourceFile)]
      : [previous!.getEnd(), element.getEnd()];

    return content.slice(0, start) + content.slice(end);
  }

  return content;
}

function isServiceType(type: ts.TypeNode | undefined, serviceName: string): boolean {
  return !!type && ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName) && type.typeName.text === serviceName;
}

export function isServiceStillUsed(
  sourceFile: ts.SourceFile,
  serviceName: string,
  serviceClasses: ServiceClass[],
): boolean {
  const classes = collectClasses(sourceFile);
  const referencesField = serviceClasses.some(({ index, fields }) => containsIdentifier(classes[index], fields));
  const referencesService = sourceFile.statements.some(
    (statement) => !ts.isImportDeclaration(statement) && containsIdentifier(statement, [serviceName]),
  );

  return referencesField || referencesService;
}

function containsIdentifier(node: ts.Node | undefined, names: string[]): boolean {
  if (!node) return false;
  if (ts.isIdentifier(node) && names.includes(node.text)) return true;

  return !!ts.forEachChild(node, (child) => containsIdentifier(child, names) || undefined);
}
