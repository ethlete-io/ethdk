// @ts-check
'use strict';

/** @type {import('eslint').Rule.RuleModule} */
const noTypedInjectedElementRef = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require that inject(ElementRef) uses a generic type parameter on inject() itself, not on ElementRef.',
      recommended: true,
    },
    messages: {
      missingGeneric:
        'Provide a generic type on inject() itself: `inject<ElementRef<HTMLElement>>(ElementRef)`. Passing a type argument on ElementRef directly is also disallowed.',
    },
    schema: [],
    fixable: 'code',
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'inject') {
          return;
        }

        const firstArg = node.arguments[0];
        if (!firstArg) return;

        const isPlainElementRef = firstArg.type === 'Identifier' && firstArg.name === 'ElementRef';
        const isInstantiatedElementRef =
          firstArg.type === 'TSInstantiationExpression' &&
          firstArg.expression &&
          firstArg.expression.type === 'Identifier' &&
          firstArg.expression.name === 'ElementRef';

        if (!isPlainElementRef && !isInstantiatedElementRef) return;

        const src = context.sourceCode;
        const existingTypeParams = node.typeParameters || node.typeArguments;
        const hasInjectTypeParam =
          existingTypeParams && existingTypeParams.params && existingTypeParams.params.length > 0;

        if (isPlainElementRef && !hasInjectTypeParam) {
          // inject(ElementRef) → inject<ElementRef<HTMLElement>>(ElementRef)
          context.report({
            node,
            messageId: 'missingGeneric',
            fix(fixer) {
              return fixer.insertTextAfter(node.callee, '<ElementRef<HTMLElement>>');
            },
          });
          return;
        }

        if (isInstantiatedElementRef) {
          // Capture the type args text from the token, e.g. "<HTMLElement>"
          const tokenTypeParamText = src.getText(firstArg.typeParameters || firstArg.typeArguments);

          if (!hasInjectTypeParam) {
            // inject(ElementRef<HTMLElement>) → inject<ElementRef<HTMLElement>>(ElementRef)
            context.report({
              node,
              messageId: 'missingGeneric',
              fix(fixer) {
                return [
                  fixer.insertTextAfter(node.callee, `<ElementRef${tokenTypeParamText}>`),
                  fixer.replaceText(firstArg, 'ElementRef'),
                ];
              },
            });
          } else {
            // inject<X>(ElementRef<Y>) — token must not carry type args; keep inject's type param
            context.report({
              node,
              messageId: 'missingGeneric',
              fix(fixer) {
                return fixer.replaceText(firstArg, 'ElementRef');
              },
            });
          }
        }
      },
    };
  },
};

module.exports = noTypedInjectedElementRef;
