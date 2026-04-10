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

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow legacy Angular decorators (@Input, @Output, @ViewChild, etc.) in favour of signal-based APIs and host: {} bindings.',
    },
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
            context.report({ node, messageId: 'useHostBinding' });
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
