// @ts-check
'use strict';

const ts = require('typescript');

/**
 * The Angular VS Code extension decides client-side whether a cursor in a `.ts` file sits inside an
 * inline `template:` before it forwards completion / hover / definition / signature-help to the
 * language server. That check (`isNotTypescriptOrSupportedDecoratorField` in
 * `client/src/embedded_support.js`) walks the file with a bare `ts.createScanner()` loop.
 *
 * A bare scanner cannot re-scan `}` as `TemplateMiddle` / `TemplateTail` — that needs the parser's
 * `reScanTemplateToken()`. So the first template literal containing a substitution desynchronises
 * both the token stream and the brace counter, the scanner never recognises `template` `:` again,
 * and every template request in the rest of the file is silently dropped. The language server
 * answers those requests correctly; the editor just never asks.
 *
 * This rule reproduces that scanner verbatim, so it reports exactly the templates the extension
 * would abandon — no heuristic, no false positives.
 */
const ANGULAR_PROPERTY_ASSIGNMENTS = new Set(['template', 'templateUrl', 'styleUrls', 'styleUrl', 'host']);

/**
 * @param {import('typescript').SyntaxKind} token
 */
const isPropertyAssignmentTerminator = (token) =>
  token === ts.SyntaxKind.EndOfFileToken ||
  token === ts.SyntaxKind.CommaToken ||
  token === ts.SyntaxKind.SemicolonToken ||
  token === ts.SyntaxKind.CloseBraceToken;

/**
 * Mirrors the extension's `isPropertyAssignmentToStringOrStringInArray`. Returns whether the editor
 * would recognise `offset` as sitting inside a supported decorator field.
 *
 * @param {string} text
 * @param {number} offset
 */
const editorSeesDecoratorField = (text, offset) => {
  const scanner = ts.createScanner(ts.ScriptTarget.ESNext, true);
  scanner.setText(text);

  let token = scanner.scan();
  let lastToken;
  let lastTokenText;
  let unclosedBraces = 0;
  let unclosedBrackets = 0;
  let propertyAssignmentContext = false;

  while (token !== ts.SyntaxKind.EndOfFileToken && scanner.getTokenFullStart() < offset) {
    if (
      lastToken === ts.SyntaxKind.Identifier &&
      lastTokenText !== undefined &&
      token === ts.SyntaxKind.ColonToken &&
      ANGULAR_PROPERTY_ASSIGNMENTS.has(lastTokenText)
    ) {
      propertyAssignmentContext = true;
      token = scanner.scan();
      continue;
    }

    if (unclosedBraces === 0 && unclosedBrackets === 0 && isPropertyAssignmentTerminator(token)) {
      propertyAssignmentContext = false;
    }

    if (token === ts.SyntaxKind.OpenBracketToken) unclosedBrackets++;
    else if (token === ts.SyntaxKind.OpenBraceToken) unclosedBraces++;
    else if (token === ts.SyntaxKind.CloseBracketToken) unclosedBrackets--;
    else if (token === ts.SyntaxKind.CloseBraceToken) unclosedBraces--;

    const isStringToken =
      token === ts.SyntaxKind.StringLiteral || token === ts.SyntaxKind.NoSubstitutionTemplateLiteral;
    const isCursorInToken =
      scanner.getTokenFullStart() <= offset && scanner.getTokenFullStart() + scanner.getTokenText().length >= offset;

    if (propertyAssignmentContext && isCursorInToken && isStringToken) return true;

    lastTokenText = scanner.getTokenText();
    lastToken = token;
    token = scanner.scan();
  }

  return false;
};

/**
 * @param {import('estree').Property['key']} key
 */
const getPropertyName = (key) => {
  if (key.type === 'Identifier') return key.name;
  if (key.type === 'Literal' && typeof key.value === 'string') return key.value;
  return null;
};

/**
 * @param {any} node
 */
const getDecoratorName = (node) => {
  const expression = node.expression;
  if (!expression) return null;
  if (expression.type === 'CallExpression') {
    return expression.callee.type === 'Identifier' ? expression.callee.name : null;
  }

  return expression.type === 'Identifier' ? expression.name : null;
};

/**
 * The inline template text, or null when the property is not a plain non-empty string literal.
 *
 * @param {any} value
 */
const getInlineTemplateText = (value) => {
  if (value.type === 'Literal') return typeof value.value === 'string' ? value.value : null;
  if (value.type === 'TemplateLiteral' && value.expressions.length === 0) return value.quasis[0]?.value.raw ?? '';
  return null;
};

/** @type {import('eslint').Rule.RuleModule} */
const noTemplateLiteralBeforeInlineTemplate = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow a substituted template literal above an inline component template, which silently disables Angular language service completions for the rest of the file.',
    },
    schema: [],
    messages: {
      breaksLanguageService:
        'The Angular language service gives no completions, hover or go-to-definition inside this template. Its editor-side scanner desynchronises on the interpolated template literal at line {{line}}, so every template request below it is dropped. Move that code below the component, extract it to a sibling file, or write it without an interpolation.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const text = sourceCode.getText();

    /** @type {number[]} */
    const interpolatedLiteralStarts = [];
    /** @type {any[]} */
    const inlineTemplates = [];

    return {
      /** @param {any} node */
      TemplateLiteral(node) {
        if (node.expressions.length > 0) interpolatedLiteralStarts.push(node.range[0]);
      },

      /** @param {import('eslint').Rule.Node} node */
      Decorator(node) {
        const decoratorName = getDecoratorName(node);
        if (decoratorName !== 'Component' && decoratorName !== 'Directive') return;

        const expression = /** @type {any} */ (node).expression;
        if (expression.type !== 'CallExpression') return;

        const metadata = expression.arguments[0];
        if (!metadata || metadata.type !== 'ObjectExpression') return;

        for (const property of metadata.properties) {
          if (property.type !== 'Property') continue;
          if (getPropertyName(property.key) !== 'template') continue;

          const templateText = getInlineTemplateText(property.value);
          if (templateText === null || templateText.trim().length === 0) continue;

          inlineTemplates.push(property);
        }
      },

      'Program:exit'() {
        for (const property of inlineTemplates) {
          // Where the editor would put the cursor: just inside the opening quote or backtick.
          const cursor = property.value.range[0] + 2;
          if (editorSeesDecoratorField(text, cursor)) continue;

          const culprit = interpolatedLiteralStarts.find((start) => start < property.value.range[0]);
          if (culprit === undefined) continue;

          context.report({
            node: property.key,
            messageId: 'breaksLanguageService',
            data: { line: String(sourceCode.getLocFromIndex(culprit).line) },
          });
        }
      },
    };
  },
};

module.exports = noTemplateLiteralBeforeInlineTemplate;
