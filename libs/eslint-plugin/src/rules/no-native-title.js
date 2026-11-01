// @ts-check
'use strict';

/**
 * Flags a native `title` attribute on an HTML element - it renders the browser tooltip, which the SDK tooltip replaces.
 *
 *   <button title="Save">           ✘
 *   <button [title]="label()">      ✘
 *   <button [attr.title]="label()"> ✘
 *
 * An element with a dash in its name is a component or custom element; its `title` input or attribute
 * is its own API, so only `[attr.title]` is reported there.
 */

/** @type {import('eslint').Rule.RuleModule} */
const noNativeTitle = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow the native `title` attribute in Angular templates; use the SDK tooltip.',
      recommended: true,
    },
    schema: [],
    messages: {
      nativeTitle:
        'A native `title` shows the browser tooltip. Use the SDK tooltip (`etTooltip` from `@ethlete/components`) instead.',
    },
  },
  create(context) {
    const parserServices = /** @type {any} */ (context.sourceCode.parserServices);

    if (!parserServices?.convertNodeSourceSpanToLoc) return {};

    /** @param {any} node */
    const report = (node) =>
      context.report({
        loc: parserServices.convertNodeSourceSpanToLoc(node.sourceSpan),
        messageId: 'nativeTitle',
      });

    return {
      /** @param {any} node */
      Element(node) {
        const isCustom = node.name.includes('-');

        for (const attribute of node.attributes ?? []) {
          if (attribute.name === 'title' && !isCustom) report(attribute);
        }

        for (const input of node.inputs ?? []) {
          if (input.name !== 'title') continue;
          const isAttrBinding = input.keySpan?.toString() === 'attr.title';
          if (isAttrBinding || !isCustom) report(input);
        }
      },
    };
  },
};

module.exports = noNativeTitle;
