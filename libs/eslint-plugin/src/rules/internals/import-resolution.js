// @ts-check
'use strict';

const ANGULAR_CORE = '@angular/core';

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {any} identifier
 */
const findVariable = (sourceCode, identifier) => {
  /** @type {import('eslint').Scope.Scope | null} */
  let scope = sourceCode.getScope(identifier);

  while (scope) {
    const variable = scope.set.get(identifier.name);
    if (variable) return variable;
    scope = scope.upper;
  }

  return null;
};

/**
 * @param {any} specifier
 */
const getSpecifierImportedName = (specifier) => {
  if (specifier.type === 'ImportDefaultSpecifier') return 'default';
  if (specifier.type === 'ImportNamespaceSpecifier') return '*';

  return specifier.imported.name ?? specifier.imported.value;
};

/**
 * What an identifier is bound to: `{ source, name }` for an import (`name` is the exported
 * name, `'*'` for a namespace), `{ source: null, name }` for an undeclared global, and `null`
 * for a local binding.
 *
 * @param {import('eslint').SourceCode} sourceCode
 * @param {any} identifier
 * @returns {{ source: string | null; name: string } | null}
 */
const resolveIdentifier = (sourceCode, identifier) => {
  const variable = findVariable(sourceCode, identifier);
  if (!variable || variable.defs.length === 0) return { source: null, name: identifier.name };

  const definition = /** @type {any} */ (variable.defs[0]);
  if (definition.type !== 'ImportBinding') return null;

  return { source: definition.parent.source.value, name: getSpecifierImportedName(definition.node) };
};

/**
 * The exported name `node` refers to when it is imported from one of `sources`, directly, under
 * an alias, or as `namespace.name`. An undeclared identifier falls back to its own name, so code
 * without an import statement still matches; any other binding yields `null`.
 *
 * @param {import('eslint').SourceCode} sourceCode
 * @param {any} node
 * @param {string | readonly string[]} sources
 * @returns {string | null}
 */
const getImportedName = (sourceCode, node, sources) => {
  const sourceList = typeof sources === 'string' ? [sources] : sources;

  if (node?.type === 'Identifier') {
    const resolved = resolveIdentifier(sourceCode, node);
    if (!resolved) return null;
    if (resolved.source === null) return resolved.name;

    return sourceList.includes(resolved.source) && resolved.name !== '*' ? resolved.name : null;
  }

  if (
    node?.type === 'MemberExpression' &&
    !node.computed &&
    node.object.type === 'Identifier' &&
    node.property.type === 'Identifier'
  ) {
    const resolved = resolveIdentifier(sourceCode, node.object);
    if (!resolved || resolved.name !== '*' || resolved.source === null) return null;

    return sourceList.includes(resolved.source) ? node.property.name : null;
  }

  return null;
};

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {any} node
 * @param {string} name
 * @param {string | readonly string[]} [sources]
 */
const isImportedAs = (sourceCode, node, name, sources = ANGULAR_CORE) =>
  getImportedName(sourceCode, node, sources) === name;

/**
 * The `@angular/core` name of a decorator such as `@Component(...)`, `@Cmp(...)` or
 * `@ng.Component(...)`.
 *
 * @param {import('eslint').SourceCode} sourceCode
 * @param {any} decorator
 */
const getAngularDecoratorName = (sourceCode, decorator) => {
  if (decorator?.type !== 'Decorator') return null;

  const expression = decorator.expression;
  const target = expression.type === 'CallExpression' ? expression.callee : expression;

  return getImportedName(sourceCode, target, ANGULAR_CORE);
};

/**
 * The local name of a value import `{ importedName as local } from source`, or `null` when the
 * file does not import it as a value.
 *
 * @param {import('eslint').SourceCode} sourceCode
 * @param {string} source
 * @param {string} importedName
 */
const getImportLocalName = (sourceCode, source, importedName) => {
  for (const node of sourceCode.ast.body) {
    if (node.type !== 'ImportDeclaration' || node.source.value !== source) continue;
    if (/** @type {any} */ (node).importKind === 'type') continue;

    for (const specifier of node.specifiers) {
      if (specifier.type !== 'ImportSpecifier' || /** @type {any} */ (specifier).importKind === 'type') continue;
      if (getSpecifierImportedName(specifier) === importedName) return specifier.local.name;
    }
  }

  return null;
};

module.exports = {
  ANGULAR_CORE,
  getAngularDecoratorName,
  getImportedName,
  getImportLocalName,
  isImportedAs,
  resolveIdentifier,
};
