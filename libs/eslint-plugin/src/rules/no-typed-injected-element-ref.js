// @ts-check
'use strict';

const { isImportedAs } = require('./internals/import-resolution');

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
        const src = context.sourceCode;
        if (!isImportedAs(src, node.callee, 'inject')) return;

        const firstArg = node.arguments[0];
        if (!firstArg) return;

        const isPlainElementRef = isImportedAs(src, firstArg, 'ElementRef');
        const isInstantiatedElementRef =
          firstArg.type === 'TSInstantiationExpression' && isImportedAs(src, firstArg.expression, 'ElementRef');

        if (!isPlainElementRef && !isInstantiatedElementRef) return;

        const elementRef = src.getText(isPlainElementRef ? firstArg : firstArg.expression);
        const existingTypeParams = node.typeParameters || node.typeArguments;
        const injectType = existingTypeParams?.params?.[0];
        const hasTypedElementRef =
          existingTypeParams?.params?.length === 1 &&
          injectType?.type === 'TSTypeReference' &&
          src.getText(injectType.typeName) === elementRef &&
          (injectType.typeArguments || injectType.typeParameters)?.params?.length > 0;

        if (isPlainElementRef && !hasTypedElementRef) {
          // inject(ElementRef) → inject<ElementRef<HTMLElement>>(ElementRef)
          context.report({
            node,
            messageId: 'missingGeneric',
            fix(fixer) {
              return existingTypeParams
                ? fixer.replaceText(existingTypeParams, `<${elementRef}<HTMLElement>>`)
                : fixer.insertTextAfter(node.callee, `<${elementRef}<HTMLElement>>`);
            },
          });
          return;
        }

        if (isInstantiatedElementRef) {
          // Capture the type args text from the token, e.g. "<HTMLElement>"
          const tokenTypeParamText = src.getText(firstArg.typeParameters || firstArg.typeArguments);

          if (!hasTypedElementRef) {
            // inject(ElementRef<HTMLElement>) → inject<ElementRef<HTMLElement>>(ElementRef)
            context.report({
              node,
              messageId: 'missingGeneric',
              fix(fixer) {
                const typeFix = existingTypeParams
                  ? fixer.replaceText(existingTypeParams, `<${elementRef}${tokenTypeParamText}>`)
                  : fixer.insertTextAfter(node.callee, `<${elementRef}${tokenTypeParamText}>`);
                return [typeFix, fixer.replaceText(firstArg, elementRef)];
              },
            });
          } else {
            // inject<X>(ElementRef<Y>) — token must not carry type args; keep inject's type param
            context.report({
              node,
              messageId: 'missingGeneric',
              fix(fixer) {
                return fixer.replaceText(firstArg, elementRef);
              },
            });
          }
        }
      },
    };
  },
};

module.exports = noTypedInjectedElementRef;
