// @ts-check
'use strict';

/**
 * Flags property bindings whose value is a static boolean literal:
 *
 *   <my-cmp [isReadonly]="true" />
 *   <my-cmp [isReadonly]="false" />
 *
 * If the target input uses a `booleanAttribute` transform (the styleguide
 * default for boolean inputs), the binding is unnecessary — a static attribute
 * expresses the same thing without a change-detection expression:
 *
 *   <my-cmp isReadonly />          (true)
 *   <my-cmp isReadonly="false" />  (false — `booleanAttribute` coerces the string 'false' to false)
 *
 * Whether the input actually has that transform is invisible to a template
 * rule (no type information), so the rewrite is offered as a suggestion, not
 * an auto-fix: without the transform a static attribute would pass the string
 * 'true' / 'false' instead of a boolean.
 *
 * Companion to `@angular-eslint/template/prefer-static-string-properties`,
 * which covers the string-literal case (where the rewrite is always safe).
 */

/** @type {import('eslint').Rule.RuleModule} */
const preferStaticBooleanProperties = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Prefer a static attribute over a property binding for static boolean values when the input uses a booleanAttribute transform.',
    },
    hasSuggestions: true,
    schema: [],
    messages: {
      preferStaticBooleanProperty:
        'Binding a static boolean is unnecessary if the `{{ name }}` input uses a `booleanAttribute` transform — use a static attribute instead. Keep the binding if the input takes a plain boolean without a transform.',
      useBareAttribute: 'Replace with the bare attribute `{{ name }}`',
      useStaticAttribute: 'Replace with the static attribute `{{ name }}="false"`',
    },
  },
  create(context) {
    const parserServices = /** @type {any} */ (context.sourceCode.parserServices);

    // Only meaningful when parsed with @angular-eslint/template-parser
    if (!parserServices?.convertNodeSourceSpanToLoc) return {};

    return {
      /** @param {any} node */
      ['BoundAttribute.inputs'](node) {
        const { name, sourceSpan, keySpan, value } = node;

        // Exclude @animation, class./style./attr. sub-properties, and
        // structural directives (*foo has no keySpan details)
        const isBindingProperty = keySpan?.details && !keySpan.details.includes('@') && !keySpan.details.includes('.');
        if (!isBindingProperty) return;

        // Only literal `true` / `false` expressions. `value.ast` is a
        // LiteralPrimitive for literals; the raw-source check guards against
        // other node shapes that happen to carry a boolean `value`.
        const source = typeof value?.source === 'string' ? value.source.trim() : null;
        if (typeof value?.ast?.value !== 'boolean' || (source !== 'true' && source !== 'false')) return;

        const isTrue = value.ast.value === true;
        const replacement = isTrue ? name : `${name}="false"`;

        context.report({
          loc: parserServices.convertNodeSourceSpanToLoc(sourceSpan),
          messageId: 'preferStaticBooleanProperty',
          data: { name },
          suggest: [
            {
              messageId: isTrue ? 'useBareAttribute' : 'useStaticAttribute',
              data: { name },
              fix: (fixer) => fixer.replaceTextRange([sourceSpan.start.offset, sourceSpan.end.offset], replacement),
            },
          ],
        });
      },
    };
  },
};

module.exports = preferStaticBooleanProperties;
