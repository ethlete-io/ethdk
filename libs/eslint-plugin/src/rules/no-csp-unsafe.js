// @ts-check
'use strict';

/**
 * Disallows code that a strict Content Security Policy without `'unsafe-inline'` / `'unsafe-eval'`
 * blocks at runtime:
 *
 *   script-src 'self' 'nonce-…'; style-src 'self' 'nonce-…'
 *
 * BAD:
 *   el.setAttribute('style', 'color: red');          // inline style attribute
 *   renderer.setAttribute(el, 'style', css);
 *   const s = document.createElement('style');       // appended without a nonce
 *   eval(code); new Function(code); setTimeout('tick()', 10);
 *   `<div style="color: red">…</div>`                // HTML string parsed into the DOM
 *   <div style="color: red"></div>                   // static template attribute
 *   host: { style: 'display: block' }
 *
 * GOOD:
 *   el.style.color = 'red';  el.style.setProperty('--x', '1');  [style.color]="c"
 *   s.setAttribute('nonce', inject(CSP_NONCE));      // or s.nonce = …
 *   a class or data attribute styled by a shipped stylesheet
 *
 * In an Angular template this rule runs on `.html` files and on inline templates extracted by
 * `processInlineTemplates`; in TypeScript it skips a decorator's `template` string for that reason.
 */

const fs = require('node:fs');
const { isGlobalReference } = require('./internals/import-resolution');

const NONCED_ELEMENTS = new Set(['script', 'style']);
const TIMER_FUNCTIONS = new Set(['setTimeout', 'setInterval']);
const HTML_STYLE_ATTRIBUTE = /<[a-zA-Z][^<>]*\sstyle\s*=/;
const UNFIXABLE_STYLE_VALUE = /['"\\]|\/\*|!important|url\(/i;
const PLAIN_STYLE_PROPERTY = /^[a-zA-Z]+$/;
const STYLE_PROPERTY = /^-{0,2}[a-zA-Z][\w-]*$/;
const QUOTED_INLINE_TEMPLATE = /\btemplate\s*:\s*['"]/;

/**
 * Turns `a: b; c-d: e` into `{ a: 'b', 'c-d': 'e' }`, or returns null when the declarations cannot be
 * rewritten without changing what they mean.
 *
 * @param {string} css
 */
const toStyleObjectLiteral = (css) => {
  if (UNFIXABLE_STYLE_VALUE.test(css)) return null;

  const entries = [];

  for (const declaration of css.split(';')) {
    if (!declaration.trim()) continue;

    const colon = declaration.indexOf(':');

    if (colon === -1) return null;

    const property = declaration.slice(0, colon).trim();
    const value = declaration
      .slice(colon + 1)
      .trim()
      .replace(/\s+/g, ' ');

    if (!STYLE_PROPERTY.test(property) || !value) return null;

    entries.push(`${PLAIN_STYLE_PROPERTY.test(property) ? property : `'${property}'`}: '${value}'`);
  }

  return entries.length ? `{ ${entries.join(', ')} }` : null;
};

/** @param {any} node */
const stringValue = (node) => (node?.type === 'Literal' && typeof node.value === 'string' ? node.value : null);

/** @param {any} node */
const propertyName = (node) => {
  if (node?.type !== 'Property' || node.computed) return null;
  if (node.key.type === 'Identifier') return node.key.name;

  return stringValue(node.key);
};

/** @param {any} node */
const calleeMemberName = (node) =>
  node.callee.type === 'MemberExpression' && !node.callee.computed && node.callee.property.type === 'Identifier'
    ? node.callee.property.name
    : null;

/** @param {any} node @param {string} name */
const hasProperty = (node, name) =>
  node?.type === 'ObjectExpression' && node.properties.some(/** @param {any} p */ (p) => propertyName(p) === name);

/** @param {any} node */
const isDecoratorTemplate = (node) => {
  const property = node.parent;

  if (propertyName(property) !== 'template' || property.value !== node) return false;

  const call = property.parent?.parent;

  return call?.type === 'CallExpression' && call.parent?.type === 'Decorator';
};

/** @param {any} node */
const isHostMetadata = (node) => {
  const property = node.parent;

  if (propertyName(property) !== 'host' || property.value !== node) return false;

  const call = property.parent?.parent;

  return call?.type === 'CallExpression' && call.parent?.type === 'Decorator';
};

/** @param {any} node */
const enclosingScopeNode = (node) => {
  let current = node.parent;

  while (current) {
    if (
      current.type === 'FunctionDeclaration' ||
      current.type === 'FunctionExpression' ||
      current.type === 'ArrowFunctionExpression' ||
      current.type === 'Program'
    ) {
      return current;
    }

    current = current.parent;
  }

  return null;
};

/** @param {any} node */
const boundTarget = (node) => {
  const parent = node.parent;

  if (parent?.type === 'VariableDeclarator' && parent.init === node && parent.id.type === 'Identifier')
    return parent.id;
  if (parent?.type === 'AssignmentExpression' && parent.right === node) return parent.left;

  return null;
};

/** @type {import('eslint').Rule.RuleModule} */
const noCspUnsafe = {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description:
        "Disallow code a strict Content Security Policy (no 'unsafe-inline', no 'unsafe-eval') blocks at runtime.",
      recommended: true,
    },
    schema: [],
    messages: {
      styleAttribute:
        "A `style` attribute is blocked by a CSP without 'unsafe-inline'. Set styles through CSSOM (`el.style.x = …`, `style.setProperty()`, a `[style.x]` binding) or use a class.",
      htmlStyleAttribute:
        "This HTML string sets a `style` attribute, which a CSP without 'unsafe-inline' blocks once it is parsed into the DOM. Use a class or a data attribute styled by a stylesheet.",
      templateStyleAttribute:
        "A static `style` attribute is blocked by a CSP without 'unsafe-inline'. Use `[style.x]` bindings or a class.",
      missingNonce:
        "A `<{{tag}}>` element created without a nonce is blocked by a CSP without 'unsafe-inline'. Set `nonce` from `inject(CSP_NONCE)` on it in the same function.",
      dynamicCode: "`{{name}}` evaluates a string as code, which a CSP without 'unsafe-eval' blocks.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const parserServices = /** @type {any} */ (sourceCode.parserServices);

    if (parserServices?.convertNodeSourceSpanToLoc) {
      /** @param {any} span @param {string} messageId */
      const reportSpan = (span, messageId) =>
        context.report({ loc: parserServices.convertNodeSourceSpanToLoc(span), messageId });

      let quotedInlineTemplate = /** @type {boolean | undefined} */ (undefined);

      // The fix writes single quotes, which would end a quoted `template: '…'` string in the component.
      const canFixTemplate = () => {
        if (context.physicalFilename === context.filename || !context.physicalFilename.endsWith('.ts')) return true;

        quotedInlineTemplate ??= QUOTED_INLINE_TEMPLATE.test(fs.readFileSync(context.physicalFilename, 'utf8'));

        return !quotedInlineTemplate;
      };

      return {
        /** @param {any} node */
        Element(node) {
          const hasStyleBinding = (node.inputs ?? []).some(
            /** @param {any} input */ (input) => input.name === 'style' && String(input.keySpan) === 'style',
          );

          for (const attribute of node.attributes ?? []) {
            if (attribute.name !== 'style') continue;

            const literal = hasStyleBinding || !canFixTemplate() ? null : toStyleObjectLiteral(attribute.value);

            context.report({
              loc: parserServices.convertNodeSourceSpanToLoc(attribute.sourceSpan),
              messageId: 'templateStyleAttribute',
              fix: literal
                ? (fixer) =>
                    fixer.replaceTextRange(
                      [attribute.sourceSpan.start.offset, attribute.sourceSpan.end.offset],
                      `[style]="${literal}"`,
                    )
                : null,
            });
          }

          for (const input of node.inputs ?? []) {
            if (input.name === 'style' && String(input.keySpan) === 'attr.style') {
              reportSpan(input.sourceSpan, 'styleAttribute');
            }
          }
        },
      };
    }

    /** @param {any} scope @param {string} target */
    const setsNonce = (scope, target) => {
      let found = false;

      /** @param {any} node */
      const matches = (node) => node && sourceCode.getText(node) === target;

      /** @param {any} node */
      const visit = (node) => {
        if (found || !node || typeof node.type !== 'string') return;

        if (
          node.type === 'AssignmentExpression' &&
          node.left.type === 'MemberExpression' &&
          !node.left.computed &&
          node.left.property.name === 'nonce' &&
          matches(node.left.object)
        ) {
          found = true;
          return;
        }

        if (node.type === 'CallExpression') {
          const method = calleeMemberName(node);
          const [first, second] = node.arguments;

          if (
            (method === 'setAttribute' && matches(node.callee.object) && stringValue(first) === 'nonce') ||
            (method === 'setAttribute' && matches(first) && stringValue(second) === 'nonce') ||
            ((method === 'setAttributes' || method === 'assign') && matches(first) && hasProperty(second, 'nonce'))
          ) {
            found = true;
            return;
          }
        }

        for (const key of sourceCode.visitorKeys[node.type] ?? []) {
          const child = node[key];

          if (Array.isArray(child)) child.forEach(visit);
          else visit(child);
        }
      };

      visit(scope);

      return found;
    };

    /** @param {any} node @param {string} text */
    const checkHtmlString = (node, text) => {
      if (HTML_STYLE_ATTRIBUTE.test(text) && !isDecoratorTemplate(node)) {
        context.report({ node, messageId: 'htmlStyleAttribute' });
      }
    };

    return {
      /** @param {any} node */
      CallExpression(node) {
        const method = calleeMemberName(node);
        const [first, second] = node.arguments;

        if (method === 'setAttribute') {
          if (stringValue(first) === 'style' || (node.arguments.length >= 3 && stringValue(second) === 'style')) {
            context.report({ node, messageId: 'styleAttribute' });
          }

          return;
        }

        if (method === 'setAttributes' && hasProperty(second, 'style')) {
          context.report({ node, messageId: 'styleAttribute' });
          return;
        }

        if (method === 'createElement') {
          const tag = stringValue(first)?.toLowerCase();

          if (!tag || !NONCED_ELEMENTS.has(tag)) return;

          const target = boundTarget(node);
          const scope = enclosingScopeNode(node);

          if (!target || !scope || !setsNonce(scope, sourceCode.getText(target))) {
            context.report({ node, messageId: 'missingNonce', data: { tag } });
          }

          return;
        }

        const callee = node.callee;
        const name = callee.type === 'Identifier' ? callee.name : callee.type === 'MemberExpression' ? method : null;

        if (!name) return;

        if (callee.type === 'Identifier' && (name === 'eval' || name === 'Function')) {
          if (isGlobalReference(sourceCode, callee)) context.report({ node, messageId: 'dynamicCode', data: { name } });

          return;
        }

        if (TIMER_FUNCTIONS.has(name) && (stringValue(first) !== null || first?.type === 'TemplateLiteral')) {
          if (callee.type === 'MemberExpression' || isGlobalReference(sourceCode, callee)) {
            context.report({ node, messageId: 'dynamicCode', data: { name: `${name}(string)` } });
          }
        }
      },
      /** @param {any} node */
      NewExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'Function' &&
          isGlobalReference(sourceCode, node.callee)
        ) {
          context.report({ node, messageId: 'dynamicCode', data: { name: 'new Function' } });
        }
      },
      /** @param {any} node */
      ObjectExpression(node) {
        if (!isHostMetadata(node)) return;

        for (const property of node.properties) {
          const key = propertyName(property);

          if (key === 'style' || key === '[attr.style]')
            context.report({ node: property, messageId: 'styleAttribute' });
        }
      },
      /** @param {any} node */
      Literal(node) {
        if (typeof node.value === 'string') checkHtmlString(node, node.value);
      },
      /** @param {any} node */
      TemplateLiteral(node) {
        checkHtmlString(node, node.quasis.map(/** @param {any} q */ (q) => q.value.cooked ?? q.value.raw).join('x'));
      },
    };
  },
};

module.exports = noCspUnsafe;
