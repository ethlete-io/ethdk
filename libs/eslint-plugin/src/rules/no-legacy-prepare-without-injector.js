// @ts-check
'use strict';

/**
 * Requires an explicit `injector` on a legacy query creator's `prepare()` call whenever the call runs
 * outside the injection context that created it.
 *
 * The v2 client needed no injection context, so migrated call sites are full of callbacks that prepare a
 * query long after their component was built - a `computed()` at a class field, an `effect()` in a
 * constructor, an RxJS operator. Those throw `ET950` at runtime, and only on the code path that runs the
 * callback, which is how they reach production.
 *
 * BAD — the callback runs once the field initializer's context is long gone:
 *   users = computed(() => legacyGetUsers.prepare({ queryParams: { page: this.page() } })); // ❌ ET950
 *
 * GOOD:
 *   private injector = inject(Injector);
 *   users = computed(() => legacyGetUsers.prepare({ queryParams: { page: this.page() }, injector: this.injector }));
 *
 * Left alone: calls that really do run inside a context - directly in a constructor or field initializer,
 * inside `runInInjectionContext()`, inside the `queryComputed` family, in a synchronous array callback
 * (`items.map(…)`) that runs before its caller returns, or in a function that calls `inject()` itself and
 * therefore can only be called from a context.
 */

/** Helpers that run their callback inside an injection context. */
const CONTEXT_PROVIDING_CALLEES = new Set([
  'runInInjectionContext',
  'queryComputed',
  'queryComputedTillTruthy',
  'queryArrayComputed',
]);

/**
 * Array methods, which call back synchronously in the caller's own context. Matched only on a property
 * access (`items.map(…)`) - the bare-identifier form is an RxJS operator, whose callback runs later.
 */
const TRANSPARENT_ARRAY_METHODS = new Set([
  'map',
  'flatMap',
  'filter',
  'forEach',
  'find',
  'findLast',
  'findIndex',
  'some',
  'every',
  'reduce',
  'reduceRight',
  'sort',
  'flat',
]);

/**
 * @param {any} node
 * @returns {boolean}
 */
const isFunctionNode = (node) =>
  !!node &&
  (node.type === 'ArrowFunctionExpression' ||
    node.type === 'FunctionExpression' ||
    node.type === 'FunctionDeclaration');

/**
 * The call a function literal is being passed to, if it is an argument rather than a value.
 * @param {any} node
 */
const getCallbackHost = (node) => {
  const parent = node.parent;

  if (!parent || parent.type !== 'CallExpression' || !parent.arguments.includes(node)) {
    return null;
  }

  return parent;
};

/**
 * @param {any} host
 * @returns {boolean}
 */
const isContextProvidingHost = (host) => {
  if (!host) {
    return false;
  }

  if (host.callee.type === 'Identifier') {
    return CONTEXT_PROVIDING_CALLEES.has(host.callee.name);
  }

  return (
    host.callee.type === 'MemberExpression' &&
    host.callee.property.type === 'Identifier' &&
    host.callee.property.name === 'runInContext'
  );
};

/**
 * @param {any} host
 * @returns {boolean}
 */
const isTransparentHost = (host) =>
  !!host &&
  host.callee.type === 'MemberExpression' &&
  host.callee.property.type === 'Identifier' &&
  TRANSPARENT_ARRAY_METHODS.has(host.callee.property.name);

/**
 * Whether the function's own body calls `inject()`. Such a function can only be called from an injection
 * context, so anything inside it has one too.
 * @param {any} fn
 * @returns {boolean}
 */
const callsInject = (fn) => {
  let found = false;

  /** @param {any} node */
  const visit = (node) => {
    if (found || !node || typeof node.type !== 'string') {
      return;
    }

    if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name.startsWith('inject')) {
      found = true;

      return;
    }

    if (node !== fn && isFunctionNode(node)) {
      return;
    }

    for (const key of Object.keys(node)) {
      if (key === 'parent') {
        continue;
      }

      const value = node[key];

      if (Array.isArray(value)) {
        value.forEach(visit);
      } else if (value && typeof value.type === 'string') {
        visit(value);
      }
    }
  };

  visit(fn);

  return found;
};

/**
 * Whether the call needs an injector, decided by the **innermost** function boundary it sits behind - a
 * callback defined in a constructor is not "in the constructor" by the time it runs.
 * @param {any} node
 * @returns {{ needsInjector: boolean; boundary: string }}
 */
const classifyCallSite = (node) => {
  let current = node;

  while (current) {
    if (isFunctionNode(current)) {
      const parent = current.parent;

      if (parent?.type === 'MethodDefinition') {
        return parent.kind === 'constructor'
          ? { needsInjector: false, boundary: 'constructor' }
          : { needsInjector: true, boundary: parent.kind === 'method' ? 'method' : `${parent.kind} accessor` };
      }

      const host = getCallbackHost(current);

      if (isContextProvidingHost(host)) {
        return { needsInjector: false, boundary: 'injection context' };
      }

      if (!isTransparentHost(host)) {
        if (!host && callsInject(current)) {
          return { needsInjector: false, boundary: 'function that injects' };
        }

        return {
          needsInjector: true,
          boundary: host?.callee.type === 'Identifier' ? `${host.callee.name}() callback` : 'callback',
        };
      }
    }

    if (current.type === 'PropertyDefinition') {
      return { needsInjector: false, boundary: 'field initializer' };
    }

    current = current.parent;
  }

  return { needsInjector: true, boundary: 'call site' };
};

/**
 * @param {any} node
 * @returns {any}
 */
const findEnclosingClassBody = (node) => {
  let current = node;

  while (current) {
    if (current.type === 'ClassBody') {
      return current;
    }

    current = current.parent;
  }

  return null;
};

/**
 * @param {any} node
 * @returns {boolean}
 */
const isInjectInjectorCall = (node) =>
  !!node &&
  node.type === 'CallExpression' &&
  node.callee.type === 'Identifier' &&
  node.callee.name === 'inject' &&
  node.arguments[0]?.type === 'Identifier' &&
  node.arguments[0].name === 'Injector';

/**
 * @param {any} classBody
 * @returns {string | null}
 */
const findInjectorMemberName = (classBody) => {
  for (const member of classBody.body) {
    if (
      member.type === 'PropertyDefinition' &&
      isInjectInjectorCall(member.value) &&
      member.key.type === 'Identifier'
    ) {
      return member.key.name;
    }
  }

  return null;
};

/** @type {import('eslint').Rule.RuleModule} */
const noLegacyPrepareWithoutInjector = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require an explicit injector on legacy query creator prepare() calls that run outside an injection context.',
      recommended: true,
    },
    messages: {
      missingInjector:
        '{{creator}}.prepare() runs from a {{boundary}}, outside the injection context that created it, so it ' +
        'needs an explicit injector - without one it throws ET950 the first time that code path runs. Capture an ' +
        'injector where a context does exist and pass it: {{creator}}.prepare({ …, injector: this.injector }).',
    },
    schema: [
      {
        type: 'object',
        properties: {
          creatorPattern: { type: 'string' },
        },
        additionalProperties: false,
      },
    ],
    fixable: 'code',
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const creatorPattern = new RegExp(context.options[0]?.creatorPattern ?? '^legacy');
    /** Names known to be legacy creators: imported under the naming convention, or declared locally. */
    const creatorNames = new Set();

    /**
     * @param {any} classBody
     * @param {string} injectorName
     */
    const buildInjectorMemberFix = (classBody, injectorName) => {
      const firstMember = classBody.body[0];
      const indentation = ' '.repeat(firstMember ? firstMember.loc.start.column : 2);
      const declaration = `private ${injectorName} = inject(Injector);`;

      return firstMember
        ? /** @param {any} fixer */ (fixer) => fixer.insertTextBefore(firstMember, `${declaration}\n\n${indentation}`)
        : /** @param {any} fixer */ (fixer) => fixer.replaceText(classBody, `{\n${indentation}${declaration}\n}`);
    };

    /**
     * Adds the missing `inject` / `Injector` specifiers to an existing `@angular/core` import, or writes a
     * new import. Returns `null` when the shape is one a fixer should not touch (a namespace import).
     * @param {string[]} needed
     */
    const buildCoreImportFix = (needed) => {
      const coreImport = /** @type {any} */ (
        sourceCode.ast.body.find(
          (node) =>
            node.type === 'ImportDeclaration' &&
            node.source.type === 'Literal' &&
            node.source.value === '@angular/core',
        )
      );

      if (!coreImport) {
        const imports = sourceCode.ast.body.filter((node) => node.type === 'ImportDeclaration');
        const lastImport = imports[imports.length - 1];
        const text = `import { ${needed.join(', ')} } from '@angular/core';`;

        return lastImport
          ? /** @param {any} fixer */ (fixer) => fixer.insertTextAfter(lastImport, `\n${text}`)
          : /** @param {any} fixer */ (fixer) => fixer.insertTextBefore(sourceCode.ast.body[0], `${text}\n\n`);
      }

      const specifiers = coreImport.specifiers ?? [];

      if (specifiers.some(/** @param {any} specifier */ (specifier) => specifier.type !== 'ImportSpecifier')) {
        return null;
      }

      const existing = new Set(specifiers.map(/** @param {any} specifier */ (specifier) => specifier.imported.name));
      const missing = needed.filter((name) => !existing.has(name));
      const lastSpecifier = specifiers[specifiers.length - 1];

      if (missing.length === 0 || !lastSpecifier) {
        return null;
      }

      return /** @param {any} fixer */ (fixer) => fixer.insertTextAfter(lastSpecifier, `, ${missing.join(', ')}`);
    };

    /**
     * @param {any} callNode
     * @param {string} injectorReference
     */
    const buildArgumentFix = (callNode, injectorReference) => {
      const argument = callNode.arguments[0];
      const injectorProperty = `injector: ${injectorReference}`;

      if (!argument) {
        const closingParen = sourceCode.getLastToken(callNode);

        return closingParen
          ? /** @param {any} fixer */ (fixer) => fixer.insertTextBefore(closingParen, `{ ${injectorProperty} }`)
          : null;
      }

      if (argument.type === 'ObjectExpression') {
        const lastProperty = argument.properties[argument.properties.length - 1];

        if (!lastProperty) {
          return /** @param {any} fixer */ (fixer) => fixer.replaceText(argument, `{ ${injectorProperty} }`);
        }

        const isMultiline = argument.loc.start.line !== argument.loc.end.line;
        const tokenAfter = sourceCode.getTokenAfter(lastProperty);
        const hasTrailingComma = tokenAfter?.type === 'Punctuator' && tokenAfter.value === ',';
        const indentation = isMultiline ? `\n${' '.repeat(lastProperty.loc.start.column)}` : ' ';

        return /** @param {any} fixer */ (fixer) =>
          fixer.insertTextAfter(
            hasTrailingComma ? tokenAfter : lastProperty,
            `${hasTrailingComma ? '' : ','}${indentation}${injectorProperty}${isMultiline ? ',' : ''}`,
          );
      }

      // `prepare(args)` - spreading is the only way to keep whatever the variable holds.
      if (argument.type === 'Identifier' || argument.type === 'MemberExpression') {
        return /** @param {any} fixer */ (fixer) =>
          fixer.replaceText(argument, `{ ...${sourceCode.getText(argument)}, ${injectorProperty} }`);
      }

      return null;
    };

    return {
      // Collected up front rather than in an `ImportDeclaration` visitor: a class can sit above the
      // `export const legacyX = createLegacyQueryCreator(…)` it uses.
      Program(program) {
        /** @param {any} node */
        const visit = (node) => {
          if (!node || typeof node.type !== 'string') {
            return;
          }

          if (node.type === 'ImportDeclaration') {
            node.specifiers.forEach(
              /** @param {any} specifier */ (specifier) => {
                if (specifier.type === 'ImportSpecifier' && creatorPattern.test(specifier.local.name)) {
                  creatorNames.add(specifier.local.name);
                }
              },
            );
          }

          if (
            node.type === 'VariableDeclarator' &&
            node.id.type === 'Identifier' &&
            node.init?.type === 'CallExpression' &&
            node.init.callee.type === 'Identifier' &&
            node.init.callee.name === 'createLegacyQueryCreator'
          ) {
            creatorNames.add(node.id.name);
          }

          for (const key of Object.keys(node)) {
            if (key === 'parent') {
              continue;
            }

            const value = node[key];

            if (Array.isArray(value)) {
              value.forEach(visit);
            } else if (value && typeof value.type === 'string') {
              visit(value);
            }
          }
        };

        visit(program);
      },
      CallExpression(node) {
        const callee = /** @type {any} */ (node.callee);

        if (
          callee.type !== 'MemberExpression' ||
          callee.property.type !== 'Identifier' ||
          callee.property.name !== 'prepare' ||
          callee.object.type !== 'Identifier' ||
          !creatorNames.has(callee.object.name)
        ) {
          return;
        }

        const firstArgument = /** @type {any} */ (node.arguments[0]);
        const hasInjector =
          firstArgument?.type === 'ObjectExpression' &&
          firstArgument.properties.some(
            /** @param {any} property */ (property) =>
              property.type === 'Property' && property.key.type === 'Identifier' && property.key.name === 'injector',
          );

        if (hasInjector) {
          return;
        }

        const { needsInjector, boundary } = classifyCallSite(node);

        if (!needsInjector) {
          return;
        }

        const classBody = findEnclosingClassBody(node);
        const existingInjector = classBody ? findInjectorMemberName(classBody) : null;
        const injectorName = existingInjector ?? 'injector';
        const argumentFix = classBody ? buildArgumentFix(node, `this.${injectorName}`) : null;

        context.report({
          node,
          messageId: 'missingInjector',
          data: { creator: callee.object.name, boundary },
          // Only the in-class shape is auto-fixed: a standalone function has no obvious injector to reach
          // for, and inventing an `inject()` call there would move the failure rather than fix it.
          fix:
            classBody && argumentFix
              ? (fixer) => {
                  const fixes = [argumentFix(fixer)];

                  if (!existingInjector) {
                    fixes.push(buildInjectorMemberFix(classBody, injectorName)(fixer));

                    const importFix = buildCoreImportFix(['inject', 'Injector']);

                    if (importFix) {
                      fixes.push(importFix(fixer));
                    }
                  }

                  return fixes;
                }
              : null,
        });
      },
    };
  },
};

module.exports = noLegacyPrepareWithoutInjector;
