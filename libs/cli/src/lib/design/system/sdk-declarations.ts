import ts from 'typescript';

/** An input's declared values, or `null` when its type allows any value. */
export type DeclaredValues = Set<string> | null;

/** Per `et-` selector name of a component or directive, its inputs by template name. */
export type SdkDeclarations = Map<string, Map<string, DeclaredValues>>;

const SIGNAL_TYPES = /(?:^|\.)(?:InputSignal|InputSignalWithTransform|ModelSignal)$/u;
const DECLARATIONS = new Set(['ɵcmp', 'ɵdir']);

const unwrap = (node: ts.TypeNode): ts.TypeNode => (ts.isParenthesizedTypeNode(node) ? unwrap(node.type) : node);

const queriedName = (node: ts.TypeNode) => {
  const inner = unwrap(node);

  return ts.isTypeQueryNode(inner) && ts.isIdentifier(inner.exprName) ? inner.exprName.text : null;
};

const textOf = (name: ts.PropertyName | undefined) =>
  name && (ts.isIdentifier(name) || ts.isStringLiteral(name)) ? name.text : null;

const selectorNamesOf = (selector: string) =>
  selector
    .split(',')
    .flatMap((part) => [
      ...[...part.matchAll(/\[([\w-]+)\]/gu)].map(([, name]) => name as string),
      ...[...part.trim().matchAll(/^([a-z][\w-]*)/gu)].map(([, name]) => name as string),
    ])
    .filter((name) => name.startsWith('et-'));

const createResolver = (source: ts.SourceFile) => {
  const aliases = new Map<string, ts.TypeNode>();
  const constants = new Map<string, ts.TypeNode>();
  const classes = new Map<string, ts.ClassDeclaration>();

  for (const statement of source.statements) {
    if (ts.isTypeAliasDeclaration(statement)) aliases.set(statement.name.text, statement.type);
    else if (ts.isClassDeclaration(statement) && statement.name) classes.set(statement.name.text, statement);
    else if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations)
        if (ts.isIdentifier(declaration.name) && declaration.type)
          constants.set(declaration.name.text, declaration.type);
  }

  const valuesOf = (node: ts.TypeNode, depth = 0): DeclaredValues => {
    const type = unwrap(node);

    if (depth > 8) return null;
    if (type.kind === ts.SyntaxKind.BooleanKeyword) return new Set(['true', 'false']);
    if (type.kind === ts.SyntaxKind.UndefinedKeyword || type.kind === ts.SyntaxKind.NullKeyword) return new Set();

    if (ts.isLiteralTypeNode(type)) {
      const { literal } = type;

      if (ts.isStringLiteral(literal) || ts.isNumericLiteral(literal)) return new Set([literal.text]);
      if (literal.kind === ts.SyntaxKind.TrueKeyword) return new Set(['true']);
      if (literal.kind === ts.SyntaxKind.FalseKeyword) return new Set(['false']);
      if (literal.kind === ts.SyntaxKind.NullKeyword) return new Set();

      return null;
    }

    if (ts.isUnionTypeNode(type)) {
      const values = new Set<string>();

      for (const member of type.types) {
        const known = valuesOf(member, depth + 1);

        if (known === null) return null;
        known.forEach((value) => values.add(value));
      }

      return values;
    }

    if (ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName) && !type.typeArguments) {
      const alias = aliases.get(type.typeName.text);

      return alias ? valuesOf(alias, depth + 1) : null;
    }

    if (ts.isIndexedAccessTypeNode(type)) {
      const object = queriedName(type.objectType);
      const index = unwrap(type.indexType);
      const literal = object === null ? undefined : constants.get(object);

      if (
        literal &&
        ts.isTypeLiteralNode(literal) &&
        ts.isTypeOperatorNode(index) &&
        index.operator === ts.SyntaxKind.KeyOfKeyword &&
        queriedName(index.type) === object
      ) {
        const values = new Set<string>();

        for (const member of literal.members) {
          const known = ts.isPropertySignature(member) && member.type ? valuesOf(member.type, depth + 1) : null;

          if (known === null) return null;
          known.forEach((value) => values.add(value));
        }

        return values;
      }
    }

    return null;
  };

  const inputValuesOf = (owner: ts.ClassDeclaration, property: string): DeclaredValues => {
    const member = owner.members.find(
      (candidate): candidate is ts.PropertyDeclaration =>
        ts.isPropertyDeclaration(candidate) && textOf(candidate.name) === property,
    );
    const type = member?.type;

    if (!type) return null;
    if (ts.isTypeReferenceNode(type) && SIGNAL_TYPES.test(type.typeName.getText(source))) {
      const [value] = type.typeArguments ?? [];

      return value ? valuesOf(value) : null;
    }

    return valuesOf(type);
  };

  return { classes, inputValuesOf };
};

const membersOf = (node: ts.TypeNode | undefined) => {
  const type = node ? unwrap(node) : undefined;

  return type && ts.isTypeLiteralNode(type) ? type.members : ts.factory.createNodeArray<ts.TypeElement>();
};

const stringPropertyOf = (members: ts.NodeArray<ts.TypeElement>, name: string) => {
  const member = members.find((candidate) => ts.isPropertySignature(candidate) && textOf(candidate.name) === name);
  const type = member && ts.isPropertySignature(member) && member.type ? unwrap(member.type) : undefined;

  return type && ts.isLiteralTypeNode(type) && ts.isStringLiteral(type.literal) ? type.literal.text : null;
};

/**
 * The `et-` components and directives a bundled package declaration file (`.d.ts`) declares, read from their
 * `ɵcmp`/`ɵdir` declarations: each selector name with the inputs it takes, its host directives' too, and each input's
 * declared values.
 */
export const sdkDeclarationsOf = (dts: string): SdkDeclarations => {
  const source = ts.createSourceFile('sdk.d.ts', dts, ts.ScriptTarget.Latest, true);
  const { classes, inputValuesOf } = createResolver(source);
  const declarations: SdkDeclarations = new Map();

  for (const owner of classes.values()) {
    const declaration = owner.members.find(
      (member): member is ts.PropertyDeclaration =>
        ts.isPropertyDeclaration(member) && DECLARATIONS.has(textOf(member.name) ?? ''),
    );
    const type = declaration?.type;

    if (!type || !ts.isTypeReferenceNode(type)) continue;

    const [, selectorNode, , inputsNode, , , , , hostNode] = type.typeArguments ?? [];
    const selector = selectorNode && unwrap(selectorNode);

    if (!selector || !ts.isLiteralTypeNode(selector) || !ts.isStringLiteral(selector.literal)) continue;

    const names = selectorNamesOf(selector.literal.text);

    if (names.length === 0) continue;

    const inputs = new Map<string, DeclaredValues>();

    for (const member of membersOf(inputsNode)) {
      const property = ts.isPropertySignature(member) ? textOf(member.name) : null;

      if (property === null || !ts.isPropertySignature(member)) continue;

      inputs.set(stringPropertyOf(membersOf(member.type), 'alias') ?? property, inputValuesOf(owner, property));
    }

    const host = hostNode ? unwrap(hostNode) : undefined;

    if (host && ts.isTupleTypeNode(host))
      for (const element of host.elements) {
        const members = membersOf(element as ts.TypeNode);
        const directive = members.find(
          (member) => ts.isPropertySignature(member) && textOf(member.name) === 'directive',
        );
        const directiveName =
          directive && ts.isPropertySignature(directive) && directive.type ? queriedName(directive.type) : null;
        const hostClass = directiveName === null ? undefined : classes.get(directiveName);
        const forwarded = members.find((member) => ts.isPropertySignature(member) && textOf(member.name) === 'inputs');

        if (!forwarded || !ts.isPropertySignature(forwarded)) continue;

        for (const input of membersOf(forwarded.type)) {
          const own = ts.isPropertySignature(input) ? textOf(input.name) : null;
          const alias = ts.isPropertySignature(input) && input.type ? unwrap(input.type) : undefined;

          if (own === null) continue;

          const publicName =
            alias && ts.isLiteralTypeNode(alias) && ts.isStringLiteral(alias.literal) ? alias.literal.text : own;
          const hostDeclaration = hostClass?.members.find(
            (member): member is ts.PropertyDeclaration =>
              ts.isPropertyDeclaration(member) && DECLARATIONS.has(textOf(member.name) ?? ''),
          )?.type;
          const hostInputs =
            hostDeclaration && ts.isTypeReferenceNode(hostDeclaration) ? hostDeclaration.typeArguments?.[3] : undefined;
          const hostProperty =
            membersOf(hostInputs).find(
              (member) =>
                ts.isPropertySignature(member) &&
                (stringPropertyOf(membersOf(member.type), 'alias') ?? textOf(member.name)) === own,
            ) ?? null;
          const property = hostProperty && ts.isPropertySignature(hostProperty) ? textOf(hostProperty.name) : null;

          inputs.set(publicName, hostClass && property !== null ? inputValuesOf(hostClass, property) : null);
        }
      }

    for (const name of names) declarations.set(name, new Map([...(declarations.get(name) ?? []), ...inputs]));
  }

  return declarations;
};
