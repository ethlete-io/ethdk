// @ts-check
'use strict';

/**
 * Disallows legacy Angular decorators in favour of their modern signal-based
 * equivalents and the `host: {}` shorthand.
 *
 * Signal-based replacements:
 *   ❌ @Input()           → ✅ input()
 *   ❌ @Output()          → ✅ output()
 *   ❌ @ViewChild()       → ✅ viewChild()
 *   ❌ @ViewChildren()    → ✅ viewChildren()
 *   ❌ @ContentChild()    → ✅ contentChild()
 *   ❌ @ContentChildren() → ✅ contentChildren()
 *
 * Pair detection — when @Input() x and @Output() xChange are declared in the
 * same class they form a two-way binding pattern that must be replaced by
 * model():
 *   ❌ @Input() value; @Output() valueChange = new EventEmitter();
 *   → ✅ value = model();
 *
 * Host bindings — use the host: {} property instead:
 *   ❌ @HostBinding('class.active') isActive = false;
 *   ❌ @HostListener('click') onClick() {}
 *   → ✅ host: { '[class.active]': 'isActive', '(click)': 'onClick()' }
 */

/**
 * Returns the identifier name of a decorator.
 * Works for both `@Foo` (Identifier) and `@Foo(...)` (CallExpression).
 *
 * @param {any} decorator
 * @returns {string | null}
 */
const getDecoratorName = (decorator) => {
  const expr = decorator.expression;
  if (expr.type === 'Identifier') return expr.name;
  if (expr.type === 'CallExpression' && expr.callee.type === 'Identifier') return expr.callee.name;
  return null;
};

/**
 * Returns the static string key of a class member, or null for computed keys.
 *
 * @param {any} node - PropertyDefinition or MethodDefinition
 * @returns {string | null}
 */
const getMemberName = (node) => {
  if (!node.computed && node.key.type === 'Identifier') return node.key.name;
  if (!node.computed && node.key.type === 'Literal') return String(node.key.value);
  return null;
};

/**
 * @param {import('estree').Property['key']} key
 * @returns {string | null}
 */
const getPropertyName = (key) => {
  if (key.type === 'Identifier') return key.name;
  if (key.type === 'Literal' && typeof key.value === 'string') return key.value;
  return null;
};

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {import('eslint').AST.Token | import('eslint').Rule.Node} node
 */
const getIndent = (sourceCode, node) => {
  if (!node.loc) return '';
  const line = sourceCode.lines[node.loc.start.line - 1] ?? '';
  return line.slice(0, node.loc.start.column);
};

/**
 * @param {any} classNode
 */
const getAngularMetadata = (classNode) => {
  for (const decorator of classNode.decorators ?? []) {
    const decoratorName = getDecoratorName(decorator);
    if (decoratorName !== 'Component' && decoratorName !== 'Directive') continue;

    const expression = decorator.expression;
    if (expression.type !== 'CallExpression') continue;

    const metadata = expression.arguments[0];
    if (metadata?.type !== 'ObjectExpression') continue;

    return metadata;
  }

  return null;
};

/**
 * @param {any} objectExpression
 * @param {string} propertyName
 */
const findObjectProperty = (objectExpression, propertyName) =>
  objectExpression.properties.find(
    (property) => property.type === 'Property' && getPropertyName(property.key) === propertyName,
  ) ?? null;

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {any} objectExpression
 * @param {string} entryText
 */
const buildObjectTextWithAppendedProperty = (sourceCode, objectExpression, entryText) => {
  const properties = objectExpression.properties.filter((property) => property.type === 'Property');
  const isMultiline = Boolean(
    objectExpression.loc && objectExpression.loc.start.line !== objectExpression.loc.end.line,
  );

  if (!isMultiline) {
    const existingText = properties.map((property) => sourceCode.getText(property));
    return existingText.length === 0 ? `{ ${entryText} }` : `{ ${existingText.join(', ')}, ${entryText} }`;
  }

  const openingBrace = sourceCode.getFirstToken(objectExpression);
  const closingBrace = sourceCode.getLastToken(objectExpression);
  const closingIndent = closingBrace ? getIndent(sourceCode, closingBrace) : '';
  const propertyIndent = properties[0] ? getIndent(sourceCode, properties[0]) : `${closingIndent}  `;
  const existingText = properties.map((property) => `${propertyIndent}${sourceCode.getText(property)}`);

  if (existingText.length === 0) {
    return `{
${propertyIndent}${entryText}
${closingIndent}}`;
  }

  return `{
${existingText.join(',\n')},
${propertyIndent}${entryText}
${closingIndent}}`;
};

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {any} objectExpression
 */
const hasTrailingComma = (sourceCode, objectExpression) => {
  const properties = objectExpression.properties.filter((property) => property.type === 'Property');
  const lastProperty = properties[properties.length - 1];
  if (!lastProperty) return false;

  const tokenAfter = sourceCode.getTokenAfter(lastProperty);
  return Boolean(tokenAfter && tokenAfter.type === 'Punctuator' && tokenAfter.value === ',');
};

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {any} decoratorNode
 * @param {any} memberNode
 * @param {string} bindingKey
 * @param {string} memberName
 */
const buildHostBindingFix = (sourceCode, decoratorNode, memberNode, bindingKey, memberName) => {
  const classBody = memberNode.parent;
  const classNode = classBody?.parent;
  if (!classNode) return null;

  const metadata = getAngularMetadata(classNode);
  if (!metadata) return null;

  const hostProperty = findObjectProperty(metadata, 'host');
  const hostEntryText = `'${bindingKey}': '${memberName}'`;
  const fixes = [];

  if (hostProperty) {
    if (hostProperty.value.type !== 'ObjectExpression') return null;
    if (
      hostProperty.value.properties.some(
        (property) => property.type === 'Property' && getPropertyName(property.key) === bindingKey,
      )
    ) {
      return null;
    }

    fixes.push((fixer) =>
      fixer.replaceText(
        hostProperty.value,
        buildObjectTextWithAppendedProperty(sourceCode, hostProperty.value, hostEntryText),
      ),
    );
  } else {
    const closingBrace = sourceCode.getLastToken(metadata);
    if (!closingBrace) return null;

    const isMultiline = Boolean(metadata.loc && metadata.loc.start.line !== metadata.loc.end.line);
    const closingIndent = getIndent(sourceCode, closingBrace);
    const propertyIndent = metadata.properties[0]
      ? getIndent(sourceCode, metadata.properties[0])
      : `${getIndent(sourceCode, closingBrace)}  `;
    const hostPropertyText = `host: { ${hostEntryText} }`;
    const separator = metadata.properties.length > 0 ? (hasTrailingComma(sourceCode, metadata) ? '' : ',') : '';

    if (isMultiline && metadata.properties.length > 0) {
      const lastProperty = metadata.properties[metadata.properties.length - 1];
      const tokenAfterLastProperty = sourceCode.getTokenAfter(lastProperty);
      const rangeStart =
        separator === '' && tokenAfterLastProperty ? tokenAfterLastProperty.range[1] : lastProperty.range[1];

      fixes.push((fixer) =>
        fixer.replaceTextRange(
          [rangeStart, closingBrace.range[0]],
          `${separator}\n${propertyIndent}${hostPropertyText},\n${closingIndent}`,
        ),
      );
    } else {
      const insertion = isMultiline
        ? `\n${propertyIndent}${hostPropertyText}\n${closingIndent}`
        : `${metadata.properties.length > 0 ? `${separator} ` : ' '}${hostPropertyText}${metadata.properties.length > 0 ? '' : ' '}`;

      fixes.push((fixer) => fixer.insertTextBefore(closingBrace, insertion));
    }
  }

  const nextToken = sourceCode.getTokenAfter(decoratorNode);
  fixes.push(
    nextToken
      ? (fixer) => fixer.removeRange([decoratorNode.range[0], nextToken.range[0]])
      : (fixer) => fixer.remove(decoratorNode),
  );

  return (fixer) => fixes.map((applyFix) => applyFix(fixer));
};

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow legacy Angular decorators (@Input, @Output, @ViewChild, etc.) in favour of signal-based APIs and host: {} bindings.',
    },
    fixable: 'code',
    schema: [],
    messages: {
      useInput: 'Use the input() signal function instead of @Input().',
      useOutput: 'Use the output() signal function instead of @Output().',
      useViewChild: 'Use the viewChild() signal function instead of @ViewChild().',
      useViewChildren: 'Use the viewChildren() signal function instead of @ViewChildren().',
      useContentChild: 'Use the contentChild() signal function instead of @ContentChild().',
      useContentChildren: 'Use the contentChildren() signal function instead of @ContentChildren().',
      useHostBinding: 'Use the host: {} property in @Component/@Directive instead of @HostBinding().',
      useHostListener: 'Use the host: {} property in @Component/@Directive instead of @HostListener().',
      useModel:
        "Use model() instead of the @Input()/@Output() two-way binding pattern ('{{inputName}}' / '{{outputName}}').",
    },
  },
  create(context) {
    /**
     * Stack of per-class contexts used to detect two-way binding pairs.
     * We defer @Input / @Output reporting to class exit so we can check whether
     * a `xChange` output has a matching `x` input (→ model()).
     *
     * @type {Array<{ inputs: Map<string, any>; outputs: Map<string, any> }>}
     */
    const classStack = [];

    const currentClass = () => classStack[classStack.length - 1] ?? null;

    const pushClass = () => classStack.push({ inputs: new Map(), outputs: new Map() });

    const popClass = () => {
      const ctx = classStack.pop();
      if (!ctx) return;

      const reportedInputNames = new Set();
      const reportedOutputNames = new Set();

      // Detect @Input() x + @Output() xChange pairs → suggest model()
      for (const [outputName, outputDecoratorNode] of ctx.outputs) {
        if (!outputName.endsWith('Change')) continue;
        const inputName = outputName.slice(0, -'Change'.length);
        if (!ctx.inputs.has(inputName)) continue;

        reportedInputNames.add(inputName);
        reportedOutputNames.add(outputName);

        context.report({
          node: ctx.inputs.get(inputName),
          messageId: 'useModel',
          data: { inputName, outputName },
        });
        context.report({
          node: outputDecoratorNode,
          messageId: 'useModel',
          data: { inputName, outputName },
        });
      }

      // Report remaining @Input() decorators that are not part of a pair
      for (const [name, decoratorNode] of ctx.inputs) {
        if (!reportedInputNames.has(name)) {
          context.report({ node: decoratorNode, messageId: 'useInput' });
        }
      }

      // Report remaining @Output() decorators that are not part of a pair
      for (const [name, decoratorNode] of ctx.outputs) {
        if (!reportedOutputNames.has(name)) {
          context.report({ node: decoratorNode, messageId: 'useOutput' });
        }
      }
    };

    return {
      ClassDeclaration: pushClass,
      ClassExpression: pushClass,
      'ClassDeclaration:exit': popClass,
      'ClassExpression:exit': popClass,

      Decorator(node) {
        const anyNode = /** @type {any} */ (node);
        const decoratorName = getDecoratorName(anyNode);
        if (!decoratorName) return;

        // Only act on decorators attached to class members, not to the class itself
        const parent = anyNode.parent;
        if (!parent) return;
        if (parent.type !== 'PropertyDefinition' && parent.type !== 'MethodDefinition') return;

        const ctx = currentClass();

        switch (decoratorName) {
          case 'Input': {
            if (!ctx) {
              context.report({ node, messageId: 'useInput' });
              break;
            }
            const memberName = getMemberName(parent);
            if (memberName !== null) {
              ctx.inputs.set(memberName, node);
            } else {
              // Computed key — cannot be part of a two-way binding pair, report immediately
              context.report({ node, messageId: 'useInput' });
            }
            break;
          }

          case 'Output': {
            if (!ctx) {
              context.report({ node, messageId: 'useOutput' });
              break;
            }
            const memberName = getMemberName(parent);
            if (memberName !== null) {
              ctx.outputs.set(memberName, node);
            } else {
              context.report({ node, messageId: 'useOutput' });
            }
            break;
          }

          case 'ViewChild':
            context.report({ node, messageId: 'useViewChild' });
            break;

          case 'ViewChildren':
            context.report({ node, messageId: 'useViewChildren' });
            break;

          case 'ContentChild':
            context.report({ node, messageId: 'useContentChild' });
            break;

          case 'ContentChildren':
            context.report({ node, messageId: 'useContentChildren' });
            break;

          case 'HostBinding':
            context.report({
              node,
              messageId: 'useHostBinding',
              fix: (() => {
                const memberName = getMemberName(parent);
                if (!memberName) return null;

                const expression = anyNode.expression;
                if (expression.type !== 'CallExpression' && expression.type !== 'Identifier') return null;

                const bindingName =
                  expression.type === 'CallExpression'
                    ? expression.arguments[0]?.type === 'Literal' && typeof expression.arguments[0].value === 'string'
                      ? expression.arguments[0].value
                      : memberName
                    : memberName;

                const bindingKey = bindingName.startsWith('[') ? bindingName : `[${bindingName}]`;
                return buildHostBindingFix(context.sourceCode, anyNode, parent, bindingKey, memberName);
              })(),
            });
            break;

          case 'HostListener':
            context.report({ node, messageId: 'useHostListener' });
            break;
        }
      },
    };
  },
};

module.exports = rule;
