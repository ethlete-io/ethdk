// @ts-check
'use strict';

/**
 * @param {any} node
 * @param {import('eslint').SourceCode} sourceCode
 * @param {'private' | 'protected' | 'public'} accessibility
 */
const buildAccessibilityFix = (node, sourceCode, accessibility) => {
  const decoratorEnd = node.decorators?.at(-1)?.range[1] ?? node.range[0];
  const tokens = sourceCode.getTokens(node);
  const accessibilityToken = tokens.find(
    (token) => token.range[0] >= decoratorEnd && token.value === node.accessibility,
  );

  if (accessibilityToken) {
    return (fixer) => fixer.replaceText(accessibilityToken, accessibility);
  }

  const insertionToken = tokens.find((token) => token.range[0] >= decoratorEnd);
  if (!insertionToken) return null;

  return (fixer) => fixer.insertTextBefore(insertionToken, `${accessibility} `);
};

module.exports = { buildAccessibilityFix };
